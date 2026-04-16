import type { CredentialResult, CredentialResolver } from '@/auth/types'
import { ResolvedCredential } from '@/auth/credential'
import type { CloudProviderConfig } from '@/types/config'
import { readFile } from 'node:fs/promises'

export class ClaudeCredentialResolver implements CredentialResolver {
  readonly #config: CloudProviderConfig

  constructor(config: CloudProviderConfig) {
    this.#config = config
  }

  async resolve(): Promise<CredentialResult> {
    // 1. Environment variable
    const envKey = process.env.ANTHROPIC_API_KEY
    if (envKey) {
      return { ok: true, credential: new ResolvedCredential(envKey) }
    }

    // 2. Credential file
    if (this.#config.credentialFilePath) {
      try {
        const raw = (await readFile(this.#config.credentialFilePath, 'utf-8')).trim()
        if (!raw) {
          return { ok: false, error: 'parse_failed', hint: `Empty credential file: ${this.#config.credentialFilePath}` }
        }
        return { ok: true, credential: new ResolvedCredential(raw) }
      } catch (err) {
        const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined
        const message = err instanceof Error ? err.message : String(err)
        const error: 'permission_denied' | 'not_found' =
          code === 'EACCES' || code === 'EPERM' ? 'permission_denied' : 'not_found'
        return {
          ok: false,
          error,
          hint: `Cannot read credential file: ${this.#config.credentialFilePath} (${message})`,
        }
      }
    }

    return {
      ok: false,
      error: 'not_found',
      hint: 'Set ANTHROPIC_API_KEY env var or configure credentialFilePath',
    }
  }
}
