import pino from 'pino'
import type { Logger } from 'pino'
import type { LoggingConfig } from '@/types/config'

export function createLogger(config: LoggingConfig): Logger {
  return pino({
    level: config.level,
    redact: config.redactPatterns,
    serializers: {
      err: pino.stdSerializers.err,
    },
  })
}
