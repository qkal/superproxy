import { describe, it, expect } from 'bun:test'
import { normalizeChunk } from '@/providers/ollama/normalize'

describe('normalizeChunk (Ollama)', () => {
  it('converts an Ollama SSE line to OpenAIChatChunk', () => {
    const line =
      '{"model":"llama3.2","created_at":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":"Hello"},"done":false}'
    const result = normalizeChunk(line, 'chatcmpl-123')
    expect(result!.model).toBe('llama3.2')
    expect(result!.choices).toHaveLength(1)
    expect(result!.choices[0]!.delta.content).toBe('Hello')
    expect(result!.choices[0]!.finish_reason).toBeNull()
  })

  it('maps done:true to finish_reason stop', () => {
    const line =
      '{"model":"llama3.2","created_at":"2025-01-01T00:00:02Z","message":{"role":"assistant","content":""},"done":true}'
    const result = normalizeChunk(line, 'chatcmpl-123')
    expect(result!.choices[0]!.finish_reason).toBe('stop')
  })

  it('returns null for empty lines', () => {
    expect(normalizeChunk('', 'chatcmpl-123')).toBeNull()
  })

  it('returns error chunk for malformed JSON', () => {
    const result = normalizeChunk('not json', 'chatcmpl-123')
    expect(result).not.toBeNull()
    expect(result!.choices[0]!.finish_reason).toBe('error')
  })

  it('uses provided request ID', () => {
    const line =
      '{"model":"llama3.2","created_at":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":"Hi"},"done":false}'
    const result = normalizeChunk(line, 'my-request-id')
    expect(result!.id).toBe('my-request-id')
  })
})
