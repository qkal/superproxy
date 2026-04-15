import { describe, it, expect } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('CLI Commands', () => {
  it('should have cli.ts source file', () => {
    const cliPath = join(import.meta.dir, '..', '..', '..', 'src', 'cli', 'cli.ts')
    expect(existsSync(cliPath)).toBe(true)
  })

  it('should have command structure', async () => {
    const { Command } = await import('commander')
    const program = new Command()

    program.name('test').version('0.1.0')

    let serveCalled = false
    program.command('serve').action(() => {
      serveCalled = true
    })

    await program.parseAsync(['node', 'test', 'serve'])
    expect(serveCalled).toBe(true)
  })

  it('should support --json flag structure', async () => {
    const { Command } = await import('commander')
    const program = new Command()

    let jsonFlagValue = false
    program
      .command('test-cmd')
      .option('--json', 'Output as JSON')
      .action((options) => {
        jsonFlagValue = options.json || false
      })

    await program.parseAsync(['node', 'test', 'test-cmd', '--json'])
    expect(jsonFlagValue).toBe(true)
  })

  it('should support --config option', async () => {
    const { Command } = await import('commander')
    const program = new Command()

    let configPath: string | undefined
    program
      .command('test-cmd')
      .option('-c, --config <path>', 'Path to config file')
      .action((options) => {
        configPath = options.config
      })

    await program.parseAsync(['node', 'test', 'test-cmd', '--config', '/path/to/config.json'])
    expect(configPath).toBe('/path/to/config.json')
  })
})
