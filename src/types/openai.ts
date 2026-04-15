export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface TextContentPart {
  type: 'text'
  text: string
}

export interface ImageContentPart {
  type: 'image_url'
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' }
}

export type ContentPart = TextContentPart | ImageContentPart

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface ChatMessage {
  role: Role
  content: string | ContentPart[]
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface OpenAIChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  stop?: string | string[]
  tools?: ToolDefinition[]
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } }
  user?: string
}

export interface OpenAIChatChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: Role
      content?: string | null
      tool_calls?: Partial<ToolCall>[]
    }
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIChatResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIModelList {
  object: 'list'
  data: Array<{
    id: string
    object: 'model'
    created: number
    owned_by: string
  }>
}
