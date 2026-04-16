import type { OpenAIChatChunk } from '@/types/openai'

/**
 * Normalize an SSE data line from an OpenAI-compatible endpoint into an OpenAIChatChunk.
 * Expects the raw `data:` payload (the JSON string after "data: ").
 */
export function normalizeChunk(data: string, requestId: string): OpenAIChatChunk | null {
  const trimmed = data.trim()
  if (!trimmed || trimmed === '[DONE]') {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>

    // Already in OpenAI chunk format — just ensure the id is set
    return {
      id: (parsed.id as string) || requestId,
      object: 'chat.completion.chunk',
      created: (parsed.created as number) || Math.floor(Date.now() / 1000),
      model: (parsed.model as string) || 'unknown',
      choices: (parsed.choices as OpenAIChatChunk['choices']) || [],
      ...(parsed.usage ? { usage: parsed.usage as OpenAIChatChunk['usage'] } : {}),
    }
  } catch {
    return null
  }
}
