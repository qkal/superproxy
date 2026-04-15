import type { OpenAIChatChunk } from '@/types/openai'

export interface SSEOptions {
  keepAliveIntervalMs?: number
  onAbort?: () => void
}

export function createSSEStream(
  chunks: AsyncIterable<OpenAIChatChunk>,
  options: SSEOptions = {},
): ReadableStream<Uint8Array> {
  const keepAliveIntervalMs = options.keepAliveIntervalMs ?? 15_000
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let keepAliveTimer: ReturnType<typeof setInterval> | null = null

      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {
          if (keepAliveTimer) clearInterval(keepAliveTimer)
        }
      }, keepAliveIntervalMs)

      try {
        for await (const chunk of chunks) {
          const data = JSON.stringify(chunk)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          if (options.onAbort) options.onAbort()
        } else {
          throw e
        }
      } finally {
        if (keepAliveTimer) clearInterval(keepAliveTimer)
        try {
          controller.close()
        } catch {}
      }
    },
  })
}

export function createBufferedResponse(chunks: AsyncIterable<OpenAIChatChunk>): {
  response: Promise<Record<string, unknown>>
  signal: AbortSignal
} {
  const controller = new AbortController()
  const chunksArray: OpenAIChatChunk[] = []

  const response = (async () => {
    for await (const chunk of chunks) {
      chunksArray.push(chunk)
    }

    if (chunksArray.length === 0) {
      throw new Error('No chunks received')
    }

    const lastChunk = chunksArray[chunksArray.length - 1]!
    let contentAccumulator = ''

    for (const chunk of chunksArray) {
      for (const choice of chunk.choices) {
        if (choice.delta.content) {
          contentAccumulator += choice.delta.content
        }
      }
    }

    return {
      id: lastChunk.id,
      object: 'chat.completion',
      created: lastChunk.created,
      model: lastChunk.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: contentAccumulator || null,
          },
          finish_reason: lastChunk.choices[0]?.finish_reason ?? 'stop',
        },
      ],
      usage: lastChunk.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    }
  })()

  return { response, signal: controller.signal }
}
