import { describe, it, expect } from 'bun:test'
import { ClaudeAdapter } from '@/providers/claude/adapter'

describe('ClaudeAdapter', () => {
  const config = {
    enabled: true,
    baseUrl: 'https://api.anthropic.com',
  }

  it('should have correct id and capabilities', () => {
    const adapter = new ClaudeAdapter(config)
    expect(adapter.id).toBe('claude')
    expect(adapter.capabilities).toContain('chat')
    expect(adapter.capabilities).toContain('streaming')
    expect(adapter.capabilities).toContain('tools')
    expect(adapter.capabilities).toContain('vision')
  })

  it('should transform request', () => {
    const adapter = new ClaudeAdapter(config)
    const result = adapter.transformRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    })
    expect(result.provider).toBe('claude')
    expect(result.body.model).toBe('claude-sonnet-4-20250514')
    expect(result.body.max_tokens).toBe(4096)
  })

  it('should extract system message during transform', () => {
    const adapter = new ClaudeAdapter(config)
    const result = adapter.transformRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
    })
    expect(result.body.system).toBe('You are helpful.')
    expect(result.body.messages).toHaveLength(1)
  })

  it('should check availability (network error)', async () => {
    const adapter = new ClaudeAdapter({
      enabled: true,
      baseUrl: 'http://localhost:1',
    })
    const result = await adapter.isAvailable()
    expect(result.available).toBe(false)
    expect('reason' in result && result.reason).toBeDefined()
  })

  it('should fail credential resolution without ANTHROPIC_API_KEY', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const adapter = new ClaudeAdapter({ enabled: true })
      const result = await adapter.resolveCredentials()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('not_found')
      }
    } finally {
      if (originalKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalKey
      }
    }
  })
})
