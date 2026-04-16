import type { OpenAIChatChunk } from '@/types/openai'

/**
 * Per-stream usage cache: stores input token counts from message_start
 * so they can be included in the final message_delta usage report.
 */
const usageCache = new Map<string, { promptTokens: number }>()

/** Clean up cached usage for a given requestId (call from adapter's finally block). */
export function clearUsageCache(requestId: string): void {
  usageCache.delete(requestId)
}

/**
 * Normalize an Anthropic SSE event into an OpenAI-compatible chat chunk.
 *
 * Anthropic SSE events have the format:
 *   event: <event_type>
 *   data: <json>
 *
 * Key event types:
 *  - message_start: contains model, usage info
 *  - content_block_start: new content block (text or tool_use)
 *  - content_block_delta: incremental text or tool input delta
 *  - content_block_stop: end of a content block
 *  - message_delta: end_reason, final usage
 *  - message_stop: end of message
 */
export function normalizeEvent(
  eventType: string,
  data: string,
  requestId: string,
  model: string,
): OpenAIChatChunk | null {
  const trimmed = data.trim()
  if (!trimmed) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  switch (eventType) {
    case 'message_start': {
      // Cache input usage for this stream so message_delta can report accurate totals
      const message = parsed.message as Record<string, unknown> | undefined
      const usage = message?.usage as Record<string, number> | undefined
      if (usage) {
        const promptTokens = usage.input_tokens ?? usage.input_tokens_approx ?? 0
        usageCache.set(requestId, { promptTokens })
      }
      return null
    }

    case 'content_block_delta': {
      const delta = parsed.delta as Record<string, unknown> | undefined
      if (!delta) return null

      if (delta.type === 'text_delta') {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: { content: delta.text as string },
              finish_reason: null,
            },
          ],
        }
      }

      if (delta.type === 'input_json_delta') {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    function: { name: '', arguments: delta.partial_json as string },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        }
      }

      return null
    }

    case 'content_block_start': {
      const contentBlock = parsed.content_block as Record<string, unknown> | undefined
      if (!contentBlock) return null

      if (contentBlock.type === 'text') {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '' },
              finish_reason: null,
            },
          ],
        }
      }

      if (contentBlock.type === 'tool_use') {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: contentBlock.id as string,
                    type: 'function',
                    function: {
                      name: contentBlock.name as string,
                      arguments: '',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        }
      }

      return null
    }

    case 'message_delta': {
      const delta = parsed.delta as Record<string, unknown> | undefined
      const stopReason = delta?.stop_reason as string | undefined

      let finishReason: 'stop' | 'length' | 'tool_calls' | null = null
      if (stopReason === 'end_turn' || stopReason === 'stop_sequence') finishReason = 'stop'
      else if (stopReason === 'max_tokens') finishReason = 'length'
      else if (stopReason === 'tool_use') finishReason = 'tool_calls'

      if (finishReason) {
        const usage = parsed.usage as Record<string, number> | undefined
        const cached = usageCache.get(requestId)
        const promptTokens = cached?.promptTokens ?? 0
        const completionTokens = usage?.output_tokens ?? 0

        // Clean up cached entry
        usageCache.delete(requestId)

        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: finishReason,
            },
          ],
          ...(usage || cached
            ? {
                usage: {
                  prompt_tokens: promptTokens,
                  completion_tokens: completionTokens,
                  total_tokens: promptTokens + completionTokens,
                },
              }
            : {}),
        }
      }
      return null
    }

    default:
      return null
  }
}
