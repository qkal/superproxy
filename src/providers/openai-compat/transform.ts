import type { OpenAIChatRequest } from '@/types/openai'
import type { BackendRequestFor } from '@/types/provider'

/**
 * OpenAI-compatible transform is a passthrough — the input is already
 * in OpenAI format, so we just wrap it for the backend request type.
 */
export function transformRequest(req: OpenAIChatRequest): BackendRequestFor<'openai-compat'> {
  return { provider: 'openai-compat', body: req }
}
