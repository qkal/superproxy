export class ResolvedCredential {
  readonly #value: string

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ResolvedCredential: value must be non-empty')
    }
    this.#value = value
  }

  applyToRequest(headers: Headers): void {
    headers.set('Authorization', `Bearer ${this.#value}`)
  }

  applyAnthropicHeaders(headers: Headers): void {
    headers.set('x-api-key', this.#value)
    headers.set('anthropic-version', '2023-06-01')
  }

  toJSON(): Record<string, never> {
    return {}
  }
}
