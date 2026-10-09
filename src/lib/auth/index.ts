import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { db } from '@/db/client'
import * as schema from '@/db/schema'
import { logger } from '@/lib/logger'
import { buildAuthOptions } from './options'

const VERIFY_TOTP = '/two-factor/verify-totp'
const DISABLE_TWO_FACTOR = '/two-factor/disable'

// Peticiones de «verificar código» que vienen de activar los dos pasos (y no de un inicio de sesión).
const enabling = new WeakSet<Request>()

async function auditSecurity(userId: string, action: string, summary: string): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({ userId, action, entityType: 'user', entityId: userId, summary })
  } catch (error) {
    // El cambio ya ocurrió: que falle el registro no debe dejar a la persona sin sesión.
    logger.error({ err: error, action }, 'no se pudo auditar un cambio de seguridad')
  }
}

function createAuth() {
  return betterAuth({
    ...buildAuthOptions(),
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // Estos dos cambios los hace el navegador contra /api/auth (reemplazan la cookie de sesión), así que
    // se auditan aquí y no en una Server Action (especificación 7.6).
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== VERIFY_TOTP || !ctx.request) return
        const session = await getSessionFromCtx(ctx)
        const user = session?.user as { twoFactorEnabled?: boolean | null } | undefined
        if (user && !user.twoFactorEnabled) enabling.add(ctx.request)
      }),
      after: createAuthMiddleware(async (ctx) => {
        const userId = ctx.context.newSession?.user.id
        if (!userId || ctx.context.returned instanceof Error) return
        if (ctx.path === DISABLE_TWO_FACTOR) {
          await auditSecurity(userId, 'user.2fa.disable', 'Desactivó la verificación en dos pasos')
        } else if (ctx.path === VERIFY_TOTP && ctx.request && enabling.has(ctx.request)) {
          await auditSecurity(userId, 'user.2fa.enable', 'Activó la verificación en dos pasos')
        }
      }),
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

let instance: Auth | undefined

/** Instancia perezosa: se crea con la primera petición, nunca durante `next build`. */
export function getAuth(): Auth {
  instance ??= createAuth()
  return instance
}
