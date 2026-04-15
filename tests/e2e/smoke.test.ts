import { describe, it, expect, afterAll, beforeAll } from 'bun:test'
import { ProxyServer } from '@/server/server'
import { createLogger } from '@/logging/logger'
import { createAuditLogger } from '@/logging/audit'
import { loadConfig } from '@/config/loader'
import { bootstrapProviders } from '@/providers/bootstrap'
import { MetricsCollector } from '@/server/metrics'
import type { ProxyConfig } from '@/types/config'
import type { Logger } from 'pino'

describe('ProxyServer smoke test', () => {
  let server: ProxyServer
  let config: ProxyConfig
  let logger: Logger

  beforeAll(async () => {
    config = loadConfig({
      overrides: {
        server: {
          host: '127.0.0.1',
          port: 14141,
          maxBodyBytes: 4194304,
          connectTimeoutMs: 5000,
          firstByteTimeoutMs: 10000,
          totalTimeoutMs: 120000,
          drainTimeoutMs: 10000,
        },
      },
    })
    logger = createLogger(config.logging)

    // Bootstrap providers and create dependencies
    const { registry, router, credentialCache } = bootstrapProviders(config)
    const metrics = new MetricsCollector()
    const auditLogger = createAuditLogger(config.logging)

    server = new ProxyServer(config, logger, {
      router,
      registry,
      credentialCache,
      metrics,
      auditLogger,
    })

    await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('responds to GET /health', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.uptime).toBeDefined()
    expect(body.version).toBeDefined()
  })

  it('responds to GET /version', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/version`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBeDefined()
  })

  it('responds to GET /ready', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/ready`)
    // Status can be 200 (healthy) or 503 (degraded) depending on provider availability
    expect([200, 503]).toContain(res.status)
    const body = await res.json()
    expect(['ok', 'degraded']).toContain(body.status)
    expect(body.providers).toBeDefined()
  })

  it('responds to GET /v1/models', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/v1/models`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.object).toBe('list')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('responds to GET /metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/metrics`)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('# HELP')
    expect(body).toContain('superproxy')
  })

  it('returns 404 for unknown path', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/unknown`)
    expect(res.status).toBe(404)
  })

  it('handles CORS preflight', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/v1/chat/completions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined()
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})
