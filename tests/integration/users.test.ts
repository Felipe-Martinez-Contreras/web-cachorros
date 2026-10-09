import { and, desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { totpCode } from '../totp'
import { actAs, ensureTestUsers, nextState, TEST_ADMIN } from './session'

const { db, sql } = await import('@/db/client')
const { account, auditLog, session, twoFactor, user } = await import('@/db/schema')
const actions = await import('@/features/users/actions')
const { getMyAccount, listUsersAdmin } = await import('@/features/users/queries')
const { listAuditLog, SYSTEM_ACTOR } = await import('@/features/audit/queries')
const { getAuth } = await import('@/lib/auth')
const { createAdmin } = await import('@/lib/auth/create-admin')
const { getCurrentSessionId, requirePanelUser } = await import('@/lib/auth/session')

const PASSWORD = 'clave-de-pruebas-2026'
const OTHER = { name: 'Otra Admin', email: 'usuarios-otra@cachorros.test', password: PASSWORD }
const SECURE = { name: 'Admin Dos Pasos', email: 'usuarios-dos-pasos@cachorros.test', password: PASSWORD }
const INVITED = 'usuarios-invitada@cachorros.test'
const ORIGIN = 'http://localhost:3000'
let adminId: string

async function signIn(credentials: { email: string; password: string }) {
  const { headers, response } = await getAuth().api.signInEmail({
    body: credentials,
    returnHeaders: true,
  })
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  return { headers: new Headers({ cookie }), response }
}

const idByEmail = async (email: string) => {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
  return row?.id ?? ''
}

async function cleanUp() {
  for (const email of [OTHER.email, SECURE.email, INVITED]) {
    const id = await idByEmail(email)
    if (!id) continue
    await db.delete(auditLog).where(eq(auditLog.userId, id))
    await db.delete(user).where(eq(user.id, id))
  }
}

beforeAll(async () => {
  await cleanUp()
  ;({ adminId } = await ensureTestUsers())
  await createAdmin(OTHER, { reset: true })
  await createAdmin(SECURE, { reset: true })
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await cleanUp()
  // Las demás pruebas entran con esta contraseña.
  await createAdmin(TEST_ADMIN, { reset: true })
  await sql.end()
})

describe('administrar usuarios', () => {
  it('solo quien administra usuarios puede invitar, desactivar o cerrar sesiones', async () => {
    const otherId = await idByEmail(OTHER.email)
    for (const who of ['nadie', 'prensa'] as const) {
      await actAs(who)
      const message =
        who === 'nadie' ? 'Debes iniciar sesión para continuar.' : 'No tienes permiso para hacer esto.'
      for (const result of [
        await actions.invitarAdministrador({ name: 'Intrusa', email: 'intrusa@cachorros.test' }),
        await actions.desactivarUsuario(otherId),
        await actions.cerrarSesionesDeUsuario(otherId),
        await actions.reenviarInvitacion(otherId),
      ]) {
        expect(result).toEqual({ ok: false, message })
      }
    }
    expect(await idByEmail('intrusa@cachorros.test')).toBe('')
  })

  it('invita: crea la cuenta como administrador, sin contraseña conocida, y audita', async () => {
    expect(await actions.invitarAdministrador({ name: '', email: 'no-es-correo' })).toMatchObject({
      ok: false,
      fieldErrors: { name: ['Escribe el nombre de la persona.'], email: ['Escribe un correo válido.'] },
    })
    const result = await actions.invitarAdministrador({
      name: 'Persona Invitada',
      email: ` ${INVITED.toUpperCase()} `,
    })
    expect(result).toMatchObject({ ok: true })
    const id = await idByEmail(INVITED)
    const [created] = await db.select().from(user).where(eq(user.id, id))
    expect(created).toMatchObject({
      name: 'Persona Invitada',
      role: 'admin',
      banned: false,
      emailVerified: true,
    })
    const [credential] = await db.select().from(account).where(eq(account.userId, id))
    expect(credential).toMatchObject({ providerId: 'credential' })
    expect(credential?.password).toBeTruthy()

    const [entry] = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(1)
    expect(entry).toMatchObject({ action: 'user.invite', userId: adminId, entityId: id })
    // El correo no queda en la auditoría.
    expect(JSON.stringify(entry)).not.toContain(INVITED)

    expect(await actions.invitarAdministrador({ name: 'Repetida', email: INVITED })).toMatchObject({
      ok: false,
      fieldErrors: { email: ['Ya existe una cuenta con ese correo.'] },
    })
    expect(await actions.reenviarInvitacion(id)).toMatchObject({ ok: true })
    expect((await listUsersAdmin()).find((row) => row.id === id)).toMatchObject({
      isActive: true,
      twoFactorEnabled: false,
      activeSessions: 0,
    })
  })

  it('desactivar cierra las sesiones y quita el acceso; nadie se desactiva a sí mismo', async () => {
    expect(await actions.desactivarUsuario(adminId)).toEqual({
      ok: false,
      message: 'No puedes desactivar tu propia cuenta.',
    })
    expect(await actions.desactivarUsuario('no existe')).toMatchObject({ ok: false })

    const otherId = await idByEmail(OTHER.email)
    const other = await signIn(OTHER)
    expect(await db.select().from(session).where(eq(session.userId, otherId))).toHaveLength(1)

    expect(await actions.desactivarUsuario(otherId)).toMatchObject({ ok: true })
    expect(await db.select().from(session).where(eq(session.userId, otherId))).toEqual([])
    nextState.headers = other.headers
    await expect(requirePanelUser()).rejects.toThrow('REDIRECT:/admin/login')
    await expect(signIn(OTHER)).rejects.toThrow()

    await actAs('admin')
    expect(await actions.reenviarInvitacion(otherId)).toMatchObject({
      ok: false,
      message: expect.stringContaining('está desactivada'),
    })
    expect(await actions.reactivarUsuario(otherId)).toMatchObject({ ok: true })
    await signIn(OTHER)
    expect(await actions.cerrarSesionesDeUsuario(otherId)).toMatchObject({ ok: true })
    expect(await db.select().from(session).where(eq(session.userId, otherId))).toEqual([])
    expect(await actions.cerrarSesionesDeUsuario(adminId)).toMatchObject({ ok: false })
  })
})

describe('mi cuenta', () => {
  it('cambia la contraseña, cierra las otras sesiones y conserva la actual', async () => {
    const otherId = await idByEmail(OTHER.email)
    const elsewhere = await signIn(OTHER)
    const here = await signIn(OTHER)
    nextState.headers = here.headers
    const currentId = await getCurrentSessionId()

    const change = (input: Record<string, string>) => actions.cambiarMiContrasena(input)
    expect(
      await change({
        currentPassword: 'incorrecta',
        newPassword: 'una-frase-nueva-2026',
        confirm: 'una-frase-nueva-2026',
      }),
    ).toMatchObject({ ok: false, fieldErrors: { currentPassword: ['La contraseña actual no es correcta.'] } })
    expect(await change({ currentPassword: PASSWORD, newPassword: 'corta', confirm: 'corta' })).toMatchObject(
      {
        ok: false,
        fieldErrors: { newPassword: ['La contraseña debe tener al menos 12 caracteres.'] },
      },
    )
    expect(
      await change({
        currentPassword: PASSWORD,
        newPassword: 'una-frase-nueva-2026',
        confirm: 'otra-distinta-2026',
      }),
    ).toMatchObject({ ok: false, fieldErrors: { confirm: ['Las contraseñas no coinciden.'] } })
    expect(
      await change({ currentPassword: PASSWORD, newPassword: PASSWORD, confirm: PASSWORD }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { newPassword: ['Elige una contraseña distinta de la actual.'] },
    })

    expect(
      await change({
        currentPassword: PASSWORD,
        newPassword: 'una-frase-nueva-2026',
        confirm: 'una-frase-nueva-2026',
      }),
    ).toMatchObject({ ok: true })
    const remaining = await db.select({ id: session.id }).from(session).where(eq(session.userId, otherId))
    expect(remaining).toEqual([{ id: currentId }])
    nextState.headers = elsewhere.headers
    await expect(requirePanelUser()).rejects.toThrow('REDIRECT:/admin/login')
    await expect(signIn(OTHER)).rejects.toThrow()
    await signIn({ email: OTHER.email, password: 'una-frase-nueva-2026' })

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, otherId), eq(auditLog.action, 'user.password.change')))
    expect(entry?.summary).toBe('Cambió su contraseña')
    expect(JSON.stringify(entry)).not.toContain('una-frase-nueva-2026')
  })

  it('lista las sesiones propias y cierra las demás', async () => {
    const credentials = { email: OTHER.email, password: 'una-frase-nueva-2026' }
    const otherId = await idByEmail(OTHER.email)
    await db.delete(session).where(eq(session.userId, otherId))
    await signIn(credentials)
    const here = await signIn(credentials)
    nextState.headers = here.headers
    const currentId = await getCurrentSessionId()

    const mine = await getMyAccount(otherId, currentId)
    expect(mine.sessions).toHaveLength(2)
    expect(mine.sessions.filter((item) => item.isCurrent).map((item) => item.id)).toEqual([currentId])

    expect(await actions.cerrarMisOtrasSesiones()).toMatchObject({ ok: true })
    expect((await getMyAccount(otherId, currentId)).sessions.map((item) => item.id)).toEqual([currentId])
  })
})

