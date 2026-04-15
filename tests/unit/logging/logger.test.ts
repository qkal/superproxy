import { describe, it, expect } from 'bun:test'
import { createLogger } from '@/logging/logger'
import type { LoggingConfig } from '@/types/config'

describe('createLogger', () => {
  it('creates a pino logger with given level', () => {
    const config: LoggingConfig = {
      level: 'info',
      redactPatterns: ['*.apiKey', '*.token', 'authorization'],
      auditLog: false,
    }
    const logger = createLogger(config)
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.warn).toBe('function')
  })

  it('accepts debug level', () => {
    const config: LoggingConfig = {
      level: 'debug',
      redactPatterns: [],
      auditLog: false,
    }
    const logger = createLogger(config)
    expect(logger.level).toBe('debug')
  })
})
