import { describe, it, expect } from 'bun:test'
import { transformRequest } from '@/providers/openai-compat/transform'

describe('transformRequest (OpenAI-compat)', () => {
  it('passes through a basic chat request', () => {
    const req = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    }

    const result = transformRequest(req)
    expect(result.provider).toBe('openai-compat')
    expect(result.body.model).toBe('gpt-4')
    expect(result.body.messages).toHaveLength(1)
    expect(result.body.messages[0].content).toBe('Hello')
  })

  it('preserves optional parameters', () => {
    const req = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
      temperature: 0.7,
      max_tokens: 100,
      top_p: 0.9,
      stream: true,
    }

    const result = transformRequest(req)
    expect(result.body.temperature).toBe(0.7)
    expect(result.body.max_tokens).toBe(100)
    expect(result.body.top_p).toBe(0.9)
    expect(result.body.stream).toBe(true)
  })

  it('preserves tools when present', () => {
    const req = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
      tools: [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    }

    const result = transformRequest(req)
    expect(result.body.tools).toBeDefined()
    expect(result.body.tools).toHaveLength(1)
  })
})
