# Contributing to Superproxy

## Development Setup

```bash
git clone https://github.com/qkal/superproxy.git
cd superproxy
bun install
```

## Commands

| Command             | Description      |
| ------------------- | ---------------- |
| `bun test`          | Run tests        |
| `bun run typecheck` | Type checking    |
| `bun run lint`      | Lint code        |
| `bun run format`    | Format code      |
| `bun run dev`       | Start dev server |

## Project Structure

```
src/
  auth/          Credential resolution and caching
  cli/           CLI commands (commander)
  config/        Config schema, defaults, loader
  logging/       Pino logger, audit logging
  providers/     Provider adapters (ollama/) and registry
  router/        Model routing and circuit breaker
  server/        HTTP server, middleware, SSE, metrics
  types/         TypeScript types and Zod schemas
tests/
  unit/          Unit tests (mirrors src/ structure)
  e2e/           End-to-end smoke tests
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure `bun test`, `bun run typecheck`, and `bun run lint` pass
4. Open a PR with a clear description

## Code Style

- No comments unless asked
- Follow existing patterns in the codebase
- Use private `#` fields for encapsulation
- Validate inputs with Zod schemas
