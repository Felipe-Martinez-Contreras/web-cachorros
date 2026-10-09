import 'server-only'
import postgres from 'postgres'
import { env } from '@/lib/env'

const PROXY_POOL_MAX = 2

function createClient() {
  // Igual que el cliente de la app: conecta recién con la primera consulta (el build no toca la BD).
  return postgres(env.DATABASE_URL ?? 'postgres://sin-configurar', {
    max: PROXY_POOL_MAX,
    idle_timeout: 30,
    // Corto: si la base no responde, el proxy deja pasar la petición en vez de retenerla.
    connect_timeout: 3,
    onnotice: () => {},
  })
}

const globalForDb = globalThis as typeof globalThis & {
  __cachorrosProxySql?: ReturnType<typeof createClient>
}

/**
 * Conexión de `proxy.ts` (ADR 0008). El proxy se empaqueta aparte y no comparte el pool de la app: el suyo
 * se limita a 2 conexiones para no pasar del presupuesto de PostgreSQL (5 + 2). Solo lo usan las consultas
 * de estado de un slug (`src/features/<dominio>/slug.ts`).
 */
export const proxySql = globalForDb.__cachorrosProxySql ?? createClient()
if (env.SITE_ENV === 'development') globalForDb.__cachorrosProxySql = proxySql
