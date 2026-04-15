import { describe, it, expect } from 'bun:test'
import { ResolvedCredential } from '@/auth/credential'
import type { CredentialResult, CredentialResolver } from '@/auth/types'

describe('ResolvedCredential', () => {
  it('wraps a string value', () => {
    const cred = new ResolvedCredential('sk-test-key-123')
    expect(cred).toBeDefined()
  })

  it('toJSON returns empty object', () => {
    const cred = new ResolvedCredential('sk-test-key-123')
    expect(JSON.stringify(cred)).toBe('{}')
  })

  it('Object.keys returns empty array', () => {
    const cred = new ResolvedCredential('sk-test-key-123')
    expect(Object.keys(cred)).toEqual([])
  })

  it('applyToRequest sets Authorization Bearer header', () => {
    const cred = new ResolvedCredential('sk-test-key-123')
    const headers = new Headers()
    cred.applyToRequest(headers)
    expect(headers.get('Authorization')).toBe('Bearer sk-test-key-123')
  })

  it('applyAnthropicHeaders sets x-api-key and anthropic-version', () => {
    const cred = new ResolvedCredential('sk-ant-key')
    const headers = new Headers()
    cred.applyAnthropicHeaders(headers)
    expect(headers.get('x-api-key')).toBe('sk-ant-key')
    expect(headers.get('anthropic-version')).toBe('2023-06-01')
  })

  it('throws on empty string', () => {
    expect(() => new ResolvedCredential('')).toThrow()
  })

  it('throws on whitespace-only string', () => {
    expect(() => new ResolvedCredential('   ')).toThrow()
  })
})

describe('CredentialResult', () => {
  it('ok result carries credential', () => {
    const cred = new ResolvedCredential('sk-key')
    const result: CredentialResult = { ok: true, credential: cred }
    expect(result.ok).toBe(true)
    expect(result.credential).toBe(cred)
  })

  it('error result carries error kind and hint', () => {
    const result: CredentialResult = {
      ok: false,
      error: 'not_found',
      hint: 'check ~/.claude/credentials.json',
    }
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('not_found')
      expect(result.hint).toBe('check ~/.claude/credentials.json')
    }
  })
})

describe('CredentialResolver', () => {
  it('interface requires resolve method returning CredentialResult', async () => {
    const resolver: CredentialResolver = {
      async resolve() {
        return { ok: true, credential: new ResolvedCredential('key') }
      },
    }
    const result = await resolver.resolve()
    expect(result.ok).toBe(true)
  })
})
