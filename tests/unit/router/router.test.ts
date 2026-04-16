import { describe, it, expect } from 'bun:test'
import { Router } from '@/router/router'
import type { ProviderAdapter, HealthResult } from '@/types/provider'
import type { RoutingConfig } from '@/types/config'
import { CircuitBreaker } from '@/router/circuit-breaker'

function makeMockAdapter(id: string, _available: boolean = true): ProviderAdapter<'ollama'> {
  return {
    id: id as any,
    capabilities: ['chat', 'streaming'],
    async resolveCredentials() {
      return { ok: true, credential: null as any }
    },
    async isAvailable(): Promise<HealthResult> {
      return _available ? { available: true, latencyMs: 10 } : { available: false, reason: 'down' }
    },
    transformRequest(req: any) {
      return { provider: id, body: { model: req.model, messages: [], stream: true } } as any
    },
    async *streamCompletion() {
      yield {} as any
    },
  }
}

describe('Router', () => {
  it('resolves exact model match', () => {
    const routing: RoutingConfig = {
      modelMap: { 'llama3.2': 'ollama', 'claude-3-5-sonnet': 'claude' },
      fallbackChain: ['ollama'],
    }
    const adapters = new Map<string, ProviderAdapter>()
    adapters.set('ollama', makeMockAdapter('ollama'))
    const breakers = new Map<string, CircuitBreaker>()
    breakers.set(
      'ollama',
      new CircuitBreaker({ failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 }),
    )
    const router = new Router(routing, adapters, breakers)
    const result = router.resolve('llama3.2')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('ollama')
  })

  it('resolves glob match for llama*', () => {
    const routing: RoutingConfig = {
      modelMap: { 'llama*': 'ollama' },
      fallbackChain: ['ollama'],
    }
    const adapters = new Map<string, ProviderAdapter>()
    adapters.set('ollama', makeMockAdapter('ollama'))
    const breakers = new Map<string, CircuitBreaker>()
    breakers.set(
      'ollama',
      new CircuitBreaker({ failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 }),
    )
    const router = new Router(routing, adapters, breakers)
    const result = router.resolve('llama3.2-vision')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('ollama')
  })

  it('falls back to fallback chain when no model match', () => {
    const routing: RoutingConfig = {
      modelMap: {},
      fallbackChain: ['ollama'],
    }
    const adapters = new Map<string, ProviderAdapter>()
    adapters.set('ollama', makeMockAdapter('ollama'))
    const breakers = new Map<string, CircuitBreaker>()
    breakers.set(
      'ollama',
      new CircuitBreaker({ failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 }),
    )
    const router = new Router(routing, adapters, breakers)
    const result = router.resolve('unknown-model')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('ollama')
  })

  it('returns null when all providers fail', () => {
    const routing: RoutingConfig = {
      modelMap: {},
      fallbackChain: ['ollama'],
    }
    const adapters = new Map<string, ProviderAdapter>()
    const breakers = new Map<string, CircuitBreaker>()
    const router = new Router(routing, adapters, breakers)
    const result = router.resolve('unknown-model')
    expect(result).toBeNull()
  })

  it('skips provider when circuit breaker is OPEN', () => {
    const routing: RoutingConfig = {
      modelMap: {},
      fallbackChain: ['ollama', 'claude'],
    }
    const adapters = new Map<string, ProviderAdapter>()
    adapters.set('ollama', makeMockAdapter('ollama'))
    adapters.set('claude', makeMockAdapter('claude'))
    const breakers = new Map<string, CircuitBreaker>()
    const ollamaBreaker = new CircuitBreaker({
      failureThreshold: 1,
      windowMs: 60000,
      cooldownMs: 30000,
    })
    ollamaBreaker.recordFailure()
    breakers.set('ollama', ollamaBreaker)
    breakers.set(
      'claude',
      new CircuitBreaker({ failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 }),
    )
    const router = new Router(routing, adapters, breakers)
    const result = router.resolve('anything')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('claude')
  })
})
