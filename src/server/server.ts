import type { ProxyConfig } from '@/types/config'
import type { ProxyError } from '@/types/errors'
import type { Logger } from 'pino'
import type { ProviderRegistry } from '@/providers/registry'
import type { Router } from '@/router/router'
import type { CredentialCache } from '@/auth/cache'
import type { MetricsCollector } from '@/server/metrics'
import type { ProviderAdapter } from '@/types/provider'
import type { OpenAIChatRequest } from '@/types/openai'
import {
  assignRequestId,
  checkBodySize,
  createErrorResponse,
  handleCors,
  validateContentType,
  createCorsHeaders,
} from '@/server/middleware'
import { OpenAIChatRequestSchema } from '@/types/openai'
import { createSSEStream, createBufferedResponse } from '@/server/sse'
import { ResolvedCredential } from '@/auth/credential'

const VERSION = '0.1.0'

export interface ProxyServerDeps {
  router: Router
  registry: ProviderRegistry
  credentialCache: CredentialCache
  metrics: MetricsCollector
  auditLogger: Logger | null
}

export class ProxyServer {
  #config: ProxyConfig
  #logger: Logger
  #deps: ProxyServerDeps
  #server: ReturnType<typeof Bun.serve> | null = null
  #shuttingDown = false

  constructor(config: ProxyConfig, logger: Logger, deps: ProxyServerDeps) {
    this.#config = config
    this.#logger = logger
    this.#deps = deps
  }

  async start(): Promise<void> {
    const config = this.#config
    const logger = this.#logger
    const deps = this.#deps

    this.#server = Bun.serve({
      hostname: config.server.host,
      port: config.server.port,

      fetch: async (req: Request) => {
        const requestId = assignRequestId()
        const url = new URL(req.url)
        const startTime = Date.now()

        logger.info({ requestId, method: req.method, path: url.pathname })

        // Handle CORS preflight
        const corsResponse = handleCors(req)
        if (corsResponse) {
          return corsResponse
        }

        // Health endpoint
        if (req.method === 'GET' && url.pathname === '/health') {
          return this.#createJsonResponse(
            { status: 'ok', uptime: process.uptime(), version: VERSION },
            requestId,
          )
        }

        // Version endpoint
        if (req.method === 'GET' && url.pathname === '/version') {
          return this.#createJsonResponse({ version: VERSION }, requestId)
        }

        // Ready endpoint (enhanced to check providers)
        if (req.method === 'GET' && url.pathname === '/ready') {
          const registryStatus = await this.#checkRegistryHealth()
          return this.#createJsonResponse(
            {
              status: registryStatus.healthy ? 'ok' : 'degraded',
              providers: registryStatus.providers,
            },
            requestId,
            registryStatus.healthy ? 200 : 503,
          )
        }

        // Metrics endpoint
        if (req.method === 'GET' && url.pathname === '/metrics') {
          const metricsText = deps.metrics.toPrometheus()
          return new Response(metricsText, {
            headers: {
              'Content-Type': 'text/plain; version=0.0.4',
              'x-proxy-request-id': requestId,
            },
          })
        }

        // Models endpoint
        if (req.method === 'GET' && url.pathname === '/v1/models') {
          const models = await this.#listModels()
          return this.#createJsonResponse({ object: 'list', data: models }, requestId)
        }

