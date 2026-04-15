import type { OpenAIChatRequest } from './openai'

export interface OllamaGenerateRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream: boolean
  options?: {
    temperature?: number
    num_predict?: number
    top_p?: number
    stop?: string[]
  }
  tools?: unknown[]
}

export interface AnthropicMessagesRequest {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  system?: string
  stream: boolean
  temperature?: number
  tools?: AnthropicTool[]
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export type OpenAIChatRequestRaw = OpenAIChatRequest
