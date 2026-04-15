import { describe, it, expect } from 'bun:test'
import { transformRequest } from '@/providers/ollama/transform'
import type { OpenAIChatRequest } from '@/types/openai'

describe('transformRequest (Ollama)', () => {
  it('transforms a basic chat request', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
      stream: true,
    }
    const result = transformRequest(req)
    expect(result.provider).toBe('ollama')
    if ('body' in result) {
      expect(result.body.model).toBe('llama3.2')
      expect(result.body.messages).toHaveLength(2)
      expect(result.body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' })
      expect(result.body.stream).toBe(true)
    }
  })

  it('maps temperature to options', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
      temperature: 0.7,
    }
    const result = transformRequest(req)
    if ('body' in result) {
      expect(result.body.options?.temperature).toBe(0.7)
    }
  })

  it('maps max_tokens to num_predict', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
      max_tokens: 100,
    }
    const result = transformRequest(req)
    if ('body' in result) {
      expect(result.body.options?.num_predict).toBe(100)
    }
  })

  it('maps top_p to options', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
      top_p: 0.9,
    }
    const result = transformRequest(req)
    if ('body' in result) {
      expect(result.body.options?.top_p).toBe(0.9)
    }
  })

  it('maps stop to options', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
      stop: ['END', 'STOP'],
    }
    const result = transformRequest(req)
    if ('body' in result) {
      expect(result.body.options?.stop).toEqual(['END', 'STOP'])
    }
  })

  it('returns not_implemented ProxyError when tools are present', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
      tools: [{ type: 'function', function: { name: 'get_weather', parameters: {} } }],
    }
    const result = transformRequest(req)
    expect(result.kind).toBe('not_implemented')
    if (result.kind === 'not_implemented') {
      expect(result.provider).toBe('ollama')
    }
  })

  it('handles messages with string content', () => {
    const req: OpenAIChatRequest = {
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Just a string' }],
      stream: true,
    }
    const result = transformRequest(req)
    if ('body' in result) {
      expect(result.body.messages[0].content).toBe('Just a string')
    }
  })
})
