import type { OpenAIChatChunk } from '@/types/openai'

export function normalizeChunk(line: string, requestId: string): OpenAIChatChunk | null {
  if (!line || line.trim() === '') {
    return null
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(line)
  } catch {
    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'unknown',
      choices: [
        {
          index: 0,
          delta: { content: null },
          finish_reason: 'error',
        },
      ],
    }
  }

  const model = (parsed.model as string) || 'unknown'
  const message = parsed.message as { role?: string; content?: string } | undefined
  const done = parsed.done as boolean | undefined
  const content = message?.content ?? null
  const role = message?.role as 'assistant' | undefined

  return {
    id: requestId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          ...(role ? { role } : {}),
          content,
        },
        finish_reason: done ? 'stop' : null,
      },
    ],
  }
}
