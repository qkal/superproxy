import type { OpenAIChatRequest, OpenAIChatChunk } from './openai'
import type {
  OllamaGenerateRequest,
  AnthropicMessagesRequest,
  OpenAIChatRequestRaw,
} from './backend-types'
import type { ResolvedCredential } from '@/auth/credential'
import type { CredentialResult } from '@/auth/types'

export type ProviderId = 'ollama' | 'claude' | 'codex' | 'openai-compat' | 'windsurf'

export type Capability = 'chat' | 'streaming' | 'tools' | 'vision' | 'embeddings'

export type BackendRequestFor<Id extends ProviderId> = Id extends 'ollama'
  ? { provider: 'ollama'; body: OllamaGenerateRequest }
  : Id extends 'claude'
    ? { provider: 'claude'; body: AnthropicMessagesRequest }
    : Id extends 'codex'
      ? { provider: 'codex'; body: OpenAIChatRequestRaw }
      : Id extends 'openai-compat'
        ? { provider: 'openai-compat'; body: OpenAIChatRequestRaw }
        : Id extends 'windsurf'
          ? { provider: 'windsurf'; body: never }
          : never

export type BackendRequest = BackendRequestFor<ProviderId>

export type HealthResult =
  | { available: true; latencyMs: number }
  | { available: false; reason: string }

export interface ProviderAdapter<Id extends ProviderId = ProviderId> {
  readonly id: Id
  readonly capabilities: ReadonlyArray<Capability>
  resolveCredentials(): Promise<CredentialResult>
  isAvailable(): Promise<HealthResult>
  transformRequest(req: OpenAIChatRequest): BackendRequestFor<Id>
  streamCompletion(
    req: BackendRequestFor<Id>,
    credential: ResolvedCredential,
    signal: AbortSignal,
  ): AsyncIterable<OpenAIChatChunk>
}
