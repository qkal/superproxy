import { describe, it, expect } from 'bun:test'
import type { ProxyError } from '@/types/errors'

describe('ProxyError', () => {
  it('no_adapter_found has model field', () => {
    const err: ProxyError = { kind: 'no_adapter_found', model: 'gpt-4' }
    expect(err.kind).toBe('no_adapter_found')
    expect(err.model).toBe('gpt-4')
  })

  it('credential_missing has provider and hint', () => {
    const err: ProxyError = {
      kind: 'credential_missing',
      provider: 'claude',
      hint: 'check ~/.claude/credentials.json',
    }
    expect(err.kind).toBe('credential_missing')
    expect(err.provider).toBe('claude')
  })

  it('upstream_rate_limited carries retryAfterMs', () => {
    const err: ProxyError = {
      kind: 'upstream_rate_limited',
      provider: 'claude',
      retryAfterMs: 5000,
    }
    expect(err.retryAfterMs).toBe(5000)
  })

  it('circuit_open carries cooldownEndsAt', () => {
    const now = Date.now()
    const err: ProxyError = { kind: 'circuit_open', provider: 'ollama', cooldownEndsAt: now }
    expect(err.cooldownEndsAt).toBe(now)
  })

  it('body_too_large has maxBytes and actualBytes', () => {
    const err: ProxyError = { kind: 'body_too_large', maxBytes: 4194304, actualBytes: 5000000 }
    expect(err.maxBytes).toBe(4194304)
    expect(err.actualBytes).toBe(5000000)
  })

  it('request_invalid has issues array', () => {
    const err: ProxyError = { kind: 'request_invalid', issues: [] }
    expect(err.kind).toBe('request_invalid')
    expect(err.issues).toEqual([])
  })

  it('port_in_use carries port', () => {
    const err: ProxyError = { kind: 'port_in_use', port: 4141 }
    expect(err.port).toBe(4141)
  })
})
