import type { ProviderAdapter, Capability, HealthResult } from '@/types/provider'
import type { OpenAIChatRequest, OpenAIChatChunk } from '@/types/openai'
import type { BackendRequestFor } from '@/types/provider'
import type { OllamaProviderConfig } from '@/types/config'
import type { ResolvedCredential } from '@/auth/credential'
import type { CredentialResult } from '@/auth/types'
import { transformRequest } from './transform'
import { normalizeChunk } from './normalize'
import { OllamaCredentialResolver } from './auth'

export class OllamaAdapter implements ProviderAdapter<'ollama'> {
  readonly id = 'ollama' as const
  readonly capabilities: ReadonlyArray<Capability> = ['chat', 'streaming']

  readonly #config: OllamaProviderConfig
  readonly #credentialResolver: OllamaCredentialResolver

  constructor(config: OllamaProviderConfig) {
    this.#config = config
    this.#credentialResolver = new OllamaCredentialResolver()
  }

  async resolveCredentials(): Promise<CredentialResult> {
    return this.#credentialResolver.resolve()
  }

  async isAvailable(): Promise<HealthResult> {
    const start = Date.now()
    try {
      const response = await fetch(`${this.#config.baseUrl}/api/tags`, {
        method: 'GET',
      })
      const latencyMs = Date.now() - start
      if (response.ok) {
        return { available: true, latencyMs }
      }
      return { available: false, reason: `HTTP ${response.status}` }
    } catch (error) {
      return { available: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  transformRequest(req: OpenAIChatRequest): BackendRequestFor<'ollama'> {
    const result = transformRequest(req)
    if ('kind' in result) {
      // Error case - transformRequest returns ProxyError for unsupported features
      throw new Error(result.kind)
    }
    return result
  }

  async *streamCompletion(
    req: BackendRequestFor<'ollama'>,
    credential: ResolvedCredential,
    signal: AbortSignal,
  ): AsyncIterable<OpenAIChatChunk> {
    const requestId = crypto.randomUUID()

    const response = await fetch(`${this.#config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('No response body from Ollama')
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
          if (!trimmed) continue

          const chunk = normalizeChunk(trimmed, requestId)
          if (chunk) {
            yield chunk
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const chunk = normalizeChunk(buffer.trim(), requestId)
        if (chunk) {
          yield chunk
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
