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

  it('should reject invalid temperature range', () => {
    const invalid = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 3,
    }
    const result = OpenAIChatRequestSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
