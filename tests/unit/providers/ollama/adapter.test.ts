import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { OllamaAdapter } from '@/providers/ollama/adapter'
import type { OllamaProviderConfig } from '@/types/config'
import type { OpenAIChatRequest } from '@/types/openai'

describe('OllamaAdapter', () => {
  const config: OllamaProviderConfig = {
    enabled: true,
    baseUrl: 'http://localhost:11434',
  }

  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should have correct id and capabilities', () => {
    const adapter = new OllamaAdapter(config)
    expect(adapter.id).toBe('ollama')
    expect(adapter.capabilities).toContain('chat')
    expect(adapter.capabilities).toContain('streaming')
  })

  it('should transform request', () => {
    const adapter = new OllamaAdapter(config)
    const request: OpenAIChatRequest = {
      model: 'llama3',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    }

    const result = adapter.transformRequest(request)
    expect(result.provider).toBe('ollama')
    expect(result.body.model).toBe('llama3')
    expect(result.body.messages).toHaveLength(1)
  })

  it('should resolve credentials (no-auth)', async () => {
    const adapter = new OllamaAdapter(config)
    const result = await adapter.resolveCredentials()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.credential).toBeDefined()
    }
  })

  it('should check availability (success)', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
      } as Response)

    const adapter = new OllamaAdapter(config)
    const result = await adapter.isAvailable()
    expect(result.available).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('should check availability (HTTP error)', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 503,
      } as Response)

    const adapter = new OllamaAdapter(config)
    const result = await adapter.isAvailable()
    expect(result.available).toBe(false)
    expect(result.reason).toBe('HTTP 503')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('should check availability (network error)', async () => {
    global.fetch = () => Promise.reject(new Error('Connection refused'))

    const adapter = new OllamaAdapter(config)
    const result = await adapter.isAvailable()
    expect(result.available).toBe(false)
    expect(result.reason).toBe('Connection refused')
  })

  describe('streamCompletion', () => {
    it('should stream completion chunks successfully', async () => {
      const chunks = [
        JSON.stringify({ message: { content: 'Hello' } }),
        JSON.stringify({ message: { content: ' world' } }),
        JSON.stringify({ done: true }),
      ]

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk + '\n')))
          controller.close()
        },
      })

      global.fetch = () =>
        Promise.resolve({
          ok: true,
          body: stream,
        } as Response)

      const adapter = new OllamaAdapter(config)
      const request = {
        provider: 'ollama' as const,
        body: {
          model: 'llama3',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true,
        },
      }

      const results: string[] = []
      for await (const chunk of adapter.streamCompletion(
        request,
        { type: 'none' },
        new AbortController().signal,
      )) {
        if (chunk.choices[0]?.delta?.content) {
          results.push(chunk.choices[0].delta.content)
        }
      }

      expect(results).toContain('Hello')
      expect(results).toContain(' world')
    })

    it('should handle HTTP error in streamCompletion', async () => {
      global.fetch = () =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response)

      const adapter = new OllamaAdapter(config)
      const request = {
        provider: 'ollama' as const,
        body: {
          model: 'llama3',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true,
        },
      }

      let error: Error | null = null
      try {
        await adapter
          .streamCompletion(request, { type: 'none' }, new AbortController().signal)
          .next()
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error!.message).toContain('500')
    })

    it('should handle network error in streamCompletion', async () => {
      global.fetch = () => Promise.reject(new Error('Network failure'))

      const adapter = new OllamaAdapter(config)
      const request = {
        provider: 'ollama' as const,
        body: {
          model: 'llama3',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true,
        },
      }

      let error: Error | null = null
      try {
        await adapter
          .streamCompletion(request, { type: 'none' }, new AbortController().signal)
          .next()
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error!.message).toBe('Network failure')
    })

    it('should pass AbortSignal to fetch', async () => {
      let receivedSignal: AbortSignal | undefined

      global.fetch = (_url: string, options?: RequestInit) => {
        receivedSignal = options?.signal
        return Promise.reject(new Error('Aborted'))
      }

      const adapter = new OllamaAdapter(config)
      const request = {
        provider: 'ollama' as const,
        body: {
          model: 'llama3',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true,
        },
      }

      const controller = new AbortController()
      const signal = controller.signal

      try {
        await adapter.streamCompletion(request, { type: 'none' }, signal).next()
      } catch {
        // Expected
      }

      expect(receivedSignal).toBe(signal)
    })
  })
})
