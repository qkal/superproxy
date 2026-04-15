import type { ResolvedCredential } from './credential'

export type CredentialResult =
  | { ok: true; credential: ResolvedCredential }
  | { ok: false; error: 'not_found' | 'parse_failed' | 'permission_denied'; hint: string }

export interface CredentialResolver {
  resolve(): Promise<CredentialResult>
}
