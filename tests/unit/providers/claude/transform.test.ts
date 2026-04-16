import { describe, it, expect } from 'bun:test'
import { transformRequest } from '@/providers/claude/transform'

describe('transformRequest (Claude)', () => {
  it('transforms a basic chat request', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    }

    const result = transformRequest(req)
    expect(result.provider).toBe('claude')
    expect(result.body.model).toBe('claude-sonnet-4-20250514')
    expect(result.body.messages).toHaveLength(1)
    expect(result.body.messages[0].role).toBe('user')
    expect(result.body.messages[0].content).toBe('Hello')
  })

  it('extracts system message to top-level', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hi' },
      ],
    }

    const result = transformRequest(req)
    expect(result.body.system).toBe('You are a helpful assistant.')
    expect(result.body.messages).toHaveLength(1)
    expect(result.body.messages[0].role).toBe('user')
  })

  it('defaults max_tokens to 4096', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user' as const, content: 'Hi' }],
    }

    const result = transformRequest(req)
    expect(result.body.max_tokens).toBe(4096)
  })

  it('maps temperature', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user' as const, content: 'Hi' }],
      temperature: 0.5,
    }

    const result = transformRequest(req)
    expect(result.body.temperature).toBe(0.5)
  })

  it('maps max_tokens when provided', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user' as const, content: 'Hi' }],
      max_tokens: 1024,
    }

    const result = transformRequest(req)
    expect(result.body.max_tokens).toBe(1024)
  })

  it('maps tools to Anthropic format', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user' as const, content: 'Hi' }],
      tools: [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get the weather',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    }

    const result = transformRequest(req)
    expect(result.body.tools).toBeDefined()
    expect(result.body.tools).toHaveLength(1)
    expect(result.body.tools![0].name).toBe('get_weather')
    expect(result.body.tools![0].description).toBe('Get the weather')
  })

  it('concatenates multiple system messages', () => {
    const req = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'system' as const, content: 'First instruction.' },
        { role: 'system' as const, content: 'Second instruction.' },
        { role: 'user' as const, content: 'Hello' },
      ],
    }

    const result = transformRequest(req)
    expect(result.body.system).toBe('First instruction.\nSecond instruction.')
  })
})
