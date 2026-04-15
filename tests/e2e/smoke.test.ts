import { describe, it, expect, afterAll, beforeAll } from 'bun:test'
import { ProxyServer } from '@/server/server'
import { createLogger } from '@/logging/logger'
import { loadConfig } from '@/config/loader'
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
    server = new ProxyServer(config, logger)
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
  })

  it('responds to GET /ready', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/ready`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('responds to GET /v1/models with empty list', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/v1/models`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.object).toBe('list')
    expect(body.data).toEqual([])
  })

  it('returns 404 for unknown path', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/unknown`)
    expect(res.status).toBe(404)
  })
})
