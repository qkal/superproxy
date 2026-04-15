import { describe, it, expect } from 'bun:test'
import type { ProviderId, Capability, HealthResult } from '@/types/provider'

describe('Provider types', () => {
  it('ProviderId is union of known provider names', () => {
    const ids: ProviderId[] = ['ollama', 'claude', 'codex', 'openai-compat', 'windsurf']
    expect(ids).toHaveLength(5)
  })

  it('Capability is union of known capabilities', () => {
    const caps: Capability[] = ['chat', 'streaming', 'tools', 'vision', 'embeddings']
    expect(caps).toHaveLength(5)
  })

  it('HealthResult available with latencyMs', () => {
    const result: HealthResult = { available: true, latencyMs: 42 }
    expect(result.available).toBe(true)
  })

  it('HealthResult unavailable with reason', () => {
    const result: HealthResult = { available: false, reason: 'connection refused' }
    expect(result.available).toBe(false)
    expect(result.reason).toBe('connection refused')
  })
})
