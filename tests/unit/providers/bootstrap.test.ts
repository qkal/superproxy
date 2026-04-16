import { describe, it, expect } from 'bun:test'
import { bootstrapProviders } from '@/providers/bootstrap'
import type { ProxyConfig } from '@/types/config'

describe('bootstrapProviders', () => {
  const config: ProxyConfig = {
    server: {
      host: '127.0.0.1',
      port: 4141,
      maxBodyBytes: 4194304,
      connectTimeoutMs: 5000,
      firstByteTimeoutMs: 10000,
      totalTimeoutMs: 120000,
      drainTimeoutMs: 10000,
    },
    providers: {
      ollama: {
        enabled: true,
        baseUrl: 'http://localhost:11434',
      },
    },
    routing: {
      modelMap: {},
      fallbackChain: ['ollama'],
    },
    logging: {
      level: 'info',
      redactPatterns: [],
      auditLog: false,
    },
    circuitBreaker: {
      failureThreshold: 3,
      windowMs: 60000,
      cooldownMs: 30000,
    },
    streaming: {
      keepAliveIntervalMs: 15000,
      availabilityCheckTtlMs: 30000,
    },
  }

  it('should create registry with ollama adapter', () => {
    const { registry } = bootstrapProviders(config)
    expect(registry.get('ollama')).toBeDefined()
  })

  it('should create router with fallback chain', () => {
    const { router } = bootstrapProviders(config)
    const adapters = router.resolveAll('any-model')
    expect(adapters.length).toBeGreaterThan(0)
  })

  it('should create credential cache', () => {
    const { credentialCache } = bootstrapProviders(config)
    expect(credentialCache).toBeDefined()
  })

  it('should skip disabled providers', () => {
    const disabledConfig: ProxyConfig = {
      ...config,
      providers: {
        ollama: {
          enabled: false,
          baseUrl: 'http://localhost:11434',
        },
      },
    }
    const { registry } = bootstrapProviders(disabledConfig)
    expect(registry.get('ollama')).toBeUndefined()
  })
})
