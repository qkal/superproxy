import pino from 'pino'
import type { Logger } from 'pino'
import type { LoggingConfig } from '@/types/config'

export function createAuditLogger(config: LoggingConfig): Logger | null {
  if (!config.auditLog) return null

  const dest = config.auditLogPath
    ? pino.destination({ dest: config.auditLogPath, sync: false })
    : pino.destination(2)

  return pino(
    {
      level: 'info',
      name: 'superproxy-audit',
    },
    dest,
  )
}
