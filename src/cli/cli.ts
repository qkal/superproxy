import { Command } from 'commander'
import { loadConfig } from '@/config/loader'
import { createLogger } from '@/logging/logger'
import { ProxyServer } from '@/server/server'

const program = new Command()

program.name('superproxy').version('0.1.0').description('Local AI coding assistant proxy')

program
  .command('serve')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('--host <host>', 'Host to bind to')
  .option('-c, --config <path>', 'Path to config file')
  .option('-l, --log-level <level>', 'Log level: debug, info, warn, error')
  .action(async (options) => {
    const overrides: Record<string, Record<string, unknown>> = {}
    if (options.port) overrides.server = { ...(overrides.server ?? {}), port: options.port }
    if (options.host) overrides.server = { ...(overrides.server ?? {}), host: options.host }
    if (options.logLevel)
      overrides.logging = { ...(overrides.logging ?? {}), level: options.logLevel }

    const config = loadConfig({
      configPath: options.config,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    })

    const logger = createLogger(config.logging)
    const server = new ProxyServer(config, logger)

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

program
  .command('doctor')
  .description('Check all enabled providers: credentials, permissions, reachability')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    const config = loadConfig({ configPath: options.config })
    const logger = createLogger(config.logging)
    logger.info('Running doctor checks...')
    logger.info('Doctor command is not yet fully implemented. This is a stub.')
    process.exit(0)
  })

program
  .command('providers')
  .description('List and manage providers')
  .addCommand(
    new Command('list')
      .description('List all registered providers')
      .option('-c, --config <path>', 'Path to config file')
      .action(async (options) => {
        const config = loadConfig({ configPath: options.config })
        console.log('Configured providers:')
        for (const [id, cfg] of Object.entries(config.providers)) {
          if (cfg) {
            console.log(`  ${id}: enabled=${'enabled' in cfg ? cfg.enabled : 'unknown'}`)
          }
        }
      }),
  )
  .addCommand(
    new Command('check')
      .description('Run preflight check on a single provider')
      .argument('<id>', 'Provider ID')
      .option('-c, --config <path>', 'Path to config file')
      .action(async (id: string, options: { config?: string }) => {
        console.log(`Checking provider: ${id}`)
        console.log('Provider check is not yet fully implemented. This is a stub.')
      }),
  )

program
  .command('config')
  .description('Configuration management')
  .addCommand(
    new Command('validate')
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
      }),
  )

program
  .command('routes')
  .description('Routing management')
  .addCommand(
    new Command('inspect')
      .description('Print the full resolved routing table')
      .option('-c, --config <path>', 'Path to config file')
      .action(async (options) => {
        const config = loadConfig({ configPath: options.config })
        console.log('Model map:')
        for (const [pattern, providerId] of Object.entries(config.routing.modelMap)) {
          console.log(`  ${pattern} → ${providerId}`)
        }
        console.log('Fallback chain:', config.routing.fallbackChain.join(' → '))
      }),
  )

program.parse()
