import { Command } from 'commander'
import { loadConfig } from '@/config/loader'
import { createLogger } from '@/logging/logger'
import { createAuditLogger } from '@/logging/audit'
import { ProxyServer } from '@/server/server'
import { MetricsCollector } from '@/server/metrics'
import { bootstrapProviders } from '@/providers/bootstrap'

const VERSION = '0.1.0'

const program = new Command()

program.name('superproxy').version(VERSION).description('Local AI coding assistant proxy')

// ============================================================================
// serve command
// ============================================================================
program
  .command('serve')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('--host <host>', 'Host to bind to')
  .option('-c, --config <path>', 'Path to config file')
  .option('-l, --log-level <level>', 'Log level: debug, info, warn, error')
  .action(async (options) => {
    const overrides: Record<string, Record<string, unknown>> = {}
    if (options.port) overrides.server = { ...overrides.server, port: options.port }
    if (options.host) overrides.server = { ...overrides.server, host: options.host }
    if (options.logLevel)
      overrides.logging = { ...overrides.logging, level: options.logLevel }

    const config = loadConfig({
      configPath: options.config,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    })

    const logger = createLogger(config.logging)
    const auditLogger = createAuditLogger(config.logging)
    const metrics = new MetricsCollector()

    // Bootstrap providers using the new function
    const { registry, router, credentialCache } = bootstrapProviders(config)

    // Create server with all dependencies
    const server = new ProxyServer(config, logger, {
      router,
      registry,
      credentialCache,
      metrics,
      auditLogger,
    })

    await server.start()
    logger.info(`SuperProxy listening on ${config.server.host}:${server.port}`)

    const shutdown = async () => {
      logger.info('Shutting down...')
      await server.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })

// ============================================================================
// doctor command
// ============================================================================
program
  .command('doctor')
  .description('Check all enabled providers: credentials, permissions, reachability')
  .option('-c, --config <path>', 'Path to config file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig({ configPath: options.config })
    const { registry } = bootstrapProviders(config)

    const results: Array<{
      provider: string
      enabled: boolean
      credentials: { ok: boolean; error?: string; hint?: string }
      reachability: { ok: boolean; latencyMs?: number; error?: string }
      circuitState: string
    }> = []

    let allPassed = true

    for (const { id, adapter, breaker } of registry.list()) {
      const providerResult: (typeof results)[0] = {
        provider: id,
        enabled: true,
        credentials: { ok: false },
        reachability: { ok: false },
        circuitState: breaker.state,
      }

      // Check credentials
      const credentialResult = await adapter.resolveCredentials()
      if (credentialResult.ok) {
        providerResult.credentials = { ok: true }
      } else {
        providerResult.credentials = {
          ok: false,
          error: credentialResult.error,
          hint: credentialResult.hint,
        }
        allPassed = false
      }

      // Check reachability
      const healthResult = await adapter.isAvailable()
      if (healthResult.available) {
        providerResult.reachability = { ok: true, latencyMs: healthResult.latencyMs }
      } else {
        providerResult.reachability = { ok: false, error: healthResult.reason }
        allPassed = false
      }

      results.push(providerResult)
    }

    // Also include disabled providers from config
    for (const [id, cfg] of Object.entries(config.providers)) {
      if (!cfg || cfg.enabled === false) {
        results.push({
          provider: id,
          enabled: false,
          credentials: { ok: false, error: 'Provider is disabled' },
          reachability: { ok: false, error: 'Provider is disabled' },
          circuitState: 'CLOSED',
        })
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ providers: results, allPassed }, null, 2))
    } else {
      console.log('Provider Health Check Results:')
      console.log('='.repeat(60))
      for (const r of results) {
        const status = r.enabled && r.credentials.ok && r.reachability.ok ? '✓' : '✗'
        console.log(`\n${status} ${r.provider}`)
        console.log(`  Enabled: ${r.enabled}`)
        console.log(`  Circuit State: ${r.circuitState}`)
        if (r.enabled) {
          console.log(
            `  Credentials: ${r.credentials.ok ? 'OK' : `FAILED - ${r.credentials.error}`}`,
          )
          if (!r.credentials.ok && r.credentials.hint) {
            console.log(`    Hint: ${r.credentials.hint}`)
          }
          console.log(
            `  Reachability: ${r.reachability.ok ? 'OK' : `FAILED - ${r.reachability.error}`}`,
          )
          if (r.reachability.ok && r.reachability.latencyMs !== undefined) {
            console.log(`    Latency: ${r.reachability.latencyMs}ms`)
          }
        }
      }
      console.log(`\n${'='.repeat(60)}`)
      console.log(allPassed ? 'All checks passed!' : 'Some checks failed.')
    }

    process.exit(allPassed ? 0 : 1)
  })

// ============================================================================
// providers command group
// ============================================================================
const providersCmd = program.command('providers').description('List and manage providers')

