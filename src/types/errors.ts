import type { ZodIssue } from 'zod'
import type { ProviderId } from './provider'

export type ProxyError =
  | { kind: 'no_adapter_found'; model: string }
  | { kind: 'all_providers_failed'; chain: ProviderId[]; lastError: ProxyError }
  | { kind: 'credential_missing'; provider: ProviderId; hint: string }
  | { kind: 'credential_parse_failed'; provider: ProviderId; hint: string }
  | { kind: 'credential_permission'; provider: ProviderId; path: string; actualMode: string }
  | { kind: 'upstream_error'; provider: ProviderId; status: number; requestId: string }
  | { kind: 'upstream_rate_limited'; provider: ProviderId; retryAfterMs: number | null }
  | { kind: 'stream_interrupted'; provider: ProviderId; requestId: string }
  | { kind: 'circuit_open'; provider: ProviderId; cooldownEndsAt: number }
  | {
      kind: 'request_timeout'
      provider: ProviderId
      timeoutMs: number
      phase: 'connect' | 'first_byte' | 'total'
    }
  | { kind: 'body_too_large'; maxBytes: number; actualBytes: number }
  | { kind: 'config_invalid'; field: string; reason: string }
  | { kind: 'request_invalid'; issues: ZodIssue[] }
  | { kind: 'not_implemented'; provider: ProviderId; blocker: string }
  | { kind: 'port_in_use'; port: number }
