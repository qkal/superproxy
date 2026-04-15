import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { loadConfig, ConfigError } from '@/config/loader'
import type { ProxyConfig } from '@/types/config'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('loadConfig', () => {
  const testDir = join(tmpdir(), 'versatile-test-config-' + process.pid)

  beforeEach(() => {
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('loads valid config from file', () => {
    const configPath = join(testDir, 'versatile.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
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
      }),
    )
    const result = loadConfig({ configPath })
    expect(result.server.port).toBe(4141)
  })

  it('returns defaults when no config file exists', () => {
    const result = loadConfig({ configPath: '/nonexistent/path.json' })
    expect(result.server.port).toBe(4141)
    expect(result.server.host).toBe('127.0.0.1')
  })

  it('merges env vars over file config', () => {
    const originalPort = process.env.VERSATILE_SERVER_PORT
    process.env.VERSATILE_SERVER_PORT = '9999'
    try {
      const result = loadConfig({ configPath: '/nonexistent/path.json' })
      expect(result.server.port).toBe(9999)
    } finally {
      if (originalPort !== undefined) {
        process.env.VERSATILE_SERVER_PORT = originalPort
      } else {
        delete process.env.VERSATILE_SERVER_PORT
      }
    }
  })

  it('throws ConfigError on invalid config with field-level error', () => {
    const configPath = join(testDir, 'bad.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        server: { port: -1 },
      }),
    )
    expect(() => loadConfig({ configPath })).toThrow(ConfigError)
  })

  it('CLI overrides override env vars', () => {
    const originalPort = process.env.VERSATILE_SERVER_PORT
    process.env.VERSATILE_SERVER_PORT = '8080'
    try {
      const result = loadConfig({
        configPath: '/nonexistent/path.json',
        overrides: { server: { port: 3000 } },
      })
      expect(result.server.port).toBe(3000)
    } finally {
      if (originalPort !== undefined) {
        process.env.VERSATILE_SERVER_PORT = originalPort
      } else {
        delete process.env.VERSATILE_SERVER_PORT
      }
    }
  })
})
