# Versatile Proxy — Architecture Design

**Date:** 2026-04-15
**Status:** Approved
**Project:** `versatile` — Local AI coding assistant proxy/router

---

## 1. Overview

Versatile is a lightweight local HTTP proxy that forwards coding assistant requests from AmpCode (and any OpenAI-compatible client) to multiple AI backends: local Ollama, Claude Code (Anthropic), Codex CLI (OpenAI), and generic OpenAI-compatible cloud endpoints.

It exposes a single OpenAI-compatible API surface (`/v1/chat/completions`, `/v1/models`), discovers credentials from tools already installed on the developer's machine, routes requests by model name, and normalizes all responses back to OpenAI format. It is designed to be fast, local-first, secure by default, and easy to extend without architectural rewrites.

**Runtime:** Bun (`>=1.1.0`)
**Package manager:** Bun (`bun install`, `bun.lockb`)
**Test runner:** Bun (`bun test`)
**Bundler:** Bun (`bun build`)
**Linter:** oxlint
**Formatter:** prettier
**Language:** TypeScript (strict mode)
**Primary client:** AmpCode (treated as OpenAI-compatible until AmpCode's exact wire format is confirmed; an extension hook is reserved)
**License:** BSD-2-Clause Plus Patent License

---

## 2. Architecture

### 2.1 Request Flow

```
AmpCode (or any OpenAI-compatible client)
  │  POST /v1/chat/completions  (OpenAI-compatible JSON)
  ▼
┌──────────────────────────────────────────────────────────────┐
│  Bun HTTP Server  (src/server/)                              │
│  - Assign correlation ID (UUID v4)                           │
│  - Enforce max body size (configurable, default 4 MB)        │
│  - Optional inboundTransformer hook (for non-OpenAI clients) │
│  - Validate request body against zod schema                  │
│  - Structured JSON logging (pino, redacted)                  │
│  - GET /health  (liveness)                                   │
│  - GET /ready   (readiness — at least one provider up)       │
│  - GET /v1/models  (OpenAI-compatible model list)            │
└──────────────────────────────┬───────────────────────────────┘
                               │ OpenAIChatRequest + requestId
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Router  (src/router/)                                       │
│  - model-name → ProviderAdapter lookup                       │
│  - Pattern match: exact → glob → fallback chain              │
│  - Per-provider CircuitBreaker state check                   │
│  - Per-provider availability cache check                     │
│  - First-byte + total timeout enforcement                    │
└──────────────────────────────┬───────────────────────────────┘
                               │ selected ProviderAdapter<Id>
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  ProviderAdapter<Id>  (src/providers/<name>/)                │
│  - CredentialResolver  (disk discovery, TTL cache, opaque)   │
│  - isAvailable()       (cached availability preflight)       │
│  - transformRequest()  (OpenAI → BackendRequestFor<Id>)      │
│  - Upstream HTTP call  (fetch + AbortSignal)                 │
│  - ResponseNormalizer  (backend SSE → OpenAIChatChunk[])     │
└──────────────────────────────┬───────────────────────────────┘
                               │ AsyncIterable<OpenAIChatChunk>
                               ▼
                    SSE stream back to client
                    (or buffered JSON if stream: false)
```

### 2.2 Architectural Principles

- **Adapter + Normalizer pipeline.** The server and router know nothing about backend-specific formats. Each adapter is fully isolated behind a typed interface.
- **Composition over inheritance.** Adapters implement interfaces, not extend base classes.
- **Discriminated unions for all error and result types.** No `instanceof` chains anywhere.
- **Small, focused modules.** Each file has one clear purpose. Large files are a code smell.
- **No giant conditional spaghetti.** Adding a new provider means adding a new adapter directory — no other file changes.
- **Fail fast on config.** Invalid config is rejected at startup with a clear field-level error. No silent partial configs at runtime.

---

## 3. Module Structure

```
versatile/
├── src/
│   ├── types/
│   │   ├── openai.ts          # OpenAIChatRequest, OpenAIChatChunk, OpenAIModelList
│   │   ├── provider.ts        # ProviderAdapter<Id>, BackendRequest, HealthResult, Capability
│   │   ├── config.ts          # ProxyConfig, ProviderConfig, ServerConfig, RoutingConfig, etc.
│   │   └── errors.ts          # ProxyError discriminated union
│   │
│   ├── config/
│   │   ├── loader.ts          # Merge file + env + CLI flags; validate with zod; fail fast
│   │   ├── schema.ts          # Zod schema (also exported as JSON Schema for IDE support)
│   │   └── defaults.ts        # Hardcoded default values
│   │
│   ├── logging/
│   │   ├── logger.ts          # pino wrapper with redactPatterns applied
│   │   └── audit.ts           # Audit log stream (credential events, no values)
│   │
│   ├── auth/
│   │   ├── types.ts           # CredentialResolver interface, CredentialResult
│   │   ├── credential.ts      # ResolvedCredential opaque class
│   │   └── cache.ts           # CredentialCache — TTL map, no serialization
│   │
│   ├── providers/
│   │   ├── registry.ts        # ProviderRegistry — bootstraps adapters from config
│   │   ├── ollama/
│   │   │   ├── adapter.ts     # Implements ProviderAdapter<'ollama'>
│   │   │   ├── auth.ts        # OllamaCredentialResolver (no-op)
│   │   │   ├── transform.ts   # OpenAIChatRequest → OllamaGenerateRequest
│   │   │   └── normalize.ts   # Ollama SSE line → OpenAIChatChunk (pure function)
│   │   ├── claude/            # Stage 4
│   │   ├── codex/             # Stage 4
│   │   ├── openai-compat/     # Stage 4
│   │   └── windsurf/          # Deferred — stub only with NOT_IMPLEMENTED ProxyError
│   │
│   ├── router/
│   │   ├── router.ts          # Routing resolution: exact → glob → fallback chain
│   │   └── circuit-breaker.ts # CircuitBreaker state machine, one instance per provider
│   │
│   ├── server/
│   │   ├── server.ts          # Bun.serve, route dispatch, graceful shutdown
│   │   ├── sse.ts             # SSE emitter: AsyncIterable → ReadableStream + heartbeat
│   │   └── middleware.ts      # Body size limit, correlation ID assignment
│   │
│   ├── cli/
│   │   └── cli.ts             # commander CLI: serve, doctor, providers, config, routes
│   └── index.ts               # Public API re-exports (ProxyConfig, ProviderId, ProxyError, etc.)
│
├── tests/
│   ├── fixtures/
│   │   ├── ollama-stream.txt           # Captured Ollama SSE response (real format)
│   │   └── anthropic-stream.txt        # Captured Anthropic SSE response (real format)
│   ├── unit/
│   │   ├── config/            # Config parsing, env merge, precedence
│   │   ├── router/            # Routing resolution, circuit breaker state machine
│   │   ├── auth/              # Permission check, TTL cache, opaque type invariants
│   │   └── providers/
│   │       └── ollama/
│   │           ├── transform.test.ts   # OpenAI → Ollama transform (pure)
│   │           └── normalize.test.ts   # Ollama SSE → OpenAIChatChunk (pure, table-driven)
│   ├── integration/
│   │   └── ollama-adapter.test.ts      # Full adapter cycle against mock Bun server
│   └── e2e/
│       ├── proxy-stream.test.ts        # Full SSE proxy cycle
│       └── client-disconnect.test.ts   # Disconnect mid-stream → clean abort
│
├── docs/
│   └── superpowers/specs/
│       └── 2026-04-15-versatile-proxy-design.md
│
├── versatile.config.json      # Example / default config (committed to repo)
├── package.json
├── bun.lockb                  # Binary lockfile — committed; do not gitignore
├── tsconfig.json
├── oxlint.json                # oxlint configuration
├── .prettierrc                # prettier configuration
└── README.md
```

**Dependency rule:** `providers/<name>/*` imports only from `types/`, `auth/types.ts`, and `auth/credential.ts`. No adapter imports another adapter. The router holds a `ProviderAdapter` interface reference — it never imports provider internals directly.

---

## 4. Core Type System

All cross-module contracts live in `src/types/`. No logic — types and interfaces only.

### 4.1 OpenAI Wire Types

```typescript
// src/types/openai.ts

type Role = 'system' | 'user' | 'assistant' | 'tool'

interface TextContentPart   { type: 'text';       text: string }
interface ImageContentPart  { type: 'image_url';  image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
type ContentPart = TextContentPart | ImageContentPart

interface ChatMessage {
  role: Role
  content: string | ContentPart[]
  name?: string
  tool_call_id?: string         // present when role === 'tool'
  tool_calls?: ToolCall[]       // present when role === 'assistant' with tool use
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface ToolDefinition {
  type: 'function'
  function: { name: string; description?: string; parameters: Record<string, unknown> }
}

interface OpenAIChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean                   // default: false — proxy handles both paths
  temperature?: number
  max_tokens?: number
  top_p?: number
  stop?: string | string[]
  tools?: ToolDefinition[]
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } }
  user?: string                      // forwarded as-is; never logged
}

// Streaming chunk (SSE event body)
interface OpenAIChatChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: Role
      content?: string | null
      tool_calls?: Partial<ToolCall>[]
    }
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | null
  }>
  usage?: {                          // only in final chunk, if backend provides it
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Non-streaming response
interface OpenAIChatResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// /v1/models response
interface OpenAIModelList {
  object: 'list'
  data: Array<{
    id: string           // model name as registered in routing.modelMap
    object: 'model'
    created: number
    owned_by: string     // provider id, e.g. "ollama" | "claude"
  }>
}
```

### 4.2 ProviderAdapter Interface

```typescript
// src/types/provider.ts

type ProviderId = 'ollama' | 'claude' | 'codex' | 'openai-compat' | 'windsurf'

type Capability =
  | 'chat'
  | 'streaming'
  | 'tools'
  | 'vision'
  | 'embeddings'

// BackendRequest is a discriminated union — each adapter variant is narrowed by ProviderId.
// The generic ProviderAdapter<Id> ensures transformRequest() and streamCompletion()
// always agree on which union member they operate on.
type BackendRequestFor<Id extends ProviderId> =
  Id extends 'ollama'        ? { provider: 'ollama';        body: OllamaGenerateRequest }
: Id extends 'claude'        ? { provider: 'claude';        body: AnthropicMessagesRequest }
: Id extends 'codex'         ? { provider: 'codex';         body: OpenAIChatRequestRaw }
: Id extends 'openai-compat' ? { provider: 'openai-compat'; body: OpenAIChatRequestRaw }
: Id extends 'windsurf'      ? { provider: 'windsurf';      body: never }
: never

type BackendRequest = BackendRequestFor<ProviderId>

type HealthResult =
  | { available: true;  latencyMs: number }
  | { available: false; reason: string }

// Generic parameter Id ties transformRequest and streamCompletion to the same variant.
// This is compile-time safe: a Claude adapter cannot accidentally pass an Ollama body.
interface ProviderAdapter<Id extends ProviderId = ProviderId> {
  readonly id: Id
  readonly capabilities: ReadonlyArray<Capability>
  resolveCredentials(): Promise<CredentialResult>
  isAvailable(): Promise<HealthResult>
  transformRequest(req: OpenAIChatRequest): BackendRequestFor<Id>
  streamCompletion(
    req: BackendRequestFor<Id>,
    credential: ResolvedCredential,
    signal: AbortSignal
  ): AsyncIterable<OpenAIChatChunk>
}
```

### 4.3 Backend-Specific Request Types

```typescript
// Ollama /api/chat format
interface OllamaGenerateRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream: boolean
  options?: {
    temperature?: number
    num_predict?: number    // maps from max_tokens
    top_p?: number
    stop?: string[]
  }
  tools?: unknown[]
}

// Anthropic /v1/messages format
interface AnthropicMessagesRequest {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number        // required by Anthropic (default 4096 if not provided)
  system?: string           // extracted from OpenAI system message
  stream: boolean
  temperature?: number
  tools?: AnthropicTool[]
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

type AnthropicContentBlock =
  | { type: 'text';        text: string }
  | { type: 'image';       source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use';    id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

// OpenAI-compatible raw — forwarded as-is (codex / openai-compat adapters)
type OpenAIChatRequestRaw = OpenAIChatRequest
```

### 4.4 ProxyError Discriminated Union

```typescript
// src/types/errors.ts
import type { ZodIssue } from 'zod'

type ProxyError =
  | { kind: 'no_adapter_found';       model: string }
  | { kind: 'all_providers_failed';   chain: ProviderId[]; lastError: ProxyError }
  | { kind: 'credential_missing';     provider: ProviderId; hint: string }
  | { kind: 'credential_parse_failed'; provider: ProviderId; hint: string }
  | { kind: 'credential_permission';  provider: ProviderId; path: string; actualMode: string }
  | { kind: 'upstream_error';         provider: ProviderId; status: number; requestId: string }
  | { kind: 'upstream_rate_limited';  provider: ProviderId; retryAfterMs: number | null }
  | { kind: 'stream_interrupted';     provider: ProviderId; requestId: string }
  | { kind: 'circuit_open';           provider: ProviderId; cooldownEndsAt: number }
  | { kind: 'request_timeout';        provider: ProviderId; timeoutMs: number; phase: 'connect' | 'first_byte' | 'total' }
  | { kind: 'body_too_large';         maxBytes: number; actualBytes: number }
  | { kind: 'config_invalid';         field: string; reason: string }
  | { kind: 'request_invalid';        issues: ZodIssue[] }
  | { kind: 'not_implemented';        provider: ProviderId; blocker: string }
  | { kind: 'port_in_use';            port: number }
```

Note: `upstream_rate_limited` (HTTP 429) is a distinct error from `upstream_error` because it carries retry semantics. The router may choose to wait `retryAfterMs` before trying the next fallback rather than immediately cascading.

### 4.5 CredentialResult and ResolvedCredential

```typescript
// src/auth/types.ts
type CredentialResult =
  | { ok: true;  credential: ResolvedCredential }
  | { ok: false; error: 'not_found' | 'parse_failed' | 'permission_denied'; hint: string }

interface CredentialResolver {
  resolve(): Promise<CredentialResult>
}
```

```typescript
// src/auth/credential.ts

// ResolvedCredential is intentionally opaque:
// - Private class field (#value) — not enumerable, not stringifiable
// - JSON.stringify(credential) === '{}'
// - Object.keys(credential) === []
// - The ONLY way to consume it is applyToRequest(headers)
// - applyToRequest() is never called outside the adapter's HTTP layer
export class ResolvedCredential {
  readonly #value: string

  constructor(value: string) {
    // Validate that the value is non-empty at construction time
    if (!value || value.trim().length === 0) {
      throw new Error('ResolvedCredential: value must be non-empty')
    }
    this.#value = value
  }

  // Default auth header. Providers that use a different scheme
  // (e.g., Anthropic uses x-api-key) override this by not calling this method
  // and instead using applyAnthropicHeaders().
  applyToRequest(headers: Headers): void {
    headers.set('Authorization', `Bearer ${this.#value}`)
  }

  applyAnthropicHeaders(headers: Headers): void {
    headers.set('x-api-key', this.#value)
    headers.set('anthropic-version', '2023-06-01')
  }

  // Intentionally not serializable
  toJSON(): Record<string, never> { return {} }
}
```

### 4.6 Config Shape

```typescript
// src/types/config.ts

interface ServerConfig {
  host: string                     // default: '127.0.0.1' (loopback only by default)
  port: number                     // default: 4141
  maxBodyBytes: number             // default: 4_194_304 (4 MB)
  connectTimeoutMs: number         // default: 5_000
  firstByteTimeoutMs: number       // default: 10_000
  totalTimeoutMs: number           // default: 120_000
  drainTimeoutMs: number           // default: 10_000
  // Optional hook: raw body → OpenAIChatRequest, for non-OpenAI clients (e.g., AmpCode)
  // When undefined, raw body is validated directly as OpenAIChatRequest.
  // Must be async-capable (can return either a value or a Promise).
  inboundTransformer?: (raw: unknown) => OpenAIChatRequest | Promise<OpenAIChatRequest>
}

interface OllamaProviderConfig {
  enabled: boolean
  baseUrl: string                  // default: 'http://localhost:11434'
  credentialTtlMs?: number         // default: 300_000 (5 min) — N/A for Ollama but typed
}

interface CloudProviderConfig {
  enabled: boolean
  baseUrl?: string                 // optional override for API base URL
  credentialTtlMs?: number         // default: 300_000
  credentialFilePath?: string      // override discovery path — uses default if absent
}

// ProvidersConfig uses explicit named fields — no discriminant needed because the
// key is already the provider id. Accessing config.providers.ollama gives
// OllamaProviderConfig | undefined directly, with no union narrowing required.
interface ProvidersConfig {
  ollama?:         OllamaProviderConfig
  claude?:         CloudProviderConfig
  codex?:          CloudProviderConfig
  'openai-compat'?: CloudProviderConfig & { apiKey?: string }
  windsurf?:       { enabled: false }   // Windsurf can only be declared disabled
}

interface RoutingConfig {
  // Keys: exact model names or minimatch glob patterns (e.g., "llama*", "claude-*").
  // Evaluated in declaration order. Exact string matches are tested before globs.
  modelMap: Record<string, ProviderId>
  fallbackChain: ProviderId[]
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  redactPatterns: string[]         // pino redact paths, default: ['*.apiKey', '*.token', 'authorization']
  auditLog: boolean                // default: false
  auditLogPath?: string            // if auditLog is true and this is set, write to file; else stderr
}

interface CircuitBreakerConfig {
  failureThreshold: number         // default: 3
  windowMs: number                 // default: 60_000
  cooldownMs: number               // default: 30_000
}

interface StreamingConfig {
  keepAliveIntervalMs: number      // default: 15_000 — interval for SSE `: keep-alive` comments
  availabilityCheckTtlMs: number   // default: 30_000 — isAvailable() result cache TTL
}

interface ProxyConfig {
  server: ServerConfig
  providers: ProvidersConfig
  routing: RoutingConfig
  logging: LoggingConfig
  circuitBreaker: CircuitBreakerConfig
  streaming: StreamingConfig
}
```

---

## 5. Credential Resolution (Commercial-Grade)

### 5.1 Principles

1. **Explicit opt-in only.** No provider's credentials are read unless that provider is explicitly enabled in config. Silent auto-discovery of all credential files is not acceptable.
2. **File permission enforcement.** Before reading any credential file, `fs.stat()` mode bits are checked. On Unix, if the file is not `0600` (owner read/write, no group/other access), resolution returns `{ ok: false, error: 'permission_denied' }` and logs a warning with the path and actual mode — no credential data. On Windows, the check is skipped with a `doctor` warning noting that ACL-based enforcement requires elevation.
3. **In-memory cache with TTL.** Credentials are cached in `CredentialCache` (a private `Map`, non-serializable) for `credentialTtlMs` (default 5 minutes). The cache is never written to disk, never emitted in logs, and not included in any diagnostic output.
4. **401/403 → invalidate → re-resolve → one retry.** If an upstream returns 401 or 403, the cache entry for that provider is invalidated, credentials are re-resolved from disk (the tool may have refreshed its token), and the request retries once. If it fails again, the error propagates with `{ kind: 'upstream_error' }`.
5. **Opaque credential type.** `ResolvedCredential` has no enumerable properties. It cannot be serialized with `JSON.stringify`, spread with `{...cred}`, or logged. The only public methods are `applyToRequest()` and `applyAnthropicHeaders()`, both of which write directly to a `Headers` object.
6. **Audit log (no values).** Each resolution emits a structured event: `{ event: 'credential_resolved', provider, timestamp, source: 'cache' | 'disk' }`. Credential values never appear in any log stream.
7. **Known limitation — core dump risk.** Credentials are held in process memory as private class fields. A process crash with core dump enabled could expose them. This is documented as a known limitation. Mitigation: advise users to disable core dumps for the process in production environments. OS keychain integration is a future hardening item.

### 5.2 Provider Discovery Paths

| Provider | Discovery mechanism | Known location |
|---|---|---|
| Ollama | No auth required | N/A |
| Claude Code | JSON file read | `os.homedir()/.claude/credentials.json` — exact token key to be confirmed at implementation, isolated in adapter |
| Codex CLI | JSON file or env var | `os.homedir()/.codex/config.json` or `OPENAI_API_KEY` env var |
| OpenAI-compat | Explicit config or env | `config.providers.openai-compat.apiKey` or `OPENAI_API_KEY` |
| Windsurf | **DEFERRED** | API surface not publicly documented |

All paths resolved via `os.homedir()` (Bun built-in). No hardcoded `/home/` or `C:\Users\`.

`credentialFilePath` in `CloudProviderConfig` allows users to override the default discovery path if their tool stores credentials in a non-standard location.

---

## 6. Routing (Commercial-Grade)

### 6.1 Registry Bootstrapping

`ProviderRegistry` (in `src/providers/registry.ts`) is responsible for instantiating adapters from config at startup. It reads `config.providers`, constructs the appropriate `ProviderAdapter<Id>` for each enabled provider, wraps each in a `CircuitBreaker`, and exposes a `get(id: ProviderId): ProviderAdapter | undefined` method. The router holds a reference to the registry.

Adapter construction is synchronous. Credential resolution is deferred to the first request (lazy) and then cached. This means startup is always fast and never blocked by credential I/O.

### 6.2 Resolution Order

For each inbound request with `model: string`:

1. **Exact match:** `config.routing.modelMap["claude-3-5-sonnet"] === "claude"`
2. **Glob match:** Keys containing `*` or `?` are evaluated in config declaration order using minimatch. `"llama*" → "ollama"`, `"claude-*" → "claude"`.
3. **Fallback chain:** Iterate `config.routing.fallbackChain` in order, trying each provider in sequence.

At each step, before selecting a provider:
- Check `CircuitBreaker` state — if `OPEN`, skip without attempting connection
- Check cached `isAvailable()` result (TTL from `streaming.availabilityCheckTtlMs`) — if unavailable, skip

If all options exhausted: return `{ kind: 'all_providers_failed', chain: [...], lastError }` → HTTP 503 with structured body.

### 6.3 Circuit Breaker

Per-provider state machine in `src/router/circuit-breaker.ts`. One instance per provider in the registry.

```
CLOSED    → (≥failureThreshold errors in windowMs)   → OPEN
OPEN      → (cooldownMs elapsed)                      → HALF_OPEN
HALF_OPEN → (first request succeeds)                  → CLOSED
HALF_OPEN → (first request fails)                     → OPEN
```

State is in-memory only. Resets on process restart. The `doctor` CLI command reports current circuit state for each provider.

### 6.4 Correlation IDs

Every inbound request receives a UUID v4 `requestId`. It:
- Appears in all structured log lines for that request
- Is forwarded upstream as `x-proxy-request-id` header
- Is returned to the client as `x-proxy-request-id` response header
- Appears in all `ProxyError` variants that relate to a specific request

---

## 7. Streaming and Non-Streaming Responses

### 7.1 Streaming Path (`stream: true` or default)

```
Adapter upstream (fetch with AbortSignal)
  → ResponseNormalizer (pure per-chunk transform, stateful only for partial frame buffering)
  → AsyncIterable<OpenAIChatChunk>
  → SSE emitter (src/server/sse.ts)
      - Writes "data: <JSON>\n\n" per chunk
      - Emits ": keep-alive\n\n" every keepAliveIntervalMs if backend is silent
      - Writes "data: [DONE]\n\n" on completion
  → Client
```

The normalizer holds at most one partial in-flight frame. It never accumulates the full response. Each chunk is written immediately upon receipt.

### 7.2 Non-Streaming Path (`stream: false`)

When `stream: false`, the server drives the `AsyncIterable` to completion internally, accumulates the chunks into a single `OpenAIChatResponse`, and returns it as a regular JSON HTTP response (`Content-Type: application/json`). The adapter is unaware of this distinction — it always yields `AsyncIterable<OpenAIChatChunk>`. The non-streaming path is implemented entirely in the server layer.

If the backend natively supports non-streaming (Ollama `/api/generate` with `stream: false`, Anthropic `/v1/messages` non-streaming), the adapter may choose to use that path directly for better efficiency. This is an adapter-level optimization, not an interface requirement.

### 7.3 Resilience

| Concern | Handling |
|---|---|
| Backend silence > keepAliveIntervalMs | SSE emitter sends `: keep-alive` comment; client connection remains open |
| Client disconnect | `request.signal.aborted` fires → SSE emitter calls `iterator.return()` → adapter's upstream `fetch` is aborted via `AbortSignal` |
| Mid-stream backend failure | Normalizer emits a final chunk with `finish_reason: "error"` then `data: [DONE]` |
| Total timeout fires mid-stream | AbortSignal is triggered → same path as client disconnect |
| Backpressure | Bun `ReadableStream` controller handles downstream pressure; `for await` propagates it |
| Backend HTTP 429 (rate limit) | Yields `{ kind: 'upstream_rate_limited', retryAfterMs }` — router may delay before next fallback |

### 7.4 Tool Call Passthrough

For backends that support tool calls natively (Claude, OpenAI-compat), tool call messages are transformed to the backend-native format in `transformRequest()` and transformed back in the normalizer. For backends that do not support tool calls (Ollama), the adapter returns `{ kind: 'not_implemented', provider: 'ollama', blocker: 'tool calls not supported' }` if `tools` is present in the request.

Capability-checking before routing: if the request contains `tools`, the router skips providers that do not declare `'tools'` in their `capabilities` array.

### 7.5 Usage Forwarding

If the backend includes token usage in the final SSE chunk or response body, the normalizer extracts it and emits it in `OpenAIChatChunk.usage`. If the backend omits it, the field is omitted — never fabricated.

---

## 8. Server

### 8.1 Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/chat/completions` | Main proxy endpoint — validate, route, stream or buffer |
| `GET` | `/v1/models` | OpenAI-compatible model list from configured providers |
| `GET` | `/health` | Liveness: `{ status: "ok", uptime: number, version: string }` |
| `GET` | `/ready` | Readiness: 200 if ≥1 fallback-chain provider available, 503 otherwise |

**CORS:** Not emitted by default. The proxy binds to loopback (`127.0.0.1`) and is not intended to serve browser-based cross-origin requests. CORS headers are explicitly out of scope for MVP.

**Request body size:** Before parsing, the raw body size is checked against `config.server.maxBodyBytes` (default: 4 MB). If exceeded, returns HTTP 413 with `{ kind: 'body_too_large' }`.

**Port conflict:** If `Bun.serve()` fails with `EADDRINUSE`, the server catches it and exits with a clear error: `Error: Port 4141 is already in use. Use --port to specify a different port or check for other running versatile instances.` This is the `{ kind: 'port_in_use' }` error variant.

**`/v1/models` response shape:**
```json
{
  "object": "list",
  "data": [
    { "id": "llama3.2", "object": "model", "created": 1700000000, "owned_by": "ollama" },
    { "id": "claude-3-5-sonnet-20241022", "object": "model", "created": 1700000000, "owned_by": "claude" }
  ]
}
```
Model IDs are all keys from `config.routing.modelMap` plus any models reported by `isAvailable()` for Ollama (which queries `/api/tags`).

### 8.2 Request Validation

Every `POST /v1/chat/completions` body is validated against the `OpenAIChatRequest` zod schema after optional inbound transformation. Invalid requests return HTTP 422:

```json
{ "error": { "type": "invalid_request_error", "message": "...", "issues": [...] } }
```

### 8.3 Graceful Shutdown

On `SIGTERM` (Unix only — see Windows note below) or `SIGINT` (Ctrl+C, cross-platform):

1. Stop accepting new connections
2. Drain in-flight requests — wait up to `drainTimeoutMs` (default 10s) for active streams to complete
3. Flush log buffers
4. Exit with code 0

**Windows note:** `SIGTERM` is not supported by the Windows process model and is not handled by Bun on Windows. On Windows, only `SIGINT` (Ctrl+C) triggers graceful shutdown. Process managers on Windows (e.g., PM2, Task Scheduler) should use `taskkill /F` which will cause an abrupt exit. This is a platform limitation, not a bug.

Unhandled rejections and uncaught exceptions are caught at the process level, logged with full stack trace (no credential data), then the process exits with code 1.

---

## 9. Logging

- **Library:** pino — structured JSON, cross-platform, Bun-compatible, zero native deps
- **Transport:** stdout by default; configurable via `VERSATILE_LOG_FILE` env var
- **Fields per request log line:** `level`, `time`, `requestId`, `provider`, `model`, `durationMs`, `status`, `msg`
- **No body logging.** Request bodies and response payloads are never logged — only metadata.
- **Redaction.** pino's `redact` option strips fields matching `config.logging.redactPatterns` before any emit. Default patterns: `['*.apiKey', '*.token', 'authorization', '*.secret', '*.credential']`.
- **Audit log.** Separate write stream for credential events: `{ event, provider, timestamp, source }`. Written to `auditLogPath` if configured, else stderr when `auditLog: true`.
- **Log levels by subsystem:**

| Level | Used for |
|---|---|
| `debug` | Routing decisions, adapter selection, circuit breaker transitions |
| `info` | Request start/end, provider selected, non-streaming response complete |
| `warn` | Circuit state changes, file permission issues, fallback triggered, Windows SIGTERM warning |
| `error` | Upstream failure, config invalid, unhandled exception, stream interrupted |

---

## 10. CLI Commands

All commands implemented via `commander`. Entry point binary: `versatile`.

| Command | Description |
|---|---|
| `versatile serve` | Start the proxy server. Flags: `--port`, `--host`, `--config`, `--log-level` |
| `versatile doctor` | Check all enabled providers: credentials, file permissions, reachability, config validity. Prints ✓/⚠/✗ per provider. Warns if `host` is not loopback. |
| `versatile providers list` | List all registered providers with capabilities, current circuit state, and last health check result |
| `versatile providers check <id>` | Run preflight check on a single provider — credential resolve + isAvailable() |
| `versatile config validate` | Parse and validate config; print resolved effective config with all secrets replaced by `[REDACTED]` |
| `versatile routes inspect` | Print the full resolved routing table: model patterns → providers → fallback chains, with circuit state |
| `versatile --version` | Print the installed version from `package.json` |

`doctor` is the primary diagnostic entry point. A first-time user should be able to run `versatile doctor` and understand exactly what is and isn't working without reading logs or documentation.

---

## 11. Configuration

### 11.1 Precedence

```
CLI flags  >  Environment variables  >  Config file  >  Hardcoded defaults
```

### 11.2 Config File

Resolved from CWD (`versatile.config.json`) or `--config <path>`. The config is validated with zod at startup. On validation failure, the process exits immediately with a human-readable field-level error. There is no partial config state at runtime.

An example config file (`versatile.config.json`) is committed to the repository root and kept in sync with the zod schema.

### 11.3 JSON Schema Export (IDE Support)

`src/config/schema.ts` exports the zod schema. At build time, this is compiled to `dist/config.schema.json` using `zod-to-json-schema`. Users can reference this in their `versatile.config.json` with a `$schema` field to get IDE autocompletion and inline validation:

```json
{
  "$schema": "./node_modules/versatile/dist/config.schema.json",
  "server": { "port": 4141 }
}
```

### 11.4 Environment Variables

Prefix: `VERSATILE_`. Nested config keys use underscores. Examples:

| Variable | Config field |
|---|---|
| `VERSATILE_SERVER_PORT` | `server.port` |
| `VERSATILE_SERVER_HOST` | `server.host` |
| `VERSATILE_LOG_LEVEL` | `logging.level` |
| `VERSATILE_PROVIDERS_OLLAMA_ENABLED` | `providers.ollama.enabled` |
| `VERSATILE_PROVIDERS_OPENAI_COMPAT_API_KEY` | `providers.openai-compat.apiKey` (**secret — redacted in all logs**) |
| `VERSATILE_LOG_FILE` | pino log file path (not in ProxyConfig — process-level) |

### 11.5 Default Config

```json
{
  "$schema": "./node_modules/versatile/dist/config.schema.json",
  "server": {
    "host": "127.0.0.1",
    "port": 4141,
    "maxBodyBytes": 4194304,
    "connectTimeoutMs": 5000,
    "firstByteTimeoutMs": 10000,
    "totalTimeoutMs": 120000,
    "drainTimeoutMs": 10000
  },
  "providers": {
    "ollama": { "enabled": true, "baseUrl": "http://localhost:11434" }
  },
  "routing": {
    "modelMap": {},
    "fallbackChain": ["ollama"]
  },
  "logging": {
    "level": "info",
    "redactPatterns": ["*.apiKey", "*.token", "authorization", "*.secret", "*.credential"],
    "auditLog": false
  },
  "circuitBreaker": {
    "failureThreshold": 3,
    "windowMs": 60000,
    "cooldownMs": 30000
  },
  "streaming": {
    "keepAliveIntervalMs": 15000,
    "availabilityCheckTtlMs": 30000
  }
}
```

---

## 12. Dependencies

### 12.1 Runtime Dependencies

| Package | Version | Role |
|---|---|---|
| `zod` | `^3.23` | Config and request validation |
| `pino` | `^9.0` | Structured JSON logging |
| `commander` | `^12.0` | CLI argument parsing |
| `minimatch` | `^10.0` | Glob pattern matching for model routing |

Maximum 4 runtime dependencies. Additional packages for stage 4 adapters (if any) must be justified and documented.

### 12.2 Dev Dependencies

| Package | Role |
|---|---|
| `@types/bun` | Bun TypeScript types |
| `oxlint` | Linting (fast, Rust-based linter) |
| `prettier` | Code formatting |
| `zod-to-json-schema` | Export config schema to JSON Schema at build time |

### 12.3 Lockfile

`bun.lockb` is committed to the repository. All production dependency versions are pinned (no floating `^` for runtime deps in the final lockfile state after `bun install --frozen-lockfile`).

---

## 13. Testing Strategy

All tests run with `bun test` (Bun's built-in test runner). No Jest, no Vitest, no separate runner config.

### 13.1 Test Matrix

| Layer | Type | What is covered |
|---|---|---|
| Config | Unit | zod schema parsing, env var overrides, CLI flag precedence, invalid config rejection |
| Router | Unit | exact match, glob match, fallback chain traversal, circuit breaker all states, capability-filtered routing |
| Credential | Unit | file permission enforcement, TTL cache hit/miss, cache invalidation on 401, opaque type invariants (JSON.stringify → `{}`) |
| Ollama transform | Unit | OpenAIChatRequest → OllamaGenerateRequest, tool handling (not-implemented path) |
| Ollama normalize | Unit | Ollama SSE lines → OpenAIChatChunk (pure function, table-driven with real Ollama SSE fixtures) |
| Adapter | Integration | Full Ollama adapter cycle against a mock Bun HTTP server (streaming + non-streaming) |
| Server | E2E | Full proxy cycle: POST → validate → route → stream → normalize → SSE response |
| Client disconnect | E2E | Client disconnects mid-stream → `iterator.return()` called → upstream aborted (no leak) |
| Redaction | Unit | All `redactPatterns` fields stripped before any pino emit; `ResolvedCredential` never appears in logs |
| Port conflict | Unit | `port_in_use` error returns clear message, not raw `EADDRINUSE` |

### 13.2 Test Fixtures

`tests/fixtures/` contains static SSE response files captured from real Ollama and Anthropic responses. Normalizer tests are table-driven against these fixtures — no live network calls in unit or integration tests.

### 13.3 CI Pipeline

Runs on every push and pull request:

```
1. bun install --frozen-lockfile
2. bun run typecheck          # tsc --noEmit
3. bun run lint               # oxlint src/ tests/
4. bun run format:check      # prettier --check src/ tests/
5. bun test --coverage         # Bun test runner, coverage gates enforced
6. bun run build              # ensure the project compiles to dist/
```

Coverage gates (minimum 80%):
- `src/router/`
- `src/config/`
- `src/auth/`
- `src/providers/ollama/`

---

## 14. Distribution and Public Release

### 14.1 `package.json` Required Fields

```json
{
  "name": "versatile",
  "version": "0.1.0",
  "description": "Local AI coding assistant proxy — route requests to Ollama, Claude Code, Codex CLI, and OpenAI-compatible endpoints",
  "license": "BSD-2-Clause-Patent",
  "author": "",
  "repository": { "type": "git", "url": "https://github.com/<owner>/versatile" },
  "bugs": { "url": "https://github.com/<owner>/versatile/issues" },
  "homepage": "https://github.com/<owner>/versatile#readme",
  "keywords": ["ai", "llm", "proxy", "ollama", "claude", "openai", "coding-assistant", "local-first"],
  "engines": { "bun": ">=1.1.0" },
  "bin": { "versatile": "./dist/cli.js" },
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./config": "./dist/config/index.js"
  },
  "files": ["dist/", "README.md", "LICENSE", "versatile.config.json"],
  "scripts": {
    "dev":               "bun src/cli/cli.ts serve",
    "build":             "bun build src/cli/cli.ts --outfile dist/cli.js --target bun && bun build src/index.ts --outfile dist/index.js --target bun",
    "build:binary":      "bun build src/cli/cli.ts --compile --outfile dist/versatile",
    "typecheck":         "tsc --noEmit",
    "lint":              "oxlint src/ tests/",
    "format":            "prettier --write src/ tests/",
    "format:check":      "prettier --check src/ tests/",
    "test":              "bun test",
    "test:coverage":     "bun test --coverage",
    "cli":               "bun src/cli/cli.ts"
  }
}
```

### 14.2 Single-Binary Distribution

| `bun build --compile` produces a self-contained binary (`dist/versatile` / `dist/versatile.exe`) with no runtime dependency on Bun being installed on the target machine. This is the recommended distribution format for end users.

```
# Build native binary for current platform
bun run build:binary

# Output: dist/versatile (Unix) or dist/versatile.exe (Windows)
```

The binary is the primary release artifact. GitHub Releases will include platform-specific binaries for: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`.

### 14.3 LICENSE

BSD-2-Clause Plus Patent License. `LICENSE` file at project root with the full license text. The SPDX identifier used in `package.json` is `BSD-2-Clause-Patent`. This license grants the standard BSD 2-clause permissions plus an express patent grant from contributors, providing protection against patent litigation similar to Apache 2.0 but with simpler BSD-style wording.

### 14.4 `.npmignore` / `files`

The `files` field in `package.json` (see above) already gates what is published to npm. `docs/`, `tests/`, `src/` are excluded from the npm package. Only `dist/`, `README.md`, `LICENSE`, and `versatile.config.json` are published.

---

## 15. Security Notes

- Credentials are never hardcoded, logged, serialized, or printed anywhere in the codebase.
- `ResolvedCredential` is an opaque class: no enumerable properties, `toJSON()` returns `{}`.
- pino `redact` strips all patterns in `logging.redactPatterns` before any log emit.
- Credential file permission checks reject world-readable files on Unix.
- No credential is auto-discovered without explicit opt-in via `providers.<id>.enabled: true` in config.
- Model names, provider IDs, and `baseUrl` values are validated against allowlists/zod schemas before use in file paths or upstream URLs. Path traversal via model name injection is not possible.
- Header injection: model names and other user-supplied values passed to upstream HTTP headers are validated as alphanumeric-with-dashes/dots/colons patterns before header assignment. Invalid values are rejected at the validation layer.
- SSRF risk: `openai-compat.baseUrl` is user-supplied. A malicious config could point to internal network resources. This is a local developer tool (single-user, loopback) — the risk surface is the user themselves or compromised config files. The `doctor` command warns if `baseUrl` resolves to a non-routable address. Full SSRF mitigation (URL allowlisting) is a post-MVP hardening item.
- Default bind is `127.0.0.1` (loopback). Binding to `0.0.0.0` exposes the proxy to the local network. The `doctor` command warns if `host` is not loopback.
- Core dump risk: credentials are held in process memory as private class fields. Users running in environments where core dumps are enabled should disable them for the `versatile` process. OS keychain integration is a future hardening item.

---

## 16. Known Limitations and Deferred Items

| Item | Reason deferred | Owner |
|---|---|---|
| Windsurf backend | Windsurf does not expose a documented local HTTP or IPC API. Adapter stub returns `{ kind: 'not_implemented', blocker: 'Windsurf local API surface is not publicly documented' }`. Revisit when confirmed. | Post-MVP |
| OS keychain integration | macOS Keychain / Windows Credential Manager requires platform-specific native bindings not available in pure Bun. | Post-MVP |
| AmpCode-specific wire format | AmpCode format TBD. `inboundTransformer` hook reserved in `ServerConfig`. No code change required to add. | When AmpCode format is confirmed |
| Multi-user auth / access control | Explicitly out of scope. Single-user local tool. | Non-goal |
| Web dashboard | Explicitly out of scope. CLI + structured logs are the management surface. | Non-goal |
| Windows file permission enforcement | `0600` mode bits require Unix `stat`. On Windows, permission check is skipped with `doctor` warning. | Post-MVP |
| Prometheus / OpenTelemetry metrics | Not in MVP. Structured pino logs are the observability surface. | Post-MVP |
| Rate limiting | Basic per-client rate limiting not implemented. Reasonable for a local single-user tool. | Post-MVP |
| HTTPS / TLS for local server | Loopback binding makes TLS unnecessary for local use. Add if non-localhost deployment is needed. | Post-MVP |
| PID file / daemon mode | Process management delegated to systemd / PM2 / launchd. No built-in daemon mode. | Post-MVP |
| Log rotation | Delegated to OS / process manager. pino writes to stdout; pipe to log rotation tool if needed. | Non-goal |
| SSRF URL allowlisting | `baseUrl` config is trusted user input. Full allowlisting requires network config awareness. | Post-MVP |
| Cross-platform binary CI | MVP CI builds and tests on the host runner only. Multi-platform binary CI (linux/darwin/windows) is a release-time concern. | Stage 6 |

---

## 17. Provider Support Matrix

| Provider | Chat | Streaming | Tool calls | Auth discovery | Status |
|---|---|---|---|---|---|
| Ollama (local) | Full | Full | Partial (not-implemented error if `tools` sent) | N/A | MVP — Stage 3 |
| Claude Code | Full | Full | Full | `~/.claude/` file discovery | Stage 4 |
| Codex CLI | Full | Full | Full | `~/.codex/` or `OPENAI_API_KEY` | Stage 4 |
| OpenAI-compatible | Full | Full | Full | Explicit config key | Stage 4 |
| Windsurf | — | — | — | — | Deferred — blocker documented |

---

## 18. Implementation Stages

| Stage | Deliverables |
|---|---|
| 1 — Design | This document |
| 2 — Scaffold | `package.json` (all fields), `bun.lockb`, `tsconfig.json` (strict), `oxlint.json`, `.prettierrc`, `bun test` setup, full folder structure per section 3, `versatile.config.json` example, `LICENSE` (BSD-2-Clause Plus Patent) |
| 3 — MVP slice | Bun HTTP server, `/health`, `/ready`, `/v1/models`, body size enforcement, port-conflict error, config loading (file + env + CLI flags + zod), `ProviderRegistry`, Ollama adapter end-to-end (transform + normalize + stream), circuit breaker, correlation IDs, pino logging with redaction, all CLI commands, graceful shutdown, JSON Schema export |
| 4 — Adapters | Claude Code adapter (credential file discovery, Anthropic SSE normalize, tool call transform), Codex CLI adapter (credential file or env, OpenAI SSE passthrough), OpenAI-compatible adapter (explicit key, full passthrough) |
| 5 — Routing polish | Model glob routing (minimatch), capability-aware routing (skip providers missing required capability), `routes inspect` showing capability filter decisions |
| 6 — Tests + docs | Full test suite per section 13, real SSE fixtures committed, CI pipeline (typecheck + lint + format + test + build), README (quick start, config reference, CLI reference, provider matrix, security notes, known limitations), platform binary builds |
