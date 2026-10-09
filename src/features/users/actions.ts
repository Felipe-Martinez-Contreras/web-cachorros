'use server'

import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { Tx } from '@/db/client'
import { account, session, user } from '@/db/schema'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { getAuth } from '@/lib/auth'
import { markInvite } from '@/lib/auth/options'
import { getCurrentSessionId, requirePermission } from '@/lib/auth/session'
import { mutate, Rejection } from '@/lib/entity-action'
import { logger, maskEmail } from '@/lib/logger'
import { runAction } from '@/lib/run-action'
import { z } from '@/lib/zod'
import { type TwoFactorStart, twoFactorSetup } from './lib/two-factor'
import { changePasswordSchema, confirmPasswordSchema, inviteUserSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const nothing = z.unknown()
const GONE = 'No encontramos esa cuenta.'
// Nada de esto se ve en el sitio público: no hay tags de caché que invalidar.
const manage = { permission: 'users:manage' as const, entityType: 'user', tags: [] as string[] }
const own = { permission: 'panel:access' as const, entityType: 'user', tags: [] as string[] }

/** Los ids de usuario los genera Better Auth (texto, no uuid): se valida su forma antes de consultar. */
function assertUserId(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new Rejection(GONE)
  return id
}

async function findUser(tx: Tx, id: string) {
  const [row] = await tx
    .select({ id: user.id, name: user.name, email: user.email, banned: user.banned, role: user.role })
    .from(user)
    .where(eq(user.id, id))
    .for('update')
  if (!row) throw new Rejection(GONE)
  return row
}

/** Envía el enlace para crear la contraseña con el texto de invitación. No bloquea ni revela nada. */
async function sendInviteLink(email: string): Promise<void> {
  markInvite(email)
  try {
    await getAuth().api.requestPasswordReset({ body: { email } })
  } catch (error) {
    logger.error({ err: error, to: maskEmail(email) }, 'no se pudo enviar la invitación')
  }
}

/** Crea la cuenta de un administrador y le envía el enlace para definir su contraseña (válido 1 hora). */
export async function invitarAdministrador(input: unknown): Result {
  let email: string | undefined
  const result = await mutate({
    ...manage,
    action: 'user.invite',
    schema: inviteUserSchema,
    input,
    constraints: { user_email_unique: { message: 'Ya existe una cuenta con ese correo.', field: 'email' } },
    write: async (tx, data) => {
      const id = randomUUID()
      const ctx = await getAuth().$context
      await tx
        .insert(user)
        .values({ id, name: data.name, email: data.email, emailVerified: true, role: 'admin' })
      // Contraseña al azar que nadie conoce: la persona define la suya con el enlace del correo.
      await tx.insert(account).values({
        id: randomUUID(),
        userId: id,
        providerId: 'credential',
        accountId: id,
        password: await ctx.password.hash(randomBytes(32).toString('base64url')),
        updatedAt: new Date(),
      })
      email = data.email
      return { id, summary: `Invitó a ${data.name} como administrador` }
    },
  })
  if (result.ok && email) await sendInviteLink(email)
  return result
}

/** Vuelve a enviar el enlace para crear la contraseña (el anterior vence en 1 hora). */
export async function reenviarInvitacion(id: string): Result {
  let email: string | undefined
  const result = await mutate({
    ...manage,
    action: 'user.invite.resend',
    schema: nothing,
    input: null,
    write: async (tx) => {
      const target = await findUser(tx, assertUserId(id))
      if (target.banned)
        throw new Rejection('Esa cuenta está desactivada. Reactívala antes de enviar el enlace.')
      email = target.email
      return { id: target.id, summary: `Envió a ${target.name} el enlace para crear su contraseña` }
    },
  })
  if (result.ok && email) await sendInviteLink(email)
  return result
}

export async function desactivarUsuario(id: string): Result {
  return mutate({
    ...manage,
    action: 'user.deactivate',
    schema: nothing,
    input: null,
    write: async (tx, _data, me) => {
      const target = await findUser(tx, assertUserId(id))
      // Quien desactiva es un administrador activo y no puede desactivarse a sí mismo: siempre queda uno.
      if (target.id === me.id) throw new Rejection('No puedes desactivar tu propia cuenta.')
      await tx
        .update(user)
        .set({ banned: true, banReason: 'Desactivada desde el panel', banExpires: null })
        .where(eq(user.id, target.id))
      // Pierde el acceso de inmediato, en todos sus dispositivos.
      await tx.delete(session).where(eq(session.userId, target.id))
      return { id: target.id, summary: `Desactivó la cuenta de ${target.name}` }
    },
  })
}

export async function reactivarUsuario(id: string): Result {
  return mutate({
    ...manage,
    action: 'user.reactivate',
    schema: nothing,
    input: null,
    write: async (tx) => {
      const target = await findUser(tx, assertUserId(id))
      await tx
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(user.id, target.id))
      return { id: target.id, summary: `Reactivó la cuenta de ${target.name}` }
    },
  })
}

