## 0.1.0 — 2026-04-15

### Added

- Proxy pipeline for `POST /v1/chat/completions` with OpenAI-compatible format
- Ollama provider adapter with streaming and NDJSON normalization
- Provider fallback chain with automatic retry on failure
- Circuit breaker per provider (tracks failures, skips unhealthy providers)
- Request validation with Zod schema
- CORS middleware with preflight handling
- Content-Type enforcement (application/json required)
- Timeout enforcement via AbortController (connect/firstByte/total)
- Prometheus-compatible `/metrics` endpoint
- `/version`, `/health`, `/ready` (with real provider checks) endpoints
- Error aggregation (per-provider details when all fail)
- Structured logging with Pino (JSON, configurable redaction)
- Audit logging support
- Graceful shutdown with drain timeout
- CLI commands: `serve`, `doctor`, `providers list`, `providers check`, `routes inspect`, `config validate`, `test`
- `--json` flag on all status commands for programmatic output
- Config via file, environment variables, or CLI flags (zod-validated)
- Router with exact match, glob patterns, and fallback chain resolution
- Credential resolution with TTL-based caching
