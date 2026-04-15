import { describe, it, expect, beforeEach } from 'bun:test'
import { CredentialCache } from '@/auth/cache'
import { ResolvedCredential } from '@/auth/credential'

describe('CredentialCache', () => {
  let cache: CredentialCache

  beforeEach(() => {
    cache = new CredentialCache(60_000)
  })

  it('stores and retrieves a credential', () => {
    const cred = new ResolvedCredential('sk-test')
    cache.set('ollama', cred)
    const result = cache.get('ollama')
    expect(result).not.toBeNull()
    expect(result!.toJSON()).toEqual({})
  })

  it('returns null for missing key', () => {
    expect(cache.get('claude')).toBeNull()
  })

  it('expires entries after TTL', () => {
    const shortCache = new CredentialCache(10)
    const cred = new ResolvedCredential('sk-test')
    shortCache.set('ollama', cred)
    expect(shortCache.get('ollama')).not.toBeNull()
    const start = Date.now() + 50
    while (Date.now() < start) {}
    expect(shortCache.get('ollama')).toBeNull()
  })

  it('invalidate removes a specific entry', () => {
    const cred = new ResolvedCredential('sk-test')
    cache.set('ollama', cred)
    cache.invalidate('ollama')
    expect(cache.get('ollama')).toBeNull()
  })

  it('invalidate is a no-op for missing key', () => {
    cache.invalidate('nonexistent')
  })

  it('clear removes all entries', () => {
    cache.set('ollama', new ResolvedCredential('sk-1'))
    cache.set('claude', new ResolvedCredential('sk-2'))
    cache.clear()
    expect(cache.get('ollama')).toBeNull()
    expect(cache.get('claude')).toBeNull()
  })
})
