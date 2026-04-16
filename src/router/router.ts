import { minimatch } from 'minimatch'
import type { ProviderAdapter } from '@/types/provider'
import type { RoutingConfig } from '@/types/config'
import type { CircuitBreaker } from '@/router/circuit-breaker'

export class Router {
  readonly #routing: RoutingConfig
  readonly #adapters: ReadonlyMap<string, ProviderAdapter>
  readonly #breakers: ReadonlyMap<string, CircuitBreaker>

  constructor(
    routing: RoutingConfig,
    adapters: ReadonlyMap<string, ProviderAdapter>,
    breakers: ReadonlyMap<string, CircuitBreaker>,
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

  resolveAll(model: string): ProviderAdapter[] {
    const result: ProviderAdapter[] = []
    const seen = new Set<string>()

    // 1. Exact match
    const exactMatch = this.#routing.modelMap[model]
    if (exactMatch && !seen.has(exactMatch)) {
      const adapter = this.#adapters.get(exactMatch)
      if (adapter && this.#isProviderAvailable(exactMatch)) {
        result.push(adapter)
        seen.add(exactMatch)
      }
    }

    // 2. Glob matches
    for (const [pattern, providerId] of Object.entries(this.#routing.modelMap)) {
      if (seen.has(providerId)) continue
      if (pattern.includes('*') || pattern.includes('?')) {
        if (minimatch(model, pattern)) {
          const adapter = this.#adapters.get(providerId)
          if (adapter && this.#isProviderAvailable(providerId)) {
            result.push(adapter)
            seen.add(providerId)
          }
        }
      }
    }

    // 3. Fallback chain
    for (const providerId of this.#routing.fallbackChain) {
      if (seen.has(providerId)) continue
      const adapter = this.#adapters.get(providerId)
      if (adapter && this.#isProviderAvailable(providerId)) {
        result.push(adapter)
        seen.add(providerId)
      }
    }

    return result
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
