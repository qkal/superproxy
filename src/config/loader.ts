import { readFileSync, existsSync } from 'node:fs'
import { ProxyConfigSchema } from './schema'
import { DEFAULT_CONFIG } from './defaults'
import type { ProxyConfig } from '@/types/config'

function parseEnvNumber(key: string): number | undefined {
  const val = process.env[key]
  if (val === undefined) return undefined
  const parsed = Number(val)
  if (Number.isNaN(parsed)) return undefined
  return parsed
}

function parseEnvString(key: string): string | undefined {
  return process.env[key]
}

function applyEnvVars(config: Record<string, unknown>): Record<string, unknown> {
  const envMappings: Array<[string, string, 'number' | 'string']> = [
    ['SUPERPROXY_SERVER_PORT', 'server.port', 'number'],
    ['SUPERPROXY_SERVER_HOST', 'server.host', 'string'],
    ['SUPERPROXY_SERVER_MAX_BODY_BYTES', 'server.maxBodyBytes', 'number'],
    ['SUPERPROXY_LOG_LEVEL', 'logging.level', 'string'],
    ['SUPERPROXY_PROVIDERS_OLLAMA_ENABLED', 'providers.ollama.enabled', 'string'],
    ['SUPERPROXY_PROVIDERS_OLLAMA_BASE_URL', 'providers.ollama.baseUrl', 'string'],
  ]

  for (const [envKey, path, type] of envMappings) {
    let value: string | number | boolean | undefined
    if (type === 'number') {
      value = parseEnvNumber(envKey)
    } else {
      value = parseEnvString(envKey)
    }

    if (value === undefined) continue

    if (path === 'providers.ollama.enabled') {
      value = value === 'true'
    }

    const keys = path.split('.')
    let current: Record<string, unknown> = config
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key] as Record<string, unknown>
    }
    current[keys[keys.length - 1]!] = value
  }

  return config
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      )
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export interface LoadConfigOptions {
  configPath?: string
  overrides?: Record<string, unknown>
}

export class ConfigError extends Error {
  readonly field: string
  readonly reason: string

  constructor(field: string, reason: string) {
    super(`Config error: ${field} — ${reason}`)
    this.name = 'ConfigError'
    this.field = field
    this.reason = reason
  }
}

export function loadConfig(options: LoadConfigOptions = {}): ProxyConfig {
  let fileConfig: Record<string, unknown> = {}

  if (options.configPath && existsSync(options.configPath)) {
    try {
      const raw = readFileSync(options.configPath, 'utf-8')
      fileConfig = JSON.parse(raw)
    } catch (e) {
      throw new ConfigError(
        'configPath',
        `Failed to read or parse config file: ${(e as Error).message}`,
      )
    }
  }

  let merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, fileConfig)

  merged = applyEnvVars(merged)

  if (options.overrides) {
    merged = deepMerge(merged, options.overrides)
  }

  const result = ProxyConfigSchema.safeParse(merged)
  if (!result.success) {
    const issues = result.error.issues
    const firstIssue = issues[0]
    const field = firstIssue?.path.join('.') || 'unknown'
    const reason = firstIssue?.message || 'validation failed'
    throw new ConfigError(field, reason)
  }

  return result.data as ProxyConfig
}
