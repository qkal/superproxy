import type { CircuitBreakerConfig } from '@/types/config'

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export class CircuitBreaker {
  readonly #config: CircuitBreakerConfig
  #state: CircuitBreakerState = 'CLOSED'
  #failureCount = 0
  #lastFailureTime = 0

  constructor(_providerId: string, config: CircuitBreakerConfig) {
    this.#config = config
  }

  get state(): CircuitBreakerState {
    if (this.#state === 'OPEN') {
      if (Date.now() - this.#lastFailureTime >= this.#config.cooldownMs) {
        this.#state = 'HALF_OPEN'
      }
    }
    return this.#state
  }

  allowRequest(): boolean {
    return this.state !== 'OPEN'
  }

  recordSuccess(): void {
    this.#failureCount = 0
    this.#state = 'CLOSED'
  }

  recordFailure(): void {
    this.#failureCount++
    this.#lastFailureTime = Date.now()
    if (this.#failureCount >= this.#config.failureThreshold) {
      this.#state = 'OPEN'
    }
  }

  reset(): void {
    this.#failureCount = 0
    this.#state = 'CLOSED'
    this.#lastFailureTime = 0
  }
}
