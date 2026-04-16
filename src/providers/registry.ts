import type { ProviderAdapter } from '@/types/provider'
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
      new CircuitBreaker(this.#breakerConfig),
    )
  }

  get(id: string): ProviderAdapter | undefined {
    return this.#adapters.get(id)
  }

  getBreaker(id: string): CircuitBreaker | undefined {
    return this.#breakers.get(id)
  }

  // Expose maps for Router construction
  get adapters(): ReadonlyMap<string, ProviderAdapter> {
    return this.#adapters
  }

  get breakers(): ReadonlyMap<string, CircuitBreaker> {
    return this.#breakers
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