describe('verificación en dos pasos', () => {
  const post = (path: string, headers: Headers, body: unknown) =>
    getAuth().handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: 'POST',
        headers: { cookie: headers.get('cookie') ?? '', 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify(body),
      }),
    )
  const cookiesOf = (response: Response) =>
    new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    })

  it('se activa con contraseña + código de la app, pide el código al entrar y se puede desactivar', async () => {
    const secureId = await idByEmail(SECURE.email)
    const first = await signIn(SECURE)
    nextState.headers = first.headers

    expect(await actions.iniciarDosPasos({ password: 'incorrecta' })).toMatchObject({
      ok: false,
      fieldErrors: { password: ['La contraseña no es correcta.'] },
    })
    const started = await actions.iniciarDosPasos({ password: PASSWORD })
    if (!started.ok) throw new Error(started.message)
    expect(started.data.uri).toMatch(/^otpauth:\/\/totp\//)
    expect(started.data.qr).toMatch(/^data:image\/svg\+xml;utf8,/)
    expect(decodeURIComponent(started.data.qr)).toContain('<svg')
    expect(started.data.backupCodes.length).toBeGreaterThanOrEqual(8)
    // Todavía no está activa: falta confirmar un código.
    expect((await getMyAccount(secureId, null)).twoFactorEnabled).toBe(false)

    const wrong = await post('/two-factor/verify-totp', first.headers, { code: '000000' })
    expect(wrong.status).toBe(401)
    const verified = await post('/two-factor/verify-totp', first.headers, {
      code: totpCode(started.data.uri),
    })
    expect(verified.status).toBe(200)
    expect((await getMyAccount(secureId, null)).twoFactorEnabled).toBe(true)
    expect((await listUsersAdmin()).find((row) => row.id === secureId)?.twoFactorEnabled).toBe(true)
    const [enabled] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, secureId), eq(auditLog.action, 'user.2fa.enable')))
    expect(enabled?.summary).toBe('Activó la verificación en dos pasos')
    // El secreto se guarda cifrado, nunca tal cual.
    const [stored] = await db.select().from(twoFactor).where(eq(twoFactor.userId, secureId))
    const secret = new URL(started.data.uri).searchParams.get('secret') ?? ''
    expect(stored?.secret).not.toContain(secret)

    // Al entrar, la contraseña ya no basta: no hay sesión hasta dar el código.
    const login = await post('/sign-in/email', new Headers(), SECURE)
    expect(await login.json()).toMatchObject({ twoFactorRedirect: true })
    const pending = cookiesOf(login)
    nextState.headers = pending
    await expect(requirePanelUser()).rejects.toThrow('REDIRECT:/admin/login')
    const second = await post('/two-factor/verify-totp', pending, { code: totpCode(started.data.uri) })
    expect(second.status).toBe(200)
    const session2 = cookiesOf(second)
    nextState.headers = session2
    await expect(requirePanelUser()).resolves.toMatchObject({ email: SECURE.email })
    // Entrar con el código no es «activar»: se audita una sola vez.
    const enables = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, secureId), eq(auditLog.action, 'user.2fa.enable')))
    expect(enables).toHaveLength(1)

    // Un código de respaldo sirve una vez.
    const login2 = await post('/sign-in/email', new Headers(), SECURE)
    const backup = started.data.backupCodes[0]
    expect((await post('/two-factor/verify-backup-code', cookiesOf(login2), { code: backup })).status).toBe(
      200,
    )
    const login3 = await post('/sign-in/email', new Headers(), SECURE)
    expect((await post('/two-factor/verify-backup-code', cookiesOf(login3), { code: backup })).status).toBe(
      401,
    )

    const disabled = await post('/two-factor/disable', session2, { password: PASSWORD })
    expect(disabled.status).toBe(200)
    expect((await getMyAccount(secureId, null)).twoFactorEnabled).toBe(false)
    expect(await db.select().from(twoFactor).where(eq(twoFactor.userId, secureId))).toEqual([])
    const [off] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, secureId), eq(auditLog.action, 'user.2fa.disable')))
    expect(off?.summary).toBe('Desactivó la verificación en dos pasos')
  })
})

