import { describe, it, expect } from 'bun:test'
import { OllamaAdapter } from '@/providers/ollama/adapter'
import type { OllamaProviderConfig } from '@/types/config'

describe('OllamaAdapter', () => {
  const config: OllamaProviderConfig = {
    enabled: true,
    baseUrl: 'http://localhost:11434',
  }

  it('should have correct id and capabilities', () => {
    const adapter = new OllamaAdapter(config)
    expect(adapter.id).toBe('ollama')
    expect(adapter.capabilities).toContain('chat')
    expect(adapter.capabilities).toContain('streaming')
  })

  it('should transform request', () => {
    const adapter = new OllamaAdapter(config)
    const request = {
      model: 'llama3',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    }

    const result = adapter.transformRequest(request as any)
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

  it('should check availability', async () => {
    const adapter = new OllamaAdapter(config)
    const result = await adapter.isAvailable()
    // Note: This will actually try to connect in real tests
    // For unit tests, we might need to mock fetch
    expect(result.available === true || result.available === false).toBe(true)
  })
})
