import { describe, it, expect } from 'bun:test'
import { CircuitBreaker } from '@/router/circuit-breaker'
import type { CircuitBreakerConfig } from '@/types/config'

describe('CircuitBreaker', () => {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    windowMs: 60_000,
    cooldownMs: 30_000,
  }

  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker('ollama', defaultConfig)
    expect(cb.state).toBe('CLOSED')
  })

  it('transitions to OPEN after failureThreshold failures', () => {
    const cb = new CircuitBreaker('ollama', defaultConfig)
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.state).toBe('CLOSED')
    cb.recordFailure()
    expect(cb.state).toBe('OPEN')
  })

  it('resets failure count on success', () => {
    const cb = new CircuitBreaker('ollama', defaultConfig)
    cb.recordFailure()
    cb.recordFailure()
    cb.recordSuccess()
    cb.recordFailure()
    expect(cb.state).toBe('CLOSED')
  })

  it('returns false for allowRequest in OPEN state', () => {
    const cb = new CircuitBreaker('ollama', defaultConfig)
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.allowRequest()).toBe(false)
  })

  it('transitions to HALF_OPEN after cooldownMs', () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 1,
      windowMs: 60_000,
      cooldownMs: 10,
    }
    const cb = new CircuitBreaker('ollama', config)
    cb.recordFailure()
    expect(cb.state).toBe('OPEN')
    const start = Date.now() + 50
    while (Date.now() < start) {}
    expect(cb.state).toBe('HALF_OPEN')
    expect(cb.allowRequest()).toBe(true)
  })

  it('HALF_OPEN transitions to CLOSED on success', () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 1,
      windowMs: 60_000,
      cooldownMs: 10,
    }
    const cb = new CircuitBreaker('ollama', config)
    cb.recordFailure()
    const start = Date.now() + 50
    while (Date.now() < start) {}
    expect(cb.state).toBe('HALF_OPEN')
    cb.recordSuccess()
    expect(cb.state).toBe('CLOSED')
  })

  it('HALF_OPEN transitions to OPEN on failure', () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 1,
      windowMs: 60_000,
      cooldownMs: 10,
    }
    const cb = new CircuitBreaker('ollama', config)
    cb.recordFailure()
    const start = Date.now() + 50
    while (Date.now() < start) {}
    expect(cb.state).toBe('HALF_OPEN')
    cb.recordFailure()
    expect(cb.state).toBe('OPEN')
  })

  it('manualReset returns to CLOSED', () => {
    const cb = new CircuitBreaker('ollama', defaultConfig)
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.state).toBe('OPEN')
    cb.reset()
    expect(cb.state).toBe('CLOSED')
  })
})
