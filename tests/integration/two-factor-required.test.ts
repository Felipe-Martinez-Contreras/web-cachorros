import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, TEST_ADMIN } from './session'

// Producción con AUTH_REQUIRE_2FA=true: la variable se fija antes de cargar los módulos (env se lee una vez).
vi.stubEnv('AUTH_REQUIRE_2FA', 'true')

const { sql } = await import('@/db/client')
const { requirePanelUser } = await import('@/lib/auth/session')
const { crearRival } = await import('@/features/teams/actions')
const { cerrarMisOtrasSesiones } = await import('@/features/users/actions')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
const setTwoFactor = (enabled: boolean) =>
  admin`update "user" set two_factor_enabled = ${enabled} where email = ${TEST_ADMIN.email}`

beforeAll(async () => {
  await ensureTestUsers()
  await admin`delete from teams where name like 'Rival dos pasos%'`
})

afterAll(async () => {
  await setTwoFactor(false)
  await admin`delete from teams where name like 'Rival dos pasos%'`
  vi.unstubAllEnvs()
  await admin.end()
  await sql.end()
})

const rival = (name: string) => ({ name, shortName: 'Dos pasos', commune: '', crestMediaId: '' })

describe('AUTH_REQUIRE_2FA=true', () => {
  it('sin los dos pasos, el panel lleva a «Mi cuenta» y las acciones se rechazan', async () => {
    await setTwoFactor(false)
    await actAs('admin')
    await expect(requirePanelUser('matches:write')).rejects.toThrow(
      'REDIRECT:/admin/cuenta?dos-pasos=obligatorio',
    )
    await expect(requirePanelUser()).rejects.toThrow('REDIRECT:/admin/cuenta?dos-pasos=obligatorio')
    // «Mi cuenta» sí se puede usar, para activarlos.
    await expect(requirePanelUser('panel:access', { allowWithoutTwoFactor: true })).resolves.toMatchObject({
      email: TEST_ADMIN.email,
    })
    expect(await crearRival(rival('Rival dos pasos sin activar'))).toEqual({
      ok: false,
      message: 'Activa la verificación en dos pasos en «Mi cuenta» para seguir usando el panel.',
    })
    expect((await cerrarMisOtrasSesiones()).ok).toBe(true)
  })

  it('con los dos pasos activos, todo funciona', async () => {
    await setTwoFactor(true)
    await actAs('admin')
    await expect(requirePanelUser('matches:write')).resolves.toMatchObject({ twoFactorEnabled: true })
    expect((await crearRival(rival('Rival dos pasos activos'))).ok).toBe(true)
  })
})
