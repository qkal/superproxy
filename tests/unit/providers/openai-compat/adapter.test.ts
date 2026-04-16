import { describe, it, expect } from 'bun:test'
import { OpenAICompatAdapter } from '@/providers/openai-compat/adapter'

describe('OpenAICompatAdapter', () => {
  const config = {
    enabled: true,
    baseUrl: 'https://api.example.com',
    apiKey: 'test-key-123',
  }

  it('should have correct id and capabilities', () => {
    const adapter = new OpenAICompatAdapter(config)
    expect(adapter.id).toBe('openai-compat')
    expect(adapter.capabilities).toContain('chat')
    expect(adapter.capabilities).toContain('streaming')
    expect(adapter.capabilities).toContain('tools')
    expect(adapter.capabilities).toContain('vision')
  })

  it('should transform request as passthrough', () => {
    const adapter = new OpenAICompatAdapter(config)
    const req = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    }
    const result = adapter.transformRequest(req)
    expect(result.provider).toBe('openai-compat')
    expect(result.body.model).toBe('gpt-4')
  })

  it('should resolve credentials from config apiKey', async () => {
    const adapter = new OpenAICompatAdapter(config)
    const result = await adapter.resolveCredentials()
    expect(result.ok).toBe(true)
  })

  it('should check availability (network error)', async () => {
    const adapter = new OpenAICompatAdapter({
      enabled: true,
      baseUrl: 'http://localhost:1',
    })
    const result = await adapter.isAvailable()
    expect(result.available).toBe(false)
    if (!result.available) {
      expect(result.reason).toBeDefined()
    }
  })
})
