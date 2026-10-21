import { afterEach, describe, expect, it, vi } from 'vitest'

const VALID = {
  SITE_ENV: 'development',
  SITE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgres://cachorros_app:clave@localhost:5439/cachorros',
  BETTER_AUTH_SECRET: 'x'.repeat(44),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Club <no-responder@cachorros.test>',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  IP_HASH_SALT: 'sal-de-pruebas-unitarias-0123456789abcdef',
}

const MANAGED = [...Object.keys(VALID), 'SKIP_ENV_VALIDATION', 'NEXT_PHASE', 'DB_POOL_MAX', 'APP_VERSION']

async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules()
  for (const key of MANAGED) vi.stubEnv(key, undefined)
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) vi.stubEnv(key, value)
  return (await import('@/lib/env')).env
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('env', () => {
  it('acepta una configuración válida y aplica los valores por defecto', async () => {
    const env = await loadEnv()
    expect(env.SITE_URL).toBe('http://localhost:3000')
    expect(env.SMTP_PORT).toBe(1025)
    expect(env.DB_POOL_MAX).toBe(5)
    expect(env.APP_VERSION).toBe('dev')
  })

  it('si falta una variable obligatoria, explica en español cuál es', async () => {
    await expect(loadEnv({ BETTER_AUTH_SECRET: undefined })).rejects.toThrow(
      /Revisa estas variables de entorno[\s\S]*BETTER_AUTH_SECRET: Falta definirla/,
    )
  })

  it('trata una variable vacía como faltante', async () => {
    await expect(loadEnv({ DATABASE_URL: '' })).rejects.toThrow(/DATABASE_URL: Falta definirla/)
  })

  it('rechaza valores con formato incorrecto', async () => {
    await expect(loadEnv({ SITE_URL: 'cachorros' })).rejects.toThrow(/SITE_URL: Debe ser la URL pública/)
    await expect(loadEnv({ SITE_ENV: 'prod' })).rejects.toThrow(/SITE_ENV: Debe ser development, staging/)
    await expect(loadEnv({ BETTER_AUTH_SECRET: 'corta' })).rejects.toThrow(/al menos 32 caracteres/)
  })

  it('producción no arranca con las claves de prueba de Turnstile; staging sí', async () => {
    await expect(loadEnv({ SITE_ENV: 'production' })).rejects.toThrow(
      /TURNSTILE_SITE_KEY: Es una clave de prueba[\s\S]*TURNSTILE_SECRET_KEY: Es una clave de prueba/,
    )
    await expect(loadEnv({ SITE_ENV: 'staging' })).resolves.toBeDefined()
    await expect(
      loadEnv({
        SITE_ENV: 'production',
        TURNSTILE_SITE_KEY: '0x4AAAAAAABkMYinukE8nzYS',
        TURNSTILE_SECRET_KEY: '0x4AAAAAAABkMYinukE8nzYS-secreto-real',
      }),
    ).resolves.toBeDefined()
  })

  it('no valida mientras se compila (SKIP_ENV_VALIDATION o next build)', async () => {
    await expect(loadEnv({ BETTER_AUTH_SECRET: undefined, SKIP_ENV_VALIDATION: '1' })).resolves.toBeDefined()
    await expect(
      loadEnv({ BETTER_AUTH_SECRET: undefined, NEXT_PHASE: 'phase-production-build' }),
    ).resolves.toBeDefined()
  })
})
