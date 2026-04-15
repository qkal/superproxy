import { describe, it, expect } from 'bun:test'
import type {
  ProxyConfig,
  ServerConfig,
  ProvidersConfig,
  RoutingConfig,
  LoggingConfig,
  CircuitBreakerConfig,
  StreamingConfig,
} from '@/types/config'

describe('Config types', () => {
  it('ServerConfig has sensible defaults', () => {
    const server: ServerConfig = {
      host: '127.0.0.1',
      port: 4141,
      maxBodyBytes: 4_194_304,
      connectTimeoutMs: 5_000,
      firstByteTimeoutMs: 10_000,
      totalTimeoutMs: 120_000,
      drainTimeoutMs: 10_000,
    }
    expect(server.port).toBe(4141)
    expect(server.host).toBe('127.0.0.1')
  })

  it('ProvidersConfig has ollama and cloud providers', () => {
    const providers: ProvidersConfig = {
      ollama: { enabled: true, baseUrl: 'http://localhost:11434' },
    }
    expect(providers.ollama!.enabled).toBe(true)
  })

  it('RoutingConfig has modelMap and fallbackChain', () => {
    const routing: RoutingConfig = {
      modelMap: { 'claude-*': 'claude' },
      fallbackChain: ['ollama'],
    }
    expect(routing.fallbackChain).toContain('ollama')
  })

  it('ProxyConfig composes all sub-configs', () => {
    const config: ProxyConfig = {
      server: {
        host: '127.0.0.1',
        port: 4141,
        maxBodyBytes: 4_194_304,
        connectTimeoutMs: 5_000,
        firstByteTimeoutMs: 10_000,
        totalTimeoutMs: 120_000,
        drainTimeoutMs: 10_000,
      },
      providers: { ollama: { enabled: true, baseUrl: 'http://localhost:11434' } },
      routing: { modelMap: {}, fallbackChain: ['ollama'] },
      logging: { level: 'info', redactPatterns: ['*.apiKey'], auditLog: false },
      circuitBreaker: { failureThreshold: 3, windowMs: 60_000, cooldownMs: 30_000 },
      streaming: { keepAliveIntervalMs: 15_000, availabilityCheckTtlMs: 30_000 },
    }
    expect(config.server.port).toBe(4141)
  })
})
