import { ResolvedCredential } from './credential'

interface CacheEntry {
  credential: ResolvedCredential
  expiresAt: number
}

export class CredentialCache {
  readonly #ttlMs: number
  readonly #store = new Map<string, CacheEntry>()

  constructor(ttlMs: number) {
    this.#ttlMs = ttlMs
  }

  get(providerId: string): ResolvedCredential | null {
    const entry = this.#store.get(providerId)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(providerId)
      return null
    }
    return entry.credential
  }

  set(providerId: string, credential: ResolvedCredential): void {
    this.#store.set(providerId, {
      credential,
      expiresAt: Date.now() + this.#ttlMs,
    })
  }

  invalidate(providerId: string): void {
    this.#store.delete(providerId)
  }

  clear(): void {
    this.#store.clear()
  }
}
