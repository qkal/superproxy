import { describe, it, expect } from 'bun:test'
import { ProviderRegistry } from '@/providers/registry'
import type { ProviderAdapter } from '@/types/provider'
import type { CircuitBreakerConfig } from '@/types/config'

const mockAdapter = (id: string): ProviderAdapter => ({
  id: id as any,
  capabilities: ['chat'],
  resolveCredentials: async () => ({ ok: true, credential: {} as any }),
  isAvailable: async () => ({ available: true, latencyMs: 10 }),
  transformRequest: () => ({ provider: 'ollama', body: {} as any }),
  streamCompletion: async function* () {
    yield {} as any
  },
})

const breakerConfig: CircuitBreakerConfig = {
  failureThreshold: 3,
  windowMs: 60000,
  cooldownMs: 30000,
}

describe('ProviderRegistry map access', () => {
  it('should expose adapters map', () => {
    const registry = new ProviderRegistry(breakerConfig)
    registry.register(mockAdapter('ollama'))

    const adapters = registry.adapters
    expect(adapters.get('ollama')).toBeDefined()
  })

  it('should expose breakers map', () => {
    const registry = new ProviderRegistry(breakerConfig)
    registry.register(mockAdapter('ollama'))

    const breakers = registry.breakers
    expect(breakers.get('ollama')).toBeDefined()
  })
})
