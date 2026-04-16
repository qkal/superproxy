import type { ProviderAdapter, Capability, HealthResult } from '@/types/provider'
import type { OpenAIChatRequest, OpenAIChatChunk } from '@/types/openai'
import type { BackendRequestFor } from '@/types/provider'
import type { CloudProviderConfig } from '@/types/config'
import type { ResolvedCredential } from '@/auth/credential'
import type { CredentialResult } from '@/auth/types'
import { transformRequest } from './transform'
import { normalizeEvent } from './normalize'
import { ClaudeCredentialResolver } from './auth'

const DEFAULT_BASE_URL = 'https://api.anthropic.com'

export class ClaudeAdapter implements ProviderAdapter<'claude'> {
  readonly id = 'claude' as const
  readonly capabilities: ReadonlyArray<Capability> = ['chat', 'streaming', 'tools', 'vision']

  readonly #config: CloudProviderConfig
  readonly #credentialResolver: ClaudeCredentialResolver

  constructor(config: CloudProviderConfig) {
    this.#config = config
    this.#credentialResolver = new ClaudeCredentialResolver(config)
  }

  async resolveCredentials(): Promise<CredentialResult> {
    return this.#credentialResolver.resolve()
  }

  async isAvailable(): Promise<HealthResult> {
    const baseUrl = this.#config.baseUrl ?? DEFAULT_BASE_URL
    const start = Date.now()
    try {
      // Anthropic doesn't have a /models endpoint, so we check the messages endpoint
      // A 401 means it's available but needs auth
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(5000),
      })
      const latencyMs = Date.now() - start
      // 400 or 401 means the API is reachable
      if (response.status === 400 || response.status === 401 || response.ok) {
        return { available: true, latencyMs }
      }
      return { available: false, reason: `HTTP ${response.status}`, latencyMs }
    } catch (error) {
      const latencyMs = Date.now() - start
      return {
        available: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
      }
    }
  }

  transformRequest(req: OpenAIChatRequest): BackendRequestFor<'claude'> {
    return transformRequest(req)
  }

  async *streamCompletion(
    req: BackendRequestFor<'claude'>,
    credential: ResolvedCredential,
    signal: AbortSignal,
  ): AsyncIterable<OpenAIChatChunk> {
    const baseUrl = this.#config.baseUrl ?? DEFAULT_BASE_URL
    const requestId = crypto.randomUUID()

    const headers = new Headers({ 'Content-Type': 'application/json' })
    credential.applyAnthropicHeaders(headers)

    const body = { ...req.body, stream: true }

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Claude request failed: ${response.status} ${text}`)
    }

    if (!response.body) {
      throw new Error('No response body from Claude')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''
    const model = req.body.model

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim()
            continue
          }

          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim()
            if (currentEvent && data) {
              const chunk = normalizeEvent(currentEvent, data, requestId, model)
              if (chunk) {
                yield chunk
              }
            }
            currentEvent = ''
            continue
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
