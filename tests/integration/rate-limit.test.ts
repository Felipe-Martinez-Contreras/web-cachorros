import postgres from 'postgres'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { testDb } from './db-urls'

// El rate limit del login solo puede estar apagado en desarrollo (ADR 0004). Se prueba el comportamiento real:
// peticiones HTTP al manejador de Better Auth, con los contadores guardados en la base de datos.
const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
const ATTEMPTS = 8

async function loadAuth(siteEnv: string) {
  vi.resetModules()
  vi.stubEnv('SITE_ENV', siteEnv)
  const { getAuth } = await import('@/lib/auth')
  const { buildAuthOptions } = await import('@/lib/auth/options')
  const { sql } = await import('@/db/client')
  return { auth: getAuth(), options: buildAuthOptions(), close: () => sql.end() }
}

/** Intenta entrar varias veces seguidas desde la misma IP con una contraseña incorrecta. */
async function hammerLogin(siteEnv: string, ip: string) {
  const { auth, options, close } = await loadAuth(siteEnv)
  try {
    const statuses: number[] = []
    for (let i = 0; i < ATTEMPTS; i++) {
      const response = await auth.handler(
        new Request('http://localhost:3000/api/auth/sign-in/email', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'cf-connecting-ip': ip,
          },
          body: JSON.stringify({ email: 'nadie@cachorros.test', password: 'contraseña-equivocada' }),
        }),
      )
      statuses.push(response.status)
    }
    return { statuses, options }
  } finally {
    await close()
  }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await admin`delete from rate_limit`
})

afterAll(async () => {
  await admin.end()
})

describe('rate limit del login según SITE_ENV', () => {
  it.each(['staging', 'production'])(
    'está ACTIVO en %s: corta los intentos repetidos con 429',
    async (siteEnv) => {
      const { statuses, options } = await hammerLogin(siteEnv, '203.0.113.10')

      expect(options.rateLimit).toMatchObject({ enabled: true, storage: 'database' })
      expect(statuses[0]).toBe(401) // el primer intento llega al login y falla por credenciales
      expect(statuses).toContain(429)
      expect(statuses.at(-1)).toBe(429)

      // Almacenamiento persistente: los contadores viven en la tabla rate_limit, no en memoria.
      const [row] = await admin<{ n: number }[]>`select count(*)::int as n from rate_limit`
      expect(row?.n).toBeGreaterThan(0)
    },
  )

  it('está apagado solo en development: ningún intento recibe 429', async () => {
    const { statuses, options } = await hammerLogin('development', '203.0.113.20')

    expect(options.rateLimit.enabled).toBe(false)
    expect(statuses).toHaveLength(ATTEMPTS)
    expect(statuses.every((status) => status === 401)).toBe(true)

    const [row] = await admin<{ n: number }[]>`select count(*)::int as n from rate_limit`
    expect(row?.n).toBe(0)
  })

  it('cualquier valor que no sea development lo deja activo', async () => {
    const { options } = await loadAuthOptionsOnly('produccion-mal-escrita')
    expect(options.rateLimit.enabled).toBe(true)
  })
})

/** Solo las opciones, sin validar el entorno: para valores de SITE_ENV que env.ts rechazaría al arrancar. */
async function loadAuthOptionsOnly(siteEnv: string) {
  vi.resetModules()
  vi.stubEnv('SITE_ENV', siteEnv)
  vi.stubEnv('SKIP_ENV_VALIDATION', '1')
  const { buildAuthOptions } = await import('@/lib/auth/options')
  return { options: buildAuthOptions() }
}
