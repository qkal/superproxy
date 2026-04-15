import { minimatch } from 'minimatch'
import type { ProviderAdapter, ProviderId } from '@/types/provider'
import type { RoutingConfig } from '@/types/config'
import type { CircuitBreaker } from '@/router/circuit-breaker'

export class Router {
  readonly #routing: RoutingConfig
  readonly #adapters: Map<string, ProviderAdapter>
  readonly #breakers: Map<string, CircuitBreaker>

  constructor(
    routing: RoutingConfig,
    adapters: Map<string, ProviderAdapter>,
    breakers: Map<string, CircuitBreaker>,
  ) {
    this.#routing = routing
    this.#adapters = adapters
    this.#breakers = breakers
  }

  resolve(model: string): ProviderAdapter | null {
    const exactMatch = this.#routing.modelMap[model]
    if (exactMatch) {
      const adapter = this.#adapters.get(exactMatch)
      if (adapter && this.#isProviderAvailable(exactMatch)) {
        return adapter
      }
    }

    for (const [pattern, providerId] of Object.entries(this.#routing.modelMap)) {
      if (pattern.includes('*') || pattern.includes('?')) {
        if (minimatch(model, pattern)) {
          const adapter = this.#adapters.get(providerId)
          if (adapter && this.#isProviderAvailable(providerId)) {
            return adapter
          }
        }
      }
    }

    for (const providerId of this.#routing.fallbackChain) {
      const adapter = this.#adapters.get(providerId)
      if (adapter && this.#isProviderAvailable(providerId)) {
        return adapter
      }
    }

    return null
  }

  #isProviderAvailable(providerId: string): boolean {
    const breaker = this.#breakers.get(providerId)
    if (breaker && !breaker.allowRequest()) {
      return false
    }
    const adapter = this.#adapters.get(providerId)
    return adapter !== undefined
  }
}
