import type { OpenAIChatRequest } from '@/types/openai'
import type { BackendRequestFor } from '@/types/provider'
import type { AnthropicMessagesRequest, AnthropicMessage, AnthropicContentBlock } from '@/types/backend-types'

/**
 * Transform an OpenAI-format chat request into an Anthropic Messages API request.
 *
 * Key differences handled:
 *  - System messages are extracted to the top-level `system` field
 *  - Content parts are mapped from OpenAI format to Anthropic content blocks
 *  - max_tokens is required by Anthropic (defaults to 4096 if not provided)
 *  - Tool definitions are mapped to Anthropic tool format
 */
export function transformRequest(req: OpenAIChatRequest): BackendRequestFor<'claude'> {
  let systemMessage: string | undefined

  const messages: AnthropicMessage[] = []

  for (const msg of req.messages) {
    // Extract system messages to top-level field
    if (msg.role === 'system') {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n')
      systemMessage = systemMessage ? `${systemMessage}\n${text}` : text
      continue
    }

    // Map tool role to user with tool_result content blocks
    if (msg.role === 'tool' && msg.tool_call_id) {
      const content: AnthropicContentBlock[] = [
        {
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : '',
        },
      ]
      messages.push({ role: 'user', content })
      continue
    }

    // Map assistant messages with tool_calls to Anthropic tool_use blocks
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const content: AnthropicContentBlock[] = []
      if (msg.content) {
        const text = typeof msg.content === 'string' ? msg.content : ''
        if (text) {
          content.push({ type: 'text', text })
        }
      }
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: safeParseJson(tc.function.arguments),
        })
      }
      messages.push({ role: 'assistant', content })
      continue
    }

    // Standard user/assistant messages
    const role = msg.role === 'user' ? 'user' : 'assistant'
    const content = mapContent(msg.content)
    messages.push({ role, content })
  }

  const body: AnthropicMessagesRequest = {
    model: req.model,
    messages,
    max_tokens: req.max_tokens ?? 4096,
    stream: req.stream ?? true,
    ...(systemMessage ? { system: systemMessage } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools && req.tools.length > 0
      ? {
          tools: req.tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }
      : {}),
  }

  return { provider: 'claude', body }
}

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    // Return as-is wrapped in object if not valid JSON, rather than throwing
    // which would be misclassified as a provider error and trip the circuit breaker
    return { raw: str }
  }
}

function mapContent(content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>): string | AnthropicContentBlock[] {
  if (typeof content === 'string') {
    return content
  }

  const blocks: AnthropicContentBlock[] = []
  for (const part of content) {
    if (part.type === 'text' && part.text) {
      blocks.push({ type: 'text', text: part.text })
    } else if (part.type === 'image_url' && part.image_url) {
      // Anthropic expects base64 images; pass URL as-is in a text block for now
      // Full base64 support would require fetching the image
      blocks.push({ type: 'text', text: `[image: ${part.image_url.url}]` })
    }
  }
  return blocks.length === 1 && blocks[0].type === 'text' ? (blocks[0] as { type: 'text'; text: string }).text : blocks
}
