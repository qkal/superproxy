export interface ServerConfig {
  host: string
  port: number
  maxBodyBytes: number
  connectTimeoutMs: number
  firstByteTimeoutMs: number
  totalTimeoutMs: number
  drainTimeoutMs: number
  inboundTransformer?: (raw: unknown) => unknown | Promise<unknown>
}

export interface OllamaProviderConfig {
  enabled: boolean
  baseUrl: string
  credentialTtlMs?: number
}

export interface CloudProviderConfig {
  enabled: boolean
  baseUrl?: string
  credentialTtlMs?: number
  credentialFilePath?: string
}

export interface ProvidersConfig {
  ollama?: OllamaProviderConfig
  claude?: CloudProviderConfig
  codex?: CloudProviderConfig
  'openai-compat'?: CloudProviderConfig & { apiKey?: string }
  windsurf?: { enabled: false }
}

export interface RoutingConfig {
  modelMap: Record<string, string>
  fallbackChain: string[]
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  redactPatterns: string[]
  auditLog: boolean
  auditLogPath?: string
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  windowMs: number
  cooldownMs: number
}

export interface StreamingConfig {
  keepAliveIntervalMs: number
  availabilityCheckTtlMs: number
}

export interface ProxyConfig {
  server: ServerConfig
  providers: ProvidersConfig
  routing: RoutingConfig
  logging: LoggingConfig
  circuitBreaker: CircuitBreakerConfig
  streaming: StreamingConfig
}
