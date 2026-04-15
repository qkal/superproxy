# superproxy

A local AI proxy that routes OpenAI-compatible requests to Ollama, Claude Code, Codex CLI, and other LLM backends.

Single API endpoint. Multiple providers. Automatic fallback.

## Why

AI coding tools speak OpenAI's API format, but you might want to route to Ollama locally, Claude remotely, or both with fallback. Superproxy gives you a single `http://localhost:4141/v1` endpoint that handles routing, circuit breaking, and streaming normalization.

## Quick Start

```bash
# Install
bun install

# Start the proxy
bun run dev

# Or build and run
bun run build
./dist/cli.js serve
```

Point any OpenAI-compatible client at `http://localhost:4141/v1`:

```bash
curl http://localhost:4141/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}]}'
```

## Configuration

Create `superproxy.config.json` in your project root:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 4141
  },
  "providers": {
    "ollama": {
      "enabled": true,
      "baseUrl": "http://localhost:11434"
    }
  },
  "routing": {
    "modelMap": {
      "gpt-4*": "ollama",
      "claude-*": "claude"
    },
    "fallbackChain": ["ollama"]
  }
}
```

### CLI Flags

All commands accept `--config <path>` to specify a config file.

```bash
# Override host/port
superproxy serve --host 0.0.0.0 --port 8080

# Check provider health
superproxy doctor

# Test a model
superproxy test llama3

# Inspect routing table
superproxy routes inspect

# Validate config
superproxy config validate
```

## Architecture

```
Request → Validation → Router → Provider Adapter → Upstream
                         ↓
              Circuit Breaker + Fallback Chain
```

- **Router** resolves models to providers via exact match, glob patterns, or fallback chain
- **Circuit Breaker** tracks failures per provider and skips unhealthy ones
- **Provider Adapters** transform OpenAI-format requests to backend-specific formats (Ollama, Anthropic, etc.)
- **SSE Streaming** normalizes backend-specific streaming to OpenAI SSE format

## Providers

| Provider      | Status    | Notes                           |
| ------------- | --------- | ------------------------------- |
| Ollama        | Supported | Local inference via `/api/chat` |
| Claude        | Planned   | Anthropic Messages API          |
| Codex CLI     | Planned   | OpenAI-compatible               |
| OpenAI-compat | Planned   | Any OpenAI-compatible endpoint  |

## API Endpoints

| Method | Path                   | Description                                                    |
| ------ | ---------------------- | -------------------------------------------------------------- |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions (streaming + non-streaming) |
| `GET`  | `/v1/models`           | List available models                                          |
| `GET`  | `/health`              | Server health (always returns 200)                             |
| `GET`  | `/ready`               | Readiness check (verifies providers)                           |
| `GET`  | `/version`             | Server version                                                 |
| `GET`  | `/metrics`             | Prometheus-compatible metrics                                  |

## CLI Commands

| Command                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `serve`                | Start the proxy server                                        |
| `doctor`               | Check all providers: credentials, reachability, circuit state |
| `providers list`       | List registered providers                                     |
| `providers check <id>` | Check a single provider                                       |
| `routes inspect`       | Print the routing table                                       |
| `config validate`      | Validate configuration                                        |
| `test <model>`         | Send a test request through the proxy                         |

Add `--json` to any status command for programmatic output.

## Development

```bash
bun install          # Install dependencies
bun test             # Run tests
bun run typecheck    # Type checking
bun run lint         # Lint
bun run format       # Format code
bun run build        # Build for production
```

## Tech Stack

- [Bun](https://bun.sh) — runtime, test runner, bundler
- [TypeScript](https://www.typescriptlang.org) — type safety
- [Zod](https://zod.dev) — config and request validation
- [Pino](https://getpino.io) — structured logging
- [Commander](https://github.com/tj/commander.js) — CLI framework

## License

[BSD-2-Clause-Patent](LICENSE)
