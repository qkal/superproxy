import { describe, it, expect } from 'bun:test'
import { normalizeEvent } from '@/providers/claude/normalize'

describe('normalizeEvent (Claude)', () => {
  it('converts content_block_delta text_delta to OpenAI chunk', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello' },
    })

    const result = normalizeEvent('content_block_delta', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].delta.content).toBe('Hello')
    expect(result!.choices[0].finish_reason).toBeNull()
    expect(result!.model).toBe('claude-sonnet-4-20250514')
  })

  it('converts content_block_start text to role chunk', () => {
    const data = JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })

    const result = normalizeEvent('content_block_start', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].delta.role).toBe('assistant')
  })

  it('converts content_block_start tool_use to tool call chunk', () => {
    const data = JSON.stringify({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_123', name: 'get_weather' },
    })

    const result = normalizeEvent('content_block_start', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].delta.tool_calls).toBeDefined()
    expect(result!.choices[0].delta.tool_calls![0].id).toBe('toolu_123')
    expect(result!.choices[0].delta.tool_calls![0].function!.name).toBe('get_weather')
  })

  it('converts message_delta end_turn to stop finish_reason', () => {
    const data = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 42 },
    })

    const result = normalizeEvent('message_delta', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].finish_reason).toBe('stop')
    expect(result!.usage).toBeDefined()
    expect(result!.usage!.completion_tokens).toBe(42)
  })

  it('converts message_delta max_tokens to length finish_reason', () => {
    const data = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens' },
    })

    const result = normalizeEvent('message_delta', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].finish_reason).toBe('length')
  })

  it('converts message_delta tool_use to tool_calls finish_reason', () => {
    const data = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'tool_use' },
    })

    const result = normalizeEvent('message_delta', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].finish_reason).toBe('tool_calls')
  })

  it('returns null for unknown event types', () => {
    const data = JSON.stringify({ type: 'ping' })
    const result = normalizeEvent('ping', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).toBeNull()
  })

  it('returns null for empty data', () => {
    expect(normalizeEvent('content_block_delta', '', 'req-1', 'claude-sonnet-4-20250514')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(normalizeEvent('content_block_delta', 'not-json', 'req-1', 'claude-sonnet-4-20250514')).toBeNull()
  })

  it('converts input_json_delta to tool call argument chunk', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"loc' },
    })

    const result = normalizeEvent('content_block_delta', data, 'req-1', 'claude-sonnet-4-20250514')
    expect(result).not.toBeNull()
    expect(result!.choices[0].delta.tool_calls).toBeDefined()
    expect(result!.choices[0].delta.tool_calls![0].function!.arguments).toBe('{"loc')
  })
})
