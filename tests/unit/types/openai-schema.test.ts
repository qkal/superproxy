import { describe, it, expect } from 'bun:test'
import { OpenAIChatRequestSchema } from '@/types/openai'

describe('OpenAIChatRequestSchema', () => {
  it('should validate a valid request', () => {
    const valid = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    }
    expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
  })

  it('should reject missing model', () => {
    const invalid = { messages: [{ role: 'user', content: 'Hello' }] }
    const result = OpenAIChatRequestSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('model')
    }
  })

  it('should reject invalid temperature range (too high)', () => {
    const invalid = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 3,
    }
    const result = OpenAIChatRequestSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('temperature')
      expect(result.error.issues[0].message).toContain('2')
    }
  })

  it('should reject invalid temperature range (too low)', () => {
    const invalid = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: -0.1,
    }
    const result = OpenAIChatRequestSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('temperature')
      expect(result.error.issues[0].message).toContain('0')
    }
  })

  describe('content parts', () => {
    it('should validate text content part', () => {
      const valid = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate image content part', () => {
      const valid = {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.png' },
              },
            ],
          },
        ],
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate image content part with detail', () => {
      const valid = {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.png', detail: 'high' },
              },
            ],
          },
        ],
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate mixed text and image content parts', () => {
      const valid = {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.png' },
              },
            ],
          },
        ],
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })
  })

  describe('tools', () => {
    it('should validate request with tools', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get the current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate tool_choice as string enum', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {},
            },
          },
        ],
        tool_choice: 'auto',
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate tool_choice as object', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {},
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'get_weather' },
        },
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate tool_choice: none', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {},
            },
          },
        ],
        tool_choice: 'none',
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate tool_choice: required', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {},
            },
          },
        ],
        tool_choice: 'required',
        stream: false,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })
  })

  describe('optional parameters', () => {
    it('should validate max_tokens', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate top_p', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: 0.9,
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate stop as string', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stop: '\n',
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate stop as array of strings', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stop: ['\n', 'stop'],
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should validate user', () => {
      const valid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        user: 'user-123',
      }
      expect(() => OpenAIChatRequestSchema.parse(valid)).not.toThrow()
    })

    it('should reject invalid max_tokens (zero)', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 0,
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('max_tokens')
      }
    })

    it('should reject invalid max_tokens (negative)', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: -1,
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('max_tokens')
      }
    })

    it('should reject invalid top_p (too high)', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: 1.1,
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('top_p')
      }
    })

    it('should reject invalid top_p (negative)', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: -0.1,
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('top_p')
      }
    })
  })

  describe('negative tests', () => {
    it('should reject invalid role', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'invalid_role', content: 'Hello' }],
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('role')
      }
    })

    it('should reject empty messages array', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [],
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one message is required')
      }
    })

    it('should reject malformed content part (missing required field)', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text' }], // Missing 'text' field
          },
        ],
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('content')
      }
    })

    it('should reject malformed image content part (missing url)', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: {} }], // Missing 'url' field
          },
        ],
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('content')
      }
    })

    it('should reject empty model string', () => {
      const invalid = {
        model: '',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Model is required')
      }
    })

    it('should reject invalid tool_choice string', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {},
            },
          },
        ],
        tool_choice: 'invalid_choice',
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('tool_choice')
      }
    })

    it('should reject malformed tool definition', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            // Missing 'function' field
          },
        ],
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('tools')
      }
    })

    it('should reject malformed tool_choice object', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {},
            },
          },
        ],
        tool_choice: {
          type: 'function',
          // Missing 'function' object
        },
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('tool_choice')
      }
    })

    it('should reject invalid stream type', () => {
      const invalid = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: 'true', // Should be boolean
      }
      const result = OpenAIChatRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('stream')
      }
    })
  })
})
