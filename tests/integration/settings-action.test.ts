import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// La acción corre fuera de Next: se simulan las cabeceras de la petición y la invalidación de caché.
const request = vi.hoisted(() => ({ headers: new Headers(), updateTag: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))
vi.mock('next/cache', () => ({ updateTag: request.updateTag }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

const { db, sql } = await import('@/db/client')
const { auditLog, siteSettings, user } = await import('@/db/schema')
const { actualizarIdentidadClub } = await import('@/features/settings/actions')
const { getAuth } = await import('@/lib/auth')
const { createAdmin } = await import('@/lib/auth/create-admin')
const { requirePanelUser } = await import('@/lib/auth/session')

const ADMIN = { name: 'Admin Pruebas', email: 'admin@cachorros.test', password: 'clave-de-pruebas-2026' }
const PRENSA = { name: 'Prensa Pruebas', email: 'prensa@cachorros.test', password: 'clave-de-pruebas-2026' }

async function sessionHeadersFor(credentials: { email: string; password: string }): Promise<Headers> {
  const { headers } = await getAuth().api.signInEmail({
    body: { email: credentials.email, password: credentials.password },
    returnHeaders: true,
  })
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  return new Headers({ cookie })
}

const readSettings = async () => {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1))
  return row
}
const countAudit = async () => (await db.select().from(auditLog)).length

beforeAll(async () => {
  await createAdmin(ADMIN)
  await createAdmin(PRENSA)
  await db.update(user).set({ role: 'prensa' }).where(eq(user.email, PRENSA.email))
})

beforeEach(() => {
  request.headers = new Headers()
  request.updateTag.mockClear()
})

afterAll(async () => {
  await sql.end()
})

describe('actualizarIdentidadClub (Server Action protegida)', () => {
  const input = { clubName: 'Club Deportivo Los Cachorros', shortName: 'Los Cachorros' }

  it('rechaza la llamada sin sesión y no escribe nada', async () => {
    const before = await readSettings()
    const auditBefore = await countAudit()

    const result = await actualizarIdentidadClub(input)

    expect(result).toEqual({ ok: false, message: 'Debes iniciar sesión para continuar.' })
    expect(await readSettings()).toEqual(before)
    expect(await countAudit()).toBe(auditBefore)
    expect(request.updateTag).not.toHaveBeenCalled()
  })

  it('rechaza una cookie de sesión inventada', async () => {
    request.headers = new Headers({ cookie: 'better-auth.session_token=inventada.firma' })
    const result = await actualizarIdentidadClub(input)
    expect(result).toEqual({ ok: false, message: 'Debes iniciar sesión para continuar.' })
  })

  it('rechaza a un usuario con sesión pero sin el permiso', async () => {
    request.headers = await sessionHeadersFor(PRENSA)
    const result = await actualizarIdentidadClub(input)
    expect(result).toEqual({ ok: false, message: 'No tienes permiso para hacer esto.' })
    expect(request.updateTag).not.toHaveBeenCalled()
  })

  it('con sesión de admin valida los datos y responde errores por campo en español', async () => {
    request.headers = await sessionHeadersFor(ADMIN)
    const result = await actualizarIdentidadClub({ clubName: '', shortName: 'L' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors).toEqual({
      clubName: ['Escribe el nombre del club.'],
      shortName: ['Escribe el nombre corto.'],
    })
  })

  it('con sesión de admin guarda, audita e invalida el tag de configuración', async () => {
    request.headers = await sessionHeadersFor(ADMIN)
    const auditBefore = await countAudit()

    const result = await actualizarIdentidadClub(input)

    expect(result).toEqual({
      ok: true,
      data: { clubName: input.clubName, shortName: input.shortName, foundedOn: '1934-04-01' },
    })
    expect((await readSettings())?.shortName).toBe('Los Cachorros')
    expect(await countAudit()).toBe(auditBefore + 1)
    const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, 'settings.identity.update'))
    expect(entry).toMatchObject({ entityType: 'site_settings', entityId: '1', meta: input })
    expect(request.updateTag).toHaveBeenCalledWith('settings')
  })
})

describe('requirePanelUser (layout del panel)', () => {
  it('sin sesión redirige al login', async () => {
    await expect(requirePanelUser()).rejects.toThrow('REDIRECT:/admin/login')
  })

  it('con sesión sin acceso al panel redirige a la página de permiso', async () => {
    request.headers = await sessionHeadersFor(PRENSA)
    await expect(requirePanelUser()).rejects.toThrow('REDIRECT:/admin/sin-permiso')
  })

  it('con sesión de admin devuelve el usuario', async () => {
    request.headers = await sessionHeadersFor(ADMIN)
    await expect(requirePanelUser()).resolves.toMatchObject({ email: ADMIN.email, role: 'admin' })
  })

  it('una cuenta desactivada pierde el acceso aunque conserve la cookie', async () => {
    const headers = await sessionHeadersFor(ADMIN)
    await db.update(user).set({ banned: true }).where(eq(user.email, ADMIN.email))
    try {
      request.headers = headers
      await expect(requirePanelUser()).rejects.toThrow(/REDIRECT:/)
    } finally {
      await db.update(user).set({ banned: false }).where(eq(user.email, ADMIN.email))
    }
  })
})