        // Chat completions endpoint
        if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
          return this.#handleChatCompletion(req, requestId, startTime)
        }

        // 404 for unknown paths
        return new Response('Not Found', {
          status: 404,
          headers: { 'x-proxy-request-id': requestId },
        })
      },
    })

    logger.info({ host: config.server.host, port: config.server.port }, 'SuperProxy server started')
  }

  async stop(): Promise<void> {
    this.#shuttingDown = true

    if (this.#server) {
      // Stop accepting new connections
      await this.#server.stop()

      // Wait for drain timeout to let existing requests complete (capped at 5s to avoid excessive shutdown times)
      const drainTimeoutMs = Math.min(this.#config.server.drainTimeoutMs, 5000)
      this.#logger.info({ drainTimeoutMs }, 'Waiting for connections to drain...')
      await new Promise((resolve) => setTimeout(resolve, drainTimeoutMs))

      this.#logger.info('SuperProxy server stopped')
    }
  }

  get port(): number {
    return this.#server?.port ?? this.#config.server.port
  }

  #createJsonResponse(data: unknown, requestId: string, status = 200): Response {
    const headers = createCorsHeaders('*')
    headers.set('Content-Type', 'application/json')
    headers.set('x-proxy-request-id', requestId)
    headers.set('x-proxy-version', VERSION)

    return new Response(JSON.stringify(data), { status, headers })
  }

  async #checkRegistryHealth(): Promise<{ healthy: boolean; providers: Record<string, boolean> }> {
    const providers: Record<string, boolean> = {}
    let healthy = false

    for (const { id, adapter, breaker } of this.#deps.registry.list()) {
      const available = breaker.allowRequest()
      if (available) {
        const health = await adapter.isAvailable()
        providers[id] = health.available
        if (health.available) {
          healthy = true
        }
      } else {
        providers[id] = false
      }
    }

    // If no providers registered, consider healthy (no work to do)
    if (Object.keys(providers).length === 0) {
      healthy = true
    }

    return { healthy, providers }
  }

  async #listModels(): Promise<
    Array<{ id: string; object: 'model'; created: number; owned_by: string }>
  > {
    const models: Array<{ id: string; object: 'model'; created: number; owned_by: string }> = []
    const seen = new Set<string>()

    for (const { id: providerId, adapter } of this.#deps.registry.list()) {
      // Check if adapter has a way to list models (via capabilities check)
      if (adapter.capabilities.includes('chat')) {
        // For now, return provider as a model
        // In real implementation, this would query each provider's model list
        const modelId = `${providerId}/default`
        if (!seen.has(modelId)) {
          models.push({
            id: modelId,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: providerId,
          })
          seen.add(modelId)
        }
      }
    }

    return models
  }

  async #handleChatCompletion(
    req: Request,
    requestId: string,
    startTime: number,
  ): Promise<Response> {
    const config = this.#config
    const deps = this.#deps

    // Check if shutting down
    if (this.#shuttingDown) {
      const error: ProxyError = {
        kind: 'upstream_error',
        provider: 'proxy',
        status: 503,
        requestId,
      }
      return createErrorResponse(error, requestId)
    }

    // Validate Content-Type
    const contentTypeError = validateContentType(req.headers)
    if (contentTypeError) {
      this.#auditLog(requestId, 'request_invalid', { error: contentTypeError })
      return createErrorResponse(contentTypeError, requestId)
    }

    // Check body size
    const contentLength = req.headers.get('content-length')
    const bodySizeError = checkBodySize(
      contentLength ? parseInt(contentLength, 10) : undefined,
      config.server.maxBodyBytes,
    )
    if (bodySizeError) {
      this.#auditLog(requestId, 'body_too_large', { error: bodySizeError })
      return createErrorResponse(bodySizeError, requestId)
    }

    // Parse and validate body
    let body: unknown
    try {
      body = await req.json()
    } catch (e) {
      this.#logger.warn({ error: e }, 'Failed to parse request body')
      const error: ProxyError = {
        kind: 'request_invalid',
        issues: [{ message: 'Invalid JSON body', path: [] } as any],
      }
      this.#auditLog(requestId, 'request_invalid', { error })
      return createErrorResponse(error, requestId)
    }

    // Apply inbound transformer if configured
    if (config.server.inboundTransformer) {
      try {
        body = await config.server.inboundTransformer(body)
      } catch (err) {
        const error: ProxyError = {
          kind: 'request_invalid',
          issues: [{ message: `Transformer error: ${err}`, path: [] } as any],
        }
        this.#auditLog(requestId, 'request_invalid', { error })
        return createErrorResponse(error, requestId)
      }
    }

    // Validate against schema
    const parseResult = OpenAIChatRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const error: ProxyError = {
        kind: 'request_invalid',
        issues: parseResult.error.issues,
      }
      this.#auditLog(requestId, 'request_invalid', { error })
      return createErrorResponse(error, requestId)
    }

    const chatRequest: OpenAIChatRequest = parseResult.data

    // Find providers for this model
    const providers = deps.router.resolveAll(chatRequest.model)
    if (providers.length === 0) {
      const error: ProxyError = {
        kind: 'no_adapter_found',
        model: chatRequest.model,
      }
      this.#auditLog(requestId, 'no_adapter_found', { model: chatRequest.model })
      return createErrorResponse(error, requestId)
    }

    // Try each provider in order
    const providerErrors: Array<{ provider: string; error: ProxyError }> = []

    for (const provider of providers) {
      const providerId = provider.id
      const providerStartTime = Date.now()

      try {
        const result = await this.#tryProvider(
          provider,
          chatRequest,
          requestId,
          config.server.totalTimeoutMs,
        )

        // Success! Record metrics
        const latencyMs = Date.now() - providerStartTime
        deps.metrics.recordRequest(providerId, 'success')
        deps.metrics.recordLatency(providerId, latencyMs)

        this.#auditLog(requestId, 'success', {
          provider: providerId,
          model: chatRequest.model,
          latencyMs,
          streaming: chatRequest.stream,
        })

        // Add response headers
        const headers = createCorsHeaders('*')
        headers.set('Content-Type', chatRequest.stream ? 'text/event-stream' : 'application/json')
        headers.set('x-proxy-request-id', requestId)
        headers.set('x-proxy-version', VERSION)
        headers.set('x-proxy-provider', providerId)

        return new Response(result.body, { headers })
      } catch (err) {
        const proxyError = this.#normalizeError(err, providerId)
        providerErrors.push({ provider: providerId, error: proxyError })

        // Record failure metric
        deps.metrics.recordRequest(providerId, 'error')

        // Record failure in circuit breaker
        const breaker = deps.registry.getBreaker(providerId)
        if (breaker) {
          breaker.recordFailure()
        }

        this.#logger.warn(
          {
            requestId,
            provider: providerId,
            error: proxyError,
          },
          'Provider failed, trying next',
        )

        // Continue to next provider
        continue
      }
    }

    // All providers failed - aggregate errors
    const aggregatedError: ProxyError = {
      kind: 'all_providers_failed',
      chain: providers.map((p) => p.id),
      lastError: providerErrors[providerErrors.length - 1]?.error ?? {
        kind: 'upstream_error',
        provider: 'unknown',
        status: 502,
        requestId,
      },
    }

    this.#auditLog(requestId, 'all_providers_failed', {
      model: chatRequest.model,
      errors: providerErrors,
    })

    return createErrorResponse(aggregatedError, requestId)
  }

  async #tryProvider(
    provider: ProviderAdapter,
    chatRequest: OpenAIChatRequest,
    requestId: string,
    timeoutMs: number,
  ): Promise<{ body: ReadableStream<Uint8Array> | string }> {
    const providerId = provider.id

    // Create abort controller for timeout
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeoutMs)

    try {
      // Get or resolve credentials
      let credential = this.#deps.credentialCache.get(providerId)
      if (!credential) {
        const credentialResult = await provider.resolveCredentials()
        if (credentialResult.kind === 'error') {
          throw credentialResult.error
        }
        credential = credentialResult.credential
        this.#deps.credentialCache.set(providerId, credential)
      }

      // Transform request to provider format
      const backendRequest = provider.transformRequest(chatRequest)

      // Stream completion
      const chunks = provider.streamCompletion(backendRequest, credential, abortController.signal)

      if (chatRequest.stream) {
        // Streaming response
        const stream = createSSEStream(chunks, {
          onAbort: () => {
            this.#logger.info({ requestId, provider: providerId }, 'Stream aborted')
          },
        })
        return { body: stream }
      } else {
        // Buffered response
        const { response } = createBufferedResponse(chunks)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Response buffering timeout')), timeoutMs)
        })
        const result = await Promise.race([response, timeoutPromise])
        return { body: JSON.stringify(result) }
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  #normalizeError(err: unknown, providerId: string): ProxyError {
    if (err && typeof err === 'object' && 'kind' in err) {
      return err as ProxyError
    }

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        kind: 'request_timeout',
        provider: providerId as any,
        timeoutMs: this.#config.server.totalTimeoutMs,
        phase: 'total',
      }
    }

    return {
      kind: 'upstream_error',
      provider: providerId as any,
      status: 502,
      requestId: 'unknown',
    }
  }

  #auditLog(requestId: string, event: string, details: Record<string, unknown>): void {
    if (this.#deps.auditLogger) {
      this.#deps.auditLogger.info({ requestId, event, ...details })
    }
  }
}
