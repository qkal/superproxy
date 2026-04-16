import type { CredentialResult, CredentialResolver } from '@/auth/types'
import { ResolvedCredential } from '@/auth/credential'
import type { CloudProviderConfig } from '@/types/config'
import { readFileSync } from 'node:fs'

export class OpenAICompatCredentialResolver implements CredentialResolver {
  readonly #config: CloudProviderConfig & { apiKey?: string }

  constructor(config: CloudProviderConfig & { apiKey?: string }) {
    this.#config = config
  }

  async resolve(): Promise<CredentialResult> {
    // 1. Inline apiKey in config
    if (this.#config.apiKey) {
      return { ok: true, credential: new ResolvedCredential(this.#config.apiKey) }
    }

    // 2. Environment variable
    const envKey = process.env.OPENAI_COMPAT_API_KEY ?? process.env.OPENAI_API_KEY
    if (envKey) {
      return { ok: true, credential: new ResolvedCredential(envKey) }
    }

    // 3. Credential file
    if (this.#config.credentialFilePath) {
      try {
        const raw = readFileSync(this.#config.credentialFilePath, 'utf-8').trim()
        if (!raw) {
          return { ok: false, error: 'parse_failed', hint: `Empty credential file: ${this.#config.credentialFilePath}` }
        }
        return { ok: true, credential: new ResolvedCredential(raw) }
      } catch (err) {
        return {
          ok: false,
          error: 'not_found',
          hint: `Cannot read credential file: ${this.#config.credentialFilePath} (${err instanceof Error ? err.message : String(err)})`,
        }
      }
    }

    return {
      ok: false,
      error: 'not_found',
      hint: 'Set OPENAI_COMPAT_API_KEY or OPENAI_API_KEY env var, or configure apiKey / credentialFilePath',
    }
  }
}
