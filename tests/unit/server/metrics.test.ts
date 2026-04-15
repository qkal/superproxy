import { describe, it, expect } from 'bun:test'
import { MetricsCollector } from '@/server/metrics'

describe('MetricsCollector', () => {
  it('should track request count', () => {
    const metrics = new MetricsCollector()
    metrics.recordRequest('ollama', 'success')
    metrics.recordRequest('ollama', 'error')

    const report = metrics.getReport()
    expect(report.requests).toContainEqual({ provider: 'ollama', status: 'success', count: 1 })
    expect(report.requests).toContainEqual({ provider: 'ollama', status: 'error', count: 1 })
  })

  it('should track latency histogram', () => {
    const metrics = new MetricsCollector()
    metrics.recordLatency('ollama', 50)
    metrics.recordLatency('ollama', 150)

    const report = metrics.getReport()
    const ollamaLatency = report.latency.find((l) => l.provider === 'ollama')
    expect(ollamaLatency).toBeDefined()
    expect(ollamaLatency!.buckets['0.1']).toBe(1)
    expect(ollamaLatency!.buckets['0.25']).toBe(2)
  })

  it('should generate Prometheus format', () => {
    const metrics = new MetricsCollector()
    metrics.recordRequest('ollama', 'success')
    metrics.recordLatency('ollama', 50)

    const prom = metrics.toPrometheus()
    expect(prom).toContain('superproxy_requests_total')
    expect(prom).toContain('superproxy_request_duration_seconds')
    expect(prom).toContain('provider="ollama"')
  })
})
