import 'server-only'
import { and, asc, count, desc, eq, gt, max, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { session, user } from '@/db/schema'
import { describeDevice } from './lib/two-factor'

// Lecturas del panel: sin caché. Nunca salen del panel.

export type UserAdminRow = {
  id: string
  name: string
  email: string
  isActive: boolean
  twoFactorEnabled: boolean
  createdAt: Date
  activeSessions: number
  lastSeenAt: Date | null
}

/** Administradores con su estado y su última actividad (por sus sesiones vigentes). */
export async function listUsersAdmin(): Promise<UserAdminRow[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.banned,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      activeSessions: count(session.id),
      lastSeenAt: max(session.updatedAt),
    })
    .from(user)
    .leftJoin(session, and(eq(session.userId, user.id), gt(session.expiresAt, sql`now()`)))
    .where(eq(user.role, 'admin'))
    .groupBy(user.id)
    .orderBy(asc(user.name))
  return rows.map(({ banned, twoFactorEnabled, ...row }) => ({
    ...row,
    isActive: !banned,
    twoFactorEnabled: twoFactorEnabled ?? false,
  }))
}

/** Lo que muestra «Mi cuenta»: si tiene dos pasos y sus sesiones abiertas. */
export async function getMyAccount(userId: string, currentSessionId: string | null) {
  const [[me], sessions] = await Promise.all([
    db.select({ twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)),
    db
      .select({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })
      .from(session)
      .where(and(eq(session.userId, userId), gt(session.expiresAt, sql`now()`)))
      .orderBy(desc(session.updatedAt)),
  ])
  return {
    twoFactorEnabled: me?.twoFactorEnabled ?? false,
    sessions: sessions.map((item) => ({
      id: item.id,
      device: describeDevice(item.userAgent),
      startedAt: item.createdAt,
      lastSeenAt: item.updatedAt,
      isCurrent: item.id === currentSessionId,
    })),
  }
}