/** Cierra todas las sesiones de otra persona (por ejemplo, si perdió su celular). */
export async function cerrarSesionesDeUsuario(id: string): Result {
  return mutate({
    ...manage,
    action: 'user.sessions.revoke',
    schema: nothing,
    input: null,
    write: async (tx, _data, me) => {
      const target = await findUser(tx, assertUserId(id))
      if (target.id === me.id) throw new Rejection('Para cerrar tus otras sesiones usa «Mi cuenta».')
      await tx.delete(session).where(eq(session.userId, target.id))
      return { id: target.id, summary: `Cerró las sesiones de ${target.name}` }
    },
  })
}

// ── Mi cuenta ───────────────────────────────────────────────────────────────────────────────────

/** Cambia la contraseña propia y cierra las demás sesiones; la sesión en uso sigue abierta. */
export async function cambiarMiContrasena(input: unknown): Result {
  const currentSessionId = await getCurrentSessionId()
  return mutate({
    ...own,
    action: 'user.password.change',
    schema: changePasswordSchema,
    input,
    write: async (tx, data, me) => {
      const [credential] = await tx
        .select({ id: account.id, password: account.password })
        .from(account)
        .where(and(eq(account.userId, me.id), eq(account.providerId, 'credential')))
        .for('update')
      const ctx = await getAuth().$context
      const valid =
        credential?.password &&
        (await ctx.password.verify({ hash: credential.password, password: data.currentPassword }))
      if (!credential || !valid)
        throw new Rejection('La contraseña actual no es correcta.', 'currentPassword')
      await tx
        .update(account)
        .set({ password: await ctx.password.hash(data.newPassword) })
        .where(eq(account.id, credential.id))
      await tx
        .delete(session)
        .where(
          and(eq(session.userId, me.id), currentSessionId ? ne(session.id, currentSessionId) : undefined),
        )
      return { id: me.id, summary: 'Cambió su contraseña' }
    },
  })
}

export async function cerrarMisOtrasSesiones(): Result {
  const currentSessionId = await getCurrentSessionId()
  return mutate({
    ...own,
    action: 'user.sessions.revoke_others',
    schema: nothing,
    input: null,
    write: async (tx, _data, me) => {
      if (!currentSessionId) throw new Rejection('Tu sesión venció. Vuelve a entrar.')
      await tx.delete(session).where(and(eq(session.userId, me.id), ne(session.id, currentSessionId)))
      return { id: me.id, summary: 'Cerró sus otras sesiones' }
    },
  })
}

/**
 * Primer paso para activar la verificación en dos pasos: pide la contraseña y entrega el código QR, la
 * clave y los códigos de respaldo. Queda activa recién cuando el navegador confirma un código de la app.
 */
export async function iniciarDosPasos(input: unknown): Promise<ActionResult<TwoFactorStart>> {
  return runAction('user.2fa.start', async () => {
    await requirePermission('panel:access')
    const parsed = confirmPasswordSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error)
    try {
      const data = await getAuth().api.enableTwoFactor({
        body: { password: parsed.data.password },
        headers: await headers(),
      })
      const setup = 'totpURI' in data && data.totpURI ? twoFactorSetup(data.totpURI) : null
      if (!setup || !('backupCodes' in data) || !data.backupCodes) {
        return fail('No pudimos preparar la verificación en dos pasos. Inténtalo de nuevo.')
      }
      return ok({ ...setup, backupCodes: data.backupCodes })
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code
      if (code === 'INVALID_PASSWORD') {
        return {
          ok: false,
          message: 'Revisa los campos marcados.',
          fieldErrors: { password: ['La contraseña no es correcta.'] },
        }
      }
      if (code === 'TOTP_ALREADY_ENABLED') return fail('La verificación en dos pasos ya está activada.')
      throw error
    }
  })
}
