import type { ProxyError } from '@/types/errors'
import { randomUUID } from 'node:crypto'

export function assignRequestId(): string {
  return randomUUID()
}

export function checkBodySize(
  contentLength: number | undefined,
  maxBytes: number,
): ProxyError | null {
  if (contentLength !== undefined && contentLength > maxBytes) {
    return {
      kind: 'body_too_large',
      maxBytes,
      actualBytes: contentLength,
    }
  }
  return null
}

export function createErrorResponse(error: ProxyError, requestId: string): Response {
  let status = 500
  let type = 'internal_error'

  switch (error.kind) {
    case 'body_too_large':
      status = 413
      type = 'body_too_large'
      break
    case 'request_invalid':
      status = 422
      type = 'invalid_request_error'
      break
    case 'no_adapter_found':
    case 'all_providers_failed':
      status = 503
      type = 'no_provider_available'
      break
    case 'upstream_error':
      status = 502
      type = 'upstream_error'
      break
    case 'upstream_rate_limited':
      status = 429
      type = 'rate_limited'
      break
    case 'circuit_open':
      status = 503
      type = 'circuit_open'
      break
    case 'credential_missing':
    case 'credential_parse_failed':
    case 'credential_permission':
      status = 500
      type = 'credential_error'
      break
    case 'request_timeout':
      status = 504
      type = 'timeout'
      break
    case 'not_implemented':
      status = 501
      type = 'not_implemented'
      break
    case 'port_in_use':
      status = 500
      type = 'port_in_use'
      break
    case 'shutting_down':
      status = 503
      type = 'shutting_down'
      break
    case 'config_invalid':
      status = 500
      type = 'config_error'
      break
    case 'stream_interrupted':
      status = 502
      type = 'stream_interrupted'
      break
  }

  return new Response(
    JSON.stringify({
      error: {
        type,
        message: formatErrorMessage(error),
        request_id: requestId,
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'x-proxy-request-id': requestId,
      },
    },
  )
}

export function handleCors(req: Request): Response | null {
  if (req.method !== 'OPTIONS') {
    return null
  }

  const origin = req.headers.get('Origin') || '*'
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers') || ''

  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  // Always include default headers plus any requested headers
  const defaultHeaders = 'Content-Type, Authorization, x-request-id'
  const allowHeaders = requestedHeaders ? `${defaultHeaders}, ${requestedHeaders}` : defaultHeaders
  headers.set('Access-Control-Allow-Headers', allowHeaders)
  headers.set('Access-Control-Max-Age', '86400')

  return new Response(null, { status: 204, headers })
}

export function createCorsHeaders(origin: string | null): Headers {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', origin || '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id')
  return headers
}

export function validateContentType(headers: Headers): ProxyError | null {
  const contentType = headers.get('Content-Type')

  // Allow requests without body (GET, etc.)
  if (!contentType) {
    return null
  }

  // Parse media type - extract the part before semicolon (if any)
  // e.g., "application/json; charset=utf-8" -> "application/json"
  const mediaType = contentType.split(';')[0].trim().toLowerCase()

  // Check for exact match of application/json
  if (mediaType !== 'application/json') {
    return {
      kind: 'request_invalid',
      issues: [
        {
          code: 'custom',
          message: 'Content-Type must be application/json',
          path: ['headers', 'Content-Type'],
        },
      ],
    }
  }

  return null
}

function formatErrorMessage(error: ProxyError): string {
  switch (error.kind) {
    case 'body_too_large':
      return `Request body too large: ${error.actualBytes} bytes exceeds maximum ${error.maxBytes} bytes`
    case 'no_adapter_found':
      return `No adapter found for model: ${error.model}`
    case 'all_providers_failed':
      return `All providers failed for chain: ${error.chain.join(', ')}`
    case 'credential_missing':
      return `Credential missing for provider ${error.provider}: ${error.hint}`
    case 'credential_parse_failed':
      return `Credential parse failed for provider ${error.provider}: ${error.hint}`
    case 'credential_permission':
      return `Credential file permission denied for provider ${error.provider} at ${error.path} (mode: ${error.actualMode})`
    case 'upstream_error':
      return `Upstream error from ${error.provider} (status ${error.status})`
    case 'upstream_rate_limited':
      return `Rate limited by ${error.provider}${error.retryAfterMs ? ` (retry after ${error.retryAfterMs}ms)` : ''}`
    case 'circuit_open':
      return `Circuit breaker open for ${error.provider}`
    case 'request_timeout':
      return `Request to ${error.provider} timed out (${error.phase}: ${error.timeoutMs}ms)`
    case 'not_implemented':
      return `${error.provider}: ${error.blocker}`
    case 'port_in_use':
      return `Port ${error.port} is already in use`
    case 'config_invalid':
      return `Config error: ${error.field} — ${error.reason}`
    case 'request_invalid':
      return `Invalid request: ${error.issues.map((i) => i.message).join(', ')}`
    case 'stream_interrupted':
      return `Stream interrupted from ${error.provider}`
    case 'shutting_down':
      return 'Server is shutting down'
  }
}
