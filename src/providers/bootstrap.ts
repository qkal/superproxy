import type { ProxyConfig } from '@/types/config'
import { ProviderRegistry } from './registry'
import { Router } from '@/router/router'
import { CredentialCache } from '@/auth/cache'
import { OllamaAdapter } from './ollama/adapter'

export interface BootstrapResult {
  registry: ProviderRegistry
  router: Router
  credentialCache: CredentialCache
}

export function bootstrapProviders(config: ProxyConfig): BootstrapResult {
  // Create registry with circuit breaker config
  const registry = new ProviderRegistry(config.circuitBreaker)

  // Register enabled providers
  if (config.providers.ollama?.enabled) {
    registry.register(new OllamaAdapter(config.providers.ollama))
  }

  // Create router with registry's adapters and breakers
  const router = new Router(config.routing, registry.adapters, registry.breakers)

  // Create credential cache with global TTL
  const credentialCache = new CredentialCache(config.streaming.availabilityCheckTtlMs)

  return { registry, router, credentialCache }
}
