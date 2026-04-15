import type { ProxyConfig } from '@/types/config'

export const DEFAULT_CONFIG: ProxyConfig = {
  server: {
    host: '127.0.0.1',
    port: 4141,
    maxBodyBytes: 4_194_304,
    connectTimeoutMs: 5_000,
    firstByteTimeoutMs: 10_000,
    totalTimeoutMs: 120_000,
    drainTimeoutMs: 10_000,
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
    redactPatterns: ['*.apiKey', '*.token', 'authorization', '*.secret', '*.credential'],
    auditLog: false,
  },
  circuitBreaker: {
    failureThreshold: 3,
    windowMs: 60_000,
    cooldownMs: 30_000,
  },
  streaming: {
    keepAliveIntervalMs: 15_000,
    availabilityCheckTtlMs: 30_000,
  },
}
