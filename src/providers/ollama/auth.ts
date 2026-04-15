import type { CredentialResult, CredentialResolver } from '@/auth/types'
import { ResolvedCredential } from '@/auth/credential'

export class OllamaCredentialResolver implements CredentialResolver {
  async resolve(): Promise<CredentialResult> {
    return {
      ok: true,
      credential: new ResolvedCredential('ollama-no-auth-required'),
    }
  }
}
