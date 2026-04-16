import { describe, it, expect } from 'bun:test'
import { normalizeChunk } from '@/providers/openai-compat/normalize'

describe('normalizeChunk (OpenAI-compat)', () => {
  it('parses a valid OpenAI chunk', () => {
    const data = JSON.stringify({
      id: 'chatcmpl-123',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: { content: 'Hello' },
          finish_reason: null,
        },
      ],
    })

    const result = normalizeChunk(data, 'req-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('chatcmpl-123')
    expect(result!.model).toBe('gpt-4')
    expect(result!.choices[0].delta.content).toBe('Hello')
  })

  it('returns null for [DONE]', () => {
    const result = normalizeChunk('[DONE]', 'req-1')
    expect(result).toBeNull()
  })

  it('returns null for empty lines', () => {
    expect(normalizeChunk('', 'req-1')).toBeNull()
    expect(normalizeChunk('  ', 'req-1')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const result = normalizeChunk('not-json', 'req-1')
    expect(result).toBeNull()
  })

  it('uses requestId as fallback when id is missing', () => {
    const data = JSON.stringify({
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4',
      choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
    })

    const result = normalizeChunk(data, 'my-req-id')
    expect(result!.id).toBe('my-req-id')
  })
})
