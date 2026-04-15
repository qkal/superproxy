import { z } from 'zod'

const ServerConfigSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(4141),
  maxBodyBytes: z.number().int().positive().default(4_194_304),
  connectTimeoutMs: z.number().int().positive().default(5_000),
  firstByteTimeoutMs: z.number().int().positive().default(10_000),
  totalTimeoutMs: z.number().int().positive().default(120_000),
  drainTimeoutMs: z.number().int().positive().default(10_000),
})

const OllamaProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baseUrl: z.string().url().default('http://localhost:11434'),
  credentialTtlMs: z.number().int().positive().default(300_000).optional(),
})

const CloudProviderConfigSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().url().optional(),
  credentialTtlMs: z.number().int().positive().default(300_000).optional(),
  credentialFilePath: z.string().optional(),
})

const ProvidersConfigSchema = z
  .object({
    ollama: OllamaProviderConfigSchema.optional(),
    claude: CloudProviderConfigSchema.optional(),
    codex: CloudProviderConfigSchema.optional(),
    'openai-compat': CloudProviderConfigSchema.extend({
      apiKey: z.string().optional(),
    }).optional(),
    windsurf: z.object({ enabled: z.literal(false) }).optional(),
  })
  .strict()

const RoutingConfigSchema = z.object({
  modelMap: z.record(z.string(), z.string()).default({}),
  fallbackChain: z.array(z.string()).min(1).default(['ollama']),
})

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  redactPatterns: z
    .array(z.string())
    .default(['*.apiKey', '*.token', 'authorization', '*.secret', '*.credential']),
  auditLog: z.boolean().default(false),
  auditLogPath: z.string().optional(),
})

const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().positive().default(3),
  windowMs: z.number().int().positive().default(60_000),
  cooldownMs: z.number().int().positive().default(30_000),
})

const StreamingConfigSchema = z.object({
  keepAliveIntervalMs: z.number().int().positive().default(15_000),
  availabilityCheckTtlMs: z.number().int().positive().default(30_000),
})

export const ProxyConfigSchema = z.object({
  server: ServerConfigSchema.default({}),
  providers: ProvidersConfigSchema.default({}),
  routing: RoutingConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  streaming: StreamingConfigSchema.default({}),
})

export type ProxyConfigInput = z.input<typeof ProxyConfigSchema>
