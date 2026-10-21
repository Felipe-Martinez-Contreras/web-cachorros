/**
 * *Token bucket* en memoria (especificación 9.4: instancia única). Cada clave parte con `capacity` envíos y
 * recupera uno cada `windowMs / capacity`.
 */
export class RateLimiter {
  readonly #buckets = new Map<string, { tokens: number; updatedAt: number }>()
  readonly #capacity: number
  readonly #refillMs: number
  readonly #maxKeys: number

  constructor(options: { capacity: number; windowMs: number; maxKeys?: number }) {
    this.#capacity = options.capacity
    this.#refillMs = options.windowMs / options.capacity
    this.#maxKeys = options.maxKeys ?? 10_000
  }

  /** Descuenta un envío. Si no quedan, dice en cuántos segundos vuelve a haber uno. */
  take(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const bucket = this.#refill(key, now)
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true }
    }
    const waitMs = (1 - bucket.tokens) * this.#refillMs
    return { allowed: false, retryAfterSeconds: Math.ceil(waitMs / 1000) }
  }

  #refill(key: string, now: number) {
    const current = this.#buckets.get(key)
    if (current) {
      const recovered = (now - current.updatedAt) / this.#refillMs
      current.tokens = Math.min(this.#capacity, current.tokens + recovered)
      current.updatedAt = now
      return current
    }
    if (this.#buckets.size >= this.#maxKeys) this.#prune(now)
    const bucket = { tokens: this.#capacity, updatedAt: now }
    this.#buckets.set(key, bucket)
    return bucket
  }

  /** Olvida las claves que ya recuperaron todos sus envíos: equivalen a una clave nueva. */
  #prune(now: number) {
    const fullAfterMs = this.#capacity * this.#refillMs
    for (const [key, bucket] of this.#buckets) {
      if (now - bucket.updatedAt >= fullAfterMs) this.#buckets.delete(key)
    }
    // Si todas están activas (muchas IP a la vez), se descartan las más antiguas.
    for (const key of this.#buckets.keys()) {
      if (this.#buckets.size < this.#maxKeys) break
      this.#buckets.delete(key)
    }
  }
}

/** Formularios públicos: 5 envíos cada 10 minutos por formulario e IP (especificación 9.4). */
export const formRateLimiter = new RateLimiter({ capacity: 5, windowMs: 10 * 60 * 1000 })
