import { describe, it, expect } from 'bun:test'
import { handleCors, validateContentType, createCorsHeaders } from '@/server/middleware'

describe('CORS middleware', () => {
  it('should return CORS headers for OPTIONS preflight', () => {
    const headers = new Headers()
    headers.set('Origin', 'http://localhost:3000')
    headers.set('Access-Control-Request-Method', 'POST')

    const req = new Request('http://localhost:4141/v1/chat/completions', {
      method: 'OPTIONS',
      headers,
    })

    const response = handleCors(req)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('should return null for non-OPTIONS requests', () => {
    const req = new Request('http://localhost:4141/health', { method: 'GET' })
    const response = handleCors(req)
    expect(response).toBeNull()
  })
})

describe('Content-Type validation', () => {
  it('should accept application/json', () => {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const result = validateContentType(headers)
    expect(result).toBeNull()
  })

  it('should reject non-JSON Content-Type', () => {
    const headers = new Headers()
    headers.set('Content-Type', 'text/plain')
    const result = validateContentType(headers)
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('request_invalid')
  })
})

describe('createCorsHeaders', () => {
  it('should create CORS headers with origin', () => {
    const headers = createCorsHeaders('http://localhost:3000')
    expect(headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    expect(headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
  })
})
