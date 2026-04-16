import { describe, it, expect } from 'bun:test'
import { Router } from '@/router/router'
import { CircuitBreaker } from '@/router/circuit-breaker'
import type { ProviderAdapter } from '@/types/provider'
import type { RoutingConfig, CircuitBreakerConfig } from '@/types/config'

const mockAdapter = (id: string): ProviderAdapter => ({
  id: id as any,
  capabilities: ['chat', 'streaming'],
  resolveCredentials: async () => ({
    ok: true,
    credential: { applyToRequest: () => {}, toJSON: () => ({}) } as any,
  }),
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

describe('Router.resolveAll', () => {
  it('should return all providers in fallback chain when no model match', () => {
    const routing: RoutingConfig = {
      modelMap: {},
      fallbackChain: ['ollama', 'claude'],
    }
    const adapters = new Map([
      ['ollama', mockAdapter('ollama')],
      ['claude', mockAdapter('claude')],
    ])
    const breakers = new Map([
      ['ollama', new CircuitBreaker(breakerConfig)],
      ['claude', new CircuitBreaker(breakerConfig)],
    ])
    const router = new Router(routing, adapters, breakers)

    const result = router.resolveAll('unknown-model')
    expect(result.map((a) => a.id)).toEqual(['ollama', 'claude'])
  })

  it('should skip providers with open circuit breaker', () => {
    const routing: RoutingConfig = {
      modelMap: {},
      fallbackChain: ['ollama', 'claude'],
    }
    const adapters = new Map([
      ['ollama', mockAdapter('ollama')],
      ['claude', mockAdapter('claude')],
    ])
    const ollamaBreaker = new CircuitBreaker({ ...breakerConfig, failureThreshold: 1 })
    ollamaBreaker.recordFailure()
    ollamaBreaker.recordFailure()
    ollamaBreaker.recordFailure()

    const breakers = new Map([
      ['ollama', ollamaBreaker],
      ['claude', new CircuitBreaker(breakerConfig)],
    ])
    const router = new Router(routing, adapters, breakers)

    const result = router.resolveAll('unknown-model')
    expect(result.map((a) => a.id)).toEqual(['claude'])
  })

  it('should return empty array when all providers have open circuits', () => {
    const routing: RoutingConfig = {
      modelMap: {},
      fallbackChain: ['ollama'],
    }
    const adapters = new Map([['ollama', mockAdapter('ollama')]])
    const breaker = new CircuitBreaker({ ...breakerConfig, failureThreshold: 1 })
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.recordFailure()

    const breakers = new Map([['ollama', breaker]])
    const router = new Router(routing, adapters, breakers)

    const result = router.resolveAll('unknown-model')
    expect(result).toHaveLength(0)
  })
})
