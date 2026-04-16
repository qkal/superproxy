import { describe, it, expect } from 'bun:test'
import type {
  Role,
  OpenAIChatRequest,
  OpenAIModelList,
  TextContentPart,
  ImageContentPart,
  ToolCall,
} from '@/types/openai'

describe('OpenAI types', () => {
  it('Role is a union of valid roles', () => {
    const roles: Role[] = ['system', 'user', 'assistant', 'tool']
    expect(roles).toHaveLength(4)
  })

  it('TextContentPart has type text', () => {
    const part: TextContentPart = { type: 'text', text: 'hello' }
    expect(part.type).toBe('text')
  })

  it('ImageContentPart has type image_url', () => {
    const part: ImageContentPart = {
      type: 'image_url',
      image_url: { url: 'https://example.com/img.png' },
    }
    expect(part.type).toBe('image_url')
  })

  it('OpenAIChatRequest has required fields', () => {
    const req: OpenAIChatRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
    }
    expect(req.model).toBe('gpt-4')
    expect(req.messages).toHaveLength(1)
    expect(req.stream).toBeUndefined()
  })

  it('OpenAIChatRequest with stream and options', () => {
    const req: OpenAIChatRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    }
    expect(req.stream).toBe(true)
    expect(req.temperature).toBe(0.7)
  })

  it('ToolCall has id, type, function', () => {
    const tc: ToolCall = {
      id: 'call_123',
      type: 'function',
      function: { name: 'get_weather', arguments: '{}' },
    }
    expect(tc.id).toBe('call_123')
    expect(tc.function.name).toBe('get_weather')
  })

  it('OpenAIModelList shape', () => {
    const list: OpenAIModelList = {
      object: 'list',
      data: [{ id: 'llama3.2', object: 'model', created: 1700000000, owned_by: 'ollama' }],
    }
    expect(list.object).toBe('list')
    expect(list.data).toHaveLength(1)
  })
})
