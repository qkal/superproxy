interface LatencyBucket {
  le: string
  count: number
}

interface ProviderLatency {
  provider: string
  count: number
  sum: number
  buckets: Record<string, number>
}

interface ProviderRequest {
  provider: string
  status: string
  count: number
}

interface MetricsReport {
  requests: ProviderRequest[]
  latency: ProviderLatency[]
}

export class MetricsCollector {
  readonly #requests = new Map<string, number>()
  readonly #latency = new Map<
    string,
    { count: number; sum: number; buckets: Record<string, number> }
  >()

  // Prometheus bucket boundaries in seconds
  readonly #buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

  recordRequest(provider: string, status: 'success' | 'error'): void {
    const key = `${provider}:${status}`
    const current = this.#requests.get(key) ?? 0
    this.#requests.set(key, current + 1)
  }

  recordLatency(provider: string, latencyMs: number): void {
    const latencyS = latencyMs / 1000
    let entry = this.#latency.get(provider)
    if (!entry) {
      entry = { count: 0, sum: 0, buckets: {} }
      this.#latency.set(provider, entry)
    }

    entry.count++
    entry.sum += latencyS

    for (const bucket of this.#buckets) {
      if (latencyS <= bucket) {
        const key = bucket.toString()
        entry.buckets[key] = (entry.buckets[key] ?? 0) + 1
      }
    }
    // +Inf bucket
    entry.buckets['+Inf'] = (entry.buckets['+Inf'] ?? 0) + 1
  }

  getReport(): MetricsReport {
    const requests: ProviderRequest[] = []
    for (const [key, count] of this.#requests) {
      const [provider, status] = key.split(':')
      requests.push({ provider, status, count })
    }

    const latency: ProviderLatency[] = []
    for (const [provider, data] of this.#latency) {
      latency.push({ provider, ...data })
    }

    return { requests, latency }
  }

  toPrometheus(): string {
    const lines: string[] = []

    // Requests counter
    lines.push('# HELP superproxy_requests_total Total requests by provider and status')
    lines.push('# TYPE superproxy_requests_total counter')
    for (const [key, count] of this.#requests) {
      const [provider, status] = key.split(':')
      lines.push(`superproxy_requests_total{provider="${provider}",status="${status}"} ${count}`)
    }
    lines.push('')

    // Latency histogram
    lines.push('# HELP superproxy_request_duration_seconds Request latency')
    lines.push('# TYPE superproxy_request_duration_seconds histogram')

    for (const [provider, data] of this.#latency) {
      for (const [bucket, count] of Object.entries(data.buckets)) {
        const le = bucket === '+Inf' ? '+Inf' : bucket
        lines.push(
          `superproxy_request_duration_seconds_bucket{provider="${provider}",le="${le}"} ${count}`,
        )
      }
      lines.push(`superproxy_request_duration_seconds_sum{provider="${provider}"} ${data.sum}`)
      lines.push(`superproxy_request_duration_seconds_count{provider="${provider}"} ${data.count}`)
    }

    return lines.join('\n')
  }
}
