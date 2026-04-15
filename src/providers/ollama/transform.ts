import type { OpenAIChatRequest } from '@/types/openai'
import type { BackendRequestFor } from '@/types/provider'
import type { OllamaGenerateRequest } from '@/types/backend-types'
import type { ProxyError } from '@/types/errors'

type TransformResult = BackendRequestFor<'ollama'> | ProxyError

export function transformRequest(req: OpenAIChatRequest): TransformResult {
  if (req.tools && req.tools.length > 0) {
    return {
      kind: 'not_implemented',
      provider: 'ollama',
      blocker: 'Tool calls are not supported by the Ollama adapter',
    }
  }

  const messages = req.messages.map((msg) => ({
    role: msg.role,
    content:
      typeof msg.content === 'string'
        ? msg.content
        : msg.content
            .map((part) => {
              if (part.type === 'text') return part.text
              return '[image]'
            })
            .join(' '),
  }))

  const body: OllamaGenerateRequest = {
    model: req.model,
    messages,
    stream: req.stream ?? true,
  }

  if (
    req.temperature !== undefined ||
    req.max_tokens !== undefined ||
    req.top_p !== undefined ||
    req.stop !== undefined
  ) {
    body.options = {}
    if (req.temperature !== undefined) body.options.temperature = req.temperature
    if (req.max_tokens !== undefined) body.options.num_predict = req.max_tokens
    if (req.top_p !== undefined) body.options.top_p = req.top_p
    if (req.stop !== undefined) {
      body.options.stop = Array.isArray(req.stop) ? req.stop : [req.stop]
    }
  }

  return { provider: 'ollama', body }
}
