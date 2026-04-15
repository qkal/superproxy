import type { ProxyConfig } from '@/types/config'
import type { ProxyError } from '@/types/errors'
import type { Logger } from 'pino'
import { assignRequestId, checkBodySize, createErrorResponse } from '@/server/middleware'

export class ProxyServer {
  #config: ProxyConfig
  #logger: Logger
  #server: ReturnType<typeof Bun.serve> | null = null

  constructor(config: ProxyConfig, logger: Logger) {
    this.#config = config
    this.#logger = logger
  }

  async start(): Promise<void> {
    const config = this.#config
    const logger = this.#logger

    this.#server = Bun.serve({
      hostname: config.server.host,
      port: config.server.port,

      fetch: async (req: Request) => {
        const requestId = assignRequestId()
        const url = new URL(req.url)

        logger.info({ requestId, method: req.method, path: url.pathname })

        if (req.method === 'GET' && url.pathname === '/health') {
          return new Response(
            JSON.stringify({ status: 'ok', uptime: process.uptime(), version: '0.1.0' }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (req.method === 'GET' && url.pathname === '/ready') {
          return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (req.method === 'GET' && url.pathname === '/v1/models') {
          return new Response(JSON.stringify({ object: 'list', data: [] }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
          const contentLength = req.headers.get('content-length')
          const bodySizeError = checkBodySize(
            contentLength ? parseInt(contentLength, 10) : undefined,
            config.server.maxBodyBytes,
          )
          if (bodySizeError) {
            return createErrorResponse(bodySizeError, requestId)
          }

          try {
            await req.json()
          } catch {
            const error: ProxyError = {
              kind: 'request_invalid',
              issues: [{ message: 'Invalid JSON body', path: [] } as any],
            }
            return createErrorResponse(error, requestId)
          }

          return new Response(
            JSON.stringify({
              error: {
                type: 'not_implemented',
                message: 'Proxy routing not yet connected',
                request_id: requestId,
              },
            }),
            {
              status: 501,
              headers: { 'Content-Type': 'application/json', 'x-proxy-request-id': requestId },
            },
          )
        }

        return new Response('Not Found', { status: 404 })
      },
    })

    logger.info({ host: config.server.host, port: config.server.port }, 'SuperProxy server started')
  }

  async stop(): Promise<void> {
    if (this.#server) {
      this.#server.stop()
      this.#logger.info('SuperProxy server stopped')
    }
  }

  get port(): number {
    return this.#server?.port ?? this.#config.server.port
  }
}
