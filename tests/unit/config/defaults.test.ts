import { describe, it, expect } from 'bun:test'
import { DEFAULT_CONFIG } from '@/config/defaults'
import type { ProxyConfig } from '@/types/config'

describe('DEFAULT_CONFIG', () => {
  it('is a valid ProxyConfig', () => {
    const _config: ProxyConfig = DEFAULT_CONFIG
    expect(_config).toBeDefined()
  })

  it('server defaults to loopback on port 4141', () => {
    expect(DEFAULT_CONFIG.server.host).toBe('127.0.0.1')
    expect(DEFAULT_CONFIG.server.port).toBe(4141)
  })

  it('server maxBodyBytes defaults to 4 MB', () => {
    expect(DEFAULT_CONFIG.server.maxBodyBytes).toBe(4_194_304)
  })

  it('ollama provider defaults to enabled on localhost:11434', () => {
    expect(DEFAULT_CONFIG.providers.ollama).toBeDefined()
    expect(DEFAULT_CONFIG.providers.ollama!.enabled).toBe(true)
    expect(DEFAULT_CONFIG.providers.ollama!.baseUrl).toBe('http://localhost:11434')
  })

  it('fallbackChain defaults to ollama', () => {
    expect(DEFAULT_CONFIG.routing.fallbackChain).toEqual(['ollama'])
  })

  it('circuitBreaker defaults', () => {
    expect(DEFAULT_CONFIG.circuitBreaker.failureThreshold).toBe(3)
    expect(DEFAULT_CONFIG.circuitBreaker.windowMs).toBe(60_000)
    expect(DEFAULT_CONFIG.circuitBreaker.cooldownMs).toBe(30_000)
  })

  it('logging defaults', () => {
    expect(DEFAULT_CONFIG.logging.level).toBe('info')
    expect(DEFAULT_CONFIG.logging.auditLog).toBe(false)
  })

  it('streaming defaults', () => {
    expect(DEFAULT_CONFIG.streaming.keepAliveIntervalMs).toBe(15_000)
    expect(DEFAULT_CONFIG.streaming.availabilityCheckTtlMs).toBe(30_000)
  })

  it('no providers besides ollama are enabled by default', () => {
    expect(DEFAULT_CONFIG.providers.claude).toBeUndefined()
    expect(DEFAULT_CONFIG.providers.codex).toBeUndefined()
    expect(DEFAULT_CONFIG.providers['openai-compat']).toBeUndefined()
    expect(DEFAULT_CONFIG.providers.windsurf).toBeUndefined()
  })
})
