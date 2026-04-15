import { describe, it, expect } from 'bun:test'
import { ProxyConfigSchema } from '@/config/schema'

describe('ProxyConfigSchema', () => {
  it('parses a valid minimal config', () => {
    const result = ProxyConfigSchema.safeParse({
      server: {
        host: '127.0.0.1',
        port: 4141,
        maxBodyBytes: 4194304,
        connectTimeoutMs: 5000,
        firstByteTimeoutMs: 10000,
        totalTimeoutMs: 120000,
        drainTimeoutMs: 10000,
      },
      providers: { ollama: { enabled: true, baseUrl: 'http://localhost:11434' } },
      routing: { modelMap: {}, fallbackChain: ['ollama'] },
      logging: { level: 'info', redactPatterns: ['*.apiKey'], auditLog: false },
      circuitBreaker: { failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 },
      streaming: { keepAliveIntervalMs: 15000, availabilityCheckTtlMs: 30000 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid port', () => {
    const result = ProxyConfigSchema.safeParse({
      server: {
        host: '127.0.0.1',
        port: -1,
        maxBodyBytes: 4194304,
        connectTimeoutMs: 5000,
        firstByteTimeoutMs: 10000,
        totalTimeoutMs: 120000,
        drainTimeoutMs: 10000,
      },
      providers: { ollama: { enabled: true, baseUrl: 'http://localhost:11434' } },
      routing: { modelMap: {}, fallbackChain: ['ollama'] },
      logging: { level: 'info', redactPatterns: [], auditLog: false },
      circuitBreaker: { failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 },
      streaming: { keepAliveIntervalMs: 15000, availabilityCheckTtlMs: 30000 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid log level', () => {
    const result = ProxyConfigSchema.safeParse({
      server: {
        host: '127.0.0.1',
        port: 4141,
        maxBodyBytes: 4194304,
        connectTimeoutMs: 5000,
        firstByteTimeoutMs: 10000,
        totalTimeoutMs: 120000,
        drainTimeoutMs: 10000,
      },
      providers: { ollama: { enabled: true, baseUrl: 'http://localhost:11434' } },
      routing: { modelMap: {}, fallbackChain: ['ollama'] },
      logging: { level: 'verbose', redactPatterns: [], auditLog: false },
      circuitBreaker: { failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 },
      streaming: { keepAliveIntervalMs: 15000, availabilityCheckTtlMs: 30000 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown provider keys with strict mode', () => {
    const result = ProxyConfigSchema.safeParse({
      server: {
        host: '127.0.0.1',
        port: 4141,
        maxBodyBytes: 4194304,
        connectTimeoutMs: 5000,
        firstByteTimeoutMs: 10000,
        totalTimeoutMs: 120000,
        drainTimeoutMs: 10000,
      },
      providers: { unknown_provider: { enabled: true } },
      routing: { modelMap: {}, fallbackChain: ['ollama'] },
      logging: { level: 'info', redactPatterns: [], auditLog: false },
      circuitBreaker: { failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 },
      streaming: { keepAliveIntervalMs: 15000, availabilityCheckTtlMs: 30000 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty fallbackChain', () => {
    const result = ProxyConfigSchema.safeParse({
      server: {
        host: '127.0.0.1',
        port: 4141,
        maxBodyBytes: 4194304,
        connectTimeoutMs: 5000,
        firstByteTimeoutMs: 10000,
        totalTimeoutMs: 120000,
        drainTimeoutMs: 10000,
      },
      providers: { ollama: { enabled: true, baseUrl: 'http://localhost:11434' } },
      routing: { modelMap: {}, fallbackChain: [] },
      logging: { level: 'info', redactPatterns: [], auditLog: false },
      circuitBreaker: { failureThreshold: 3, windowMs: 60000, cooldownMs: 30000 },
      streaming: { keepAliveIntervalMs: 15000, availabilityCheckTtlMs: 30000 },
    })
    expect(result.success).toBe(false)
  })
})
