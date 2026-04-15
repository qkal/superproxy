import { z } from 'zod'

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

// Zod Schemas for validation
const RoleSchema = z.enum(['system', 'user', 'assistant', 'tool'])

const TextContentPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

const ImageContentPartSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(['auto', 'low', 'high']).optional(),
  }),
})

const ContentPartSchema = z.union([TextContentPartSchema, ImageContentPartSchema])

const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
})

const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.unknown()),
  }),
})

const ChatMessageSchema = z.object({
  role: RoleSchema,
  content: z.union([z.string(), z.array(ContentPartSchema)]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
})

export const OpenAIChatRequestSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  messages: z.array(ChatMessageSchema).min(1, 'At least one message is required'),
  stream: z.boolean().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  tools: z.array(ToolDefinitionSchema).optional(),
  tool_choice: z
    .union([
      z.enum(['none', 'auto', 'required']),
      z.object({
        type: z.literal('function'),
        function: z.object({ name: z.string() }),
      }),
    ])
    .optional(),
  user: z.string().optional(),
})

export type OpenAIChatRequestInput = z.input<typeof OpenAIChatRequestSchema>

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