providersCmd
  .command('list')
  .description('List all registered providers')
  .option('-c, --config <path>', 'Path to config file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig({ configPath: options.config })
    const { registry } = bootstrapProviders(config)

    const providers: Array<{
      id: string
      enabled: boolean
      circuitState: string
      capabilities: string[]
    }> = []

    // Add registered providers
    for (const { id, adapter, breaker } of registry.list()) {
      providers.push({
        id,
        enabled: true,
        circuitState: breaker.state,
        capabilities: [...adapter.capabilities],
      })
    }

    // Add disabled providers from config
    for (const [id, cfg] of Object.entries(config.providers)) {
      if (!cfg || cfg.enabled === false) {
        providers.push({
          id,
          enabled: false,
          circuitState: 'CLOSED',
          capabilities: [],
        })
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ providers }, null, 2))
    } else {
      console.log('Registered Providers:')
      console.log('='.repeat(60))
      for (const p of providers) {
        const status = p.enabled ? '●' : '○'
        console.log(`${status} ${p.id}`)
        console.log(`  Enabled: ${p.enabled}`)
        console.log(`  Circuit State: ${p.circuitState}`)
        if (p.capabilities.length > 0) {
          console.log(`  Capabilities: ${p.capabilities.join(', ')}`)
        }
      }
    }
  })

providersCmd
  .command('check')
  .description('Run preflight check on a single provider')
  .argument('<id>', 'Provider ID')
  .option('-c, --config <path>', 'Path to config file')
  .option('--json', 'Output as JSON')
  .action(async (id: string, options: { config?: string; json?: boolean }) => {
    const config = loadConfig({ configPath: options.config })
    const { registry } = bootstrapProviders(config)

    const entry = registry.list().find((e) => e.id === id)
    if (!entry) {
      const error = { error: `Provider '${id}' not found or not enabled` }
      if (options.json) {
        console.log(JSON.stringify(error, null, 2))
      } else {
        console.error(error.error)
      }
      process.exit(1)
    }

    const { adapter, breaker } = entry

    const result: {
      provider: string
      enabled: boolean
      credentials: { ok: boolean; error?: string; hint?: string }
      reachability: { ok: boolean; latencyMs?: number; error?: string }
      circuitState: string
    } = {
      provider: id,
      enabled: true,
      credentials: { ok: false },
      reachability: { ok: false },
      circuitState: breaker.state,
    }

    // Check credentials
    const credentialResult = await adapter.resolveCredentials()
    if (credentialResult.ok) {
      result.credentials = { ok: true }
    } else {
      result.credentials = {
        ok: false,
        error: credentialResult.error,
        hint: credentialResult.hint,
      }
    }

    // Check reachability
    const healthResult = await adapter.isAvailable()
    if (healthResult.available) {
      result.reachability = { ok: true, latencyMs: healthResult.latencyMs }
    } else {
      result.reachability = { ok: false, error: healthResult.reason }
    }

    const passed = result.credentials.ok && result.reachability.ok

    if (options.json) {
      console.log(JSON.stringify({ ...result, passed }, null, 2))
    } else {
      console.log(`Provider Check: ${id}`)
      console.log('='.repeat(60))
      console.log(`Circuit State: ${result.circuitState}`)
      console.log(`Credentials: ${result.credentials.ok ? 'OK' : 'FAILED'}`)
      if (!result.credentials.ok) {
        console.log(`  Error: ${result.credentials.error}`)
        if (result.credentials.hint) {
          console.log(`  Hint: ${result.credentials.hint}`)
        }
      }
      console.log(`Reachability: ${result.reachability.ok ? 'OK' : 'FAILED'}`)
      if (result.reachability.ok) {
        console.log(`  Latency: ${result.reachability.latencyMs}ms`)
      } else {
        console.log(`  Error: ${result.reachability.error}`)
      }
      console.log(`\nStatus: ${passed ? 'PASSED' : 'FAILED'}`)
    }

    process.exit(passed ? 0 : 1)
  })

// ============================================================================
// config command group
// ============================================================================
const configCmd = program.command('config').description('Configuration management')

configCmd
  .command('validate')
  .description('Parse and validate config')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const config = loadConfig({ configPath: options.config })
      console.log('Config is valid.')
      console.log(JSON.stringify(config, null, 2))
    } catch (e) {
      console.error('Config validation failed:', (e as Error).message)
      process.exit(1)
    }
  })

// ============================================================================
// routes command group
// ============================================================================
const routesCmd = program.command('routes').description('Routing management')

