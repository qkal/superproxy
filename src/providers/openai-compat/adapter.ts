import type { ProviderAdapter, Capability, HealthResult } from '@/types/provider'
import type { OpenAIChatRequest, OpenAIChatChunk } from '@/types/openai'
import type { BackendRequestFor } from '@/types/provider'
import type { CloudProviderConfig } from '@/types/config'
import type { ResolvedCredential } from '@/auth/credential'
import type { CredentialResult } from '@/auth/types'
import { transformRequest } from './transform'
import { normalizeChunk } from './normalize'
import { OpenAICompatCredentialResolver } from './auth'

export class OpenAICompatAdapter implements ProviderAdapter<'openai-compat'> {
  readonly id = 'openai-compat' as const
  readonly capabilities: ReadonlyArray<Capability> = ['chat', 'streaming', 'tools', 'vision']

  readonly #config: CloudProviderConfig & { apiKey?: string }
  readonly #credentialResolver: OpenAICompatCredentialResolver

  constructor(config: CloudProviderConfig & { apiKey?: string }) {
    this.#config = config
    this.#credentialResolver = new OpenAICompatCredentialResolver(config)
  }

  async resolveCredentials(): Promise<CredentialResult> {
    return this.#credentialResolver.resolve()
  }

  async isAvailable(): Promise<HealthResult> {
    const baseUrl = this.#config.baseUrl ?? 'https://api.openai.com'
    const start = Date.now()
    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      const latencyMs = Date.now() - start
      if (response.ok || response.status === 401) {
        // 401 means the endpoint exists but we need auth — still "available"
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

  transformRequest(req: OpenAIChatRequest): BackendRequestFor<'openai-compat'> {
    return transformRequest(req)
  }

  async *streamCompletion(
    req: BackendRequestFor<'openai-compat'>,
    credential: ResolvedCredential,
    signal: AbortSignal,
  ): AsyncIterable<OpenAIChatChunk> {
    const baseUrl = this.#config.baseUrl ?? 'https://api.openai.com'
    const requestId = crypto.randomUUID()

    const headers = new Headers({ 'Content-Type': 'application/json' })
    credential.applyToRequest(headers)

    const body = { ...req.body, stream: true }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`OpenAI-compat request failed: ${response.status} ${text}`)
    }

    if (!response.body) {
      throw new Error('No response body from OpenAI-compat endpoint')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') return

          const chunk = normalizeChunk(data, requestId)
          if (chunk) {
            yield chunk
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim().startsWith('data:')) {
        const data = buffer.trim().slice(5).trim()
        if (data === '[DONE]') return
        const chunk = normalizeChunk(data, requestId)
        if (chunk) {
          yield chunk
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