describe('actividad', () => {
  it('filtra por persona, por tipo y por día, y distingue lo que hizo el sistema', async () => {
    const all = await listAuditLog({})
    expect(all.total).toBeGreaterThan(5)
    expect(all.items[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(all.items[1]?.createdAt.getTime() ?? 0)

    const mine = await listAuditLog({ userId: adminId, entityType: 'user' })
    expect(mine.total).toBeGreaterThan(0)
    expect(mine.items.every((item) => item.userName === TEST_ADMIN.name && item.entityType === 'user')).toBe(
      true,
    )

    const system = await listAuditLog({ userId: SYSTEM_ACTOR })
    expect(system.items.every((item) => item.userName === null)).toBe(true)
    expect(system.total).toBeGreaterThan(0)

    expect((await listAuditLog({ from: '2999-01-01' })).total).toBe(0)
    expect((await listAuditLog({ to: '2000-01-01' })).total).toBe(0)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
    // Lo de hoy (día de Santiago, ambos extremos incluidos) trae lo que se acaba de hacer en esta prueba.
    expect((await listAuditLog({ from: today, to: today, userId: adminId, entityType: 'user' })).total).toBe(
      mine.total,
    )
    expect((await listAuditLog({ entityType: 'no_existe' })).total).toBe(0)
  })
})