routesCmd
  .command('inspect')
  .description('Print the full resolved routing table')
  .option('-c, --config <path>', 'Path to config file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig({ configPath: options.config })
    const { registry } = bootstrapProviders(config)

    // Build provider states
    const providerStates: Record<
      string,
      { enabled: boolean; circuitState: string; available: boolean }
    > = {}
    for (const { id, breaker } of registry.list()) {
      providerStates[id] = {
        enabled: true,
        circuitState: breaker.state,
        available: breaker.allowRequest(),
      }
    }

    // Add disabled providers
    for (const [id, cfg] of Object.entries(config.providers)) {
      if (!cfg || cfg.enabled === false) {
        providerStates[id] = {
          enabled: false,
          circuitState: 'CLOSED',
          available: false,
        }
      }
    }

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            modelMap: config.routing.modelMap,
            fallbackChain: config.routing.fallbackChain,
            providerStates,
          },
          null,
          2,
        ),
      )
    } else {
      console.log('Routing Configuration:')
      console.log('='.repeat(60))
      console.log('\nModel Map:')
      for (const [pattern, providerId] of Object.entries(config.routing.modelMap)) {
        const state = providerStates[providerId]
        const status = state?.enabled && state?.available ? '✓' : '✗'
        console.log(`  ${status} ${pattern} → ${providerId}`)
      }
      console.log('\nFallback Chain:')
      config.routing.fallbackChain.forEach((id, index) => {
        const state = providerStates[id]
        const status = state?.enabled && state?.available ? '✓' : '✗'
        console.log(`  ${index + 1}. ${status} ${id}`)
      })
      console.log('\nProvider States:')
      for (const [id, state] of Object.entries(providerStates)) {
        console.log(
          `  ${id}: enabled=${state.enabled}, circuit=${state.circuitState}, available=${state.available}`,
        )
      }
    }
  })

// ============================================================================
// test command
// ============================================================================
program
  .command('test')
  .description('Send a test request to a model')
  .argument('<model>', 'Model identifier (e.g., ollama/llama2)')
  .option('-c, --config <path>', 'Path to config file')
  .option('--json', 'Output as JSON')
  .option(
    '-m, --message <message>',
    'Custom test message',
    'Hello, this is a test message from SuperProxy CLI.',
  )
  .action(async (model: string, options: { config?: string; json?: boolean; message?: string }) => {
    const config = loadConfig({ configPath: options.config })
    const { router } = bootstrapProviders(config)

    const providers = router.resolveAll(model)
    if (providers.length === 0) {
      const error = { error: `No providers available for model '${model}'` }
      if (options.json) {
        console.log(JSON.stringify(error, null, 2))
      } else {
        console.error(error.error)
      }
      process.exit(1)
    }

    const testMessage = options.message || 'Hello, this is a test message from SuperProxy CLI.'

    let success = false
    let lastError: string | undefined
    const results: Array<{
      provider: string
      success: boolean
      latencyMs?: number
      error?: string
      response?: string
    }> = []

    for (const provider of providers) {
      const providerId = provider.id
      const startTime = Date.now()

      try {
        // Get credentials
        const credentialResult = await provider.resolveCredentials()
        if (!credentialResult.ok) {
          throw new Error(`Credential error: ${credentialResult.error} - ${credentialResult.hint}`)
        }

        // Transform and send a real request through the pipeline
        const chatRequest = {
          model,
          messages: [{ role: 'user' as const, content: testMessage }],
          stream: false as const,
        }

        const backendRequest = provider.transformRequest(chatRequest)
        const abortController = new AbortController()
        const timeout = setTimeout(() => abortController.abort(), 30000)

        let responseText = ''
        try {
          const chunks = provider.streamCompletion(
            backendRequest,
            credentialResult.credential,
            abortController.signal,
          )
          for await (const chunk of chunks) {
            const content = chunk.choices?.[0]?.delta?.content
            if (content) responseText += content
          }
        } finally {
          clearTimeout(timeout)
        }

        const latencyMs = Date.now() - startTime
        success = true
        results.push({
          provider: providerId,
          success: true,
          latencyMs,
          response: responseText || '(empty response)',
        })
        break // Stop at first successful provider
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        lastError = error
        results.push({
          provider: providerId,
          success: false,
          error,
        })
      }
    }

    const result = {
      model,
      success,
      results,
      finalProvider: results.find((r) => r.success)?.provider,
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`Test Request: ${model}`)
      console.log('='.repeat(60))
      console.log(`Message: ${testMessage}`)
      console.log('')
      for (const r of results) {
        const status = r.success ? '✓' : '✗'
        console.log(`${status} ${r.provider}`)
        if (r.success) {
          console.log(`  Latency: ${r.latencyMs}ms`)
          console.log(`  Response: ${r.response}`)
        } else {
          console.log(`  Error: ${r.error}`)
        }
      }
      console.log('')
      console.log(
        success ? `SUCCESS: Request handled by ${result.finalProvider}` : `FAILED: ${lastError}`,
      )
    }

    process.exit(success ? 0 : 1)
  })

program.parse()
