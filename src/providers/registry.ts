import type { ProviderAdapter, ProviderId } from '@/types/provider'
import type { CircuitBreakerConfig } from '@/types/config'
import { CircuitBreaker } from '@/router/circuit-breaker'

export class ProviderRegistry {
  readonly #adapters = new Map<string, ProviderAdapter>()
  readonly #breakers = new Map<string, CircuitBreaker>()
  readonly #breakerConfig: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.#breakerConfig = config
  }

  register(adapter: ProviderAdapter): void {
    this.#adapters.set(adapter.id, adapter)
    this.#breakers.set(
      adapter.id,
      new CircuitBreaker(adapter.id as ProviderId, this.#breakerConfig),
    )
  }

  get(id: string): ProviderAdapter | undefined {
    return this.#adapters.get(id)
  }

  getBreaker(id: string): CircuitBreaker | undefined {
    return this.#breakers.get(id)
  }

  list(): Array<{ id: string; adapter: ProviderAdapter; breaker: CircuitBreaker }> {
    const result: Array<{ id: string; adapter: ProviderAdapter; breaker: CircuitBreaker }> = []
    for (const [id, adapter] of this.#adapters) {
      const breaker = this.#breakers.get(id)
      if (breaker) {
        result.push({ id, adapter, breaker })
      }
    }
    return result
  }
}
