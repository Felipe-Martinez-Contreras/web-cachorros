import 'server-only'
import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { db, type Tx } from '@/db/client'
import { matches, socialPublications, user } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { audit } from '@/lib/audit'
import { env } from '@/lib/env'
import { formatLongDateTime } from '@/lib/format'
import { publicationKindLabels } from '@/lib/labels'
import { logger } from '@/lib/logger'
import { sendMail } from '@/lib/mail'
import type { USER_ROLES } from '@/lib/permissions'
import {
  type GuardMatch,
  type GuardResult,
  rivalOf,
  STARTED_WHILE_DISABLED,
  scheduleGuard,
} from './lib/scheduling'

// Seguros de las publicaciones programadas (jornada o partido) y el aviso por correo cuando uno las descarta.
// Corren en cada tick, aunque Facebook esté apagado: una programada nunca queda esperando ni sale tarde.

/** Hasta este número de intentos se reintenta el aviso por correo de un descarte. */
export const MAX_DISCARD_NOTIFY_ATTEMPTS = 5
/** Solo se reintentan avisos recientes. */
const NOTIFY_WINDOW_MS = 48 * 60 * 60 * 1000

/** Los partidos vigentes de una programada (los eliminados no vuelven). */
export async function loadGuardMatches(
  ids: readonly string[],
  executor: Tx | typeof db = db,
): Promise<GuardMatch[]> {
  if (ids.length === 0) return []
  const rows = await executor
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      clubSide: matches.clubSide,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
    })
    .from(matches)
    .where(and(inArray(matches.id, [...ids]), isClubMatch))
  return rows.map((row) => ({
    id: row.id,
    kickoffAt: row.kickoffAt,
    status: row.status,
    rivalId: rivalOf(row),
  }))
}

type ScheduledRow = Pick<
  typeof socialPublications.$inferSelect,
  'scheduledAt' | 'scheduledSnapshot' | 'message'
>

/**
 * ¿Sigue valiendo esta programada? Con Facebook apagado, si el partido ya empezó el motivo lo dice: lo
 * programado no sale tarde al reactivarlo.
 */
export async function checkScheduled(
  row: ScheduledRow,
  now: Date,
  available: boolean,
  executor: Tx | typeof db = db,
): Promise<GuardResult> {
  if (!row.scheduledSnapshot || !row.scheduledAt) {
    return { ok: false, code: 'eliminado', message: 'La programación quedó incompleta.' }
  }
  const result = scheduleGuard({
    snapshot: row.scheduledSnapshot,
    current: await loadGuardMatches(
      row.scheduledSnapshot.matches.map((match) => match.id),
      executor,
    ),
    scheduledAt: row.scheduledAt,
    messageEdited: row.message !== null,
    now,
  })
  if (!result.ok && result.code === 'empezo' && !available)
    return { ...result, message: STARTED_WHILE_DISABLED }
  return result
}

/** Descarta una programada por un seguro (solo si sigue «programada»), con su motivo y auditoría. */
export async function discardScheduled(id: string, message: string, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(socialPublications)
      .set({ status: 'descartado', lastError: message, nextAttemptAt: null, updatedAt: now })
      .where(and(eq(socialPublications.id, id), eq(socialPublications.status, 'programada')))
      .returning({ kind: socialPublications.kind, subjectKey: socialPublications.subjectKey })
    if (!row) return false
    await audit(tx, null, 'social.schedule.discard', {
      entityType: 'social_publication',
      entityId: id,
      summary: `Descartó la publicación programada en Facebook: ${publicationKindLabels[row.kind].toLowerCase()}`,
      meta: { kind: row.kind, subject: row.subjectKey },
    })
    return true
  })
}

/** Revisa todas las programadas y descarta las que ya no valen. Devuelve cuántas descartó. */
export async function runScheduledGuards(now: Date, available: boolean): Promise<number> {
  const rows = await db
    .select({
      id: socialPublications.id,
      scheduledAt: socialPublications.scheduledAt,
      scheduledSnapshot: socialPublications.scheduledSnapshot,
      message: socialPublications.message,
    })
    .from(socialPublications)
    .where(eq(socialPublications.status, 'programada'))
  let discarded = 0
  for (const row of rows) {
    const result = await checkScheduled(row, now, available)
    if (!result.ok && (await discardScheduled(row.id, result.message, now))) discarded++
  }
  return discarded
}

/** Correos de los administradores activos (nunca se registran). */
async function adminEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: user.email, role: user.role, banned: user.banned })
    .from(user)
    .where(or(isNull(user.banned), eq(user.banned, false)))
  const admin: (typeof USER_ROLES)[number] = 'admin'
  return rows
    .filter((row) => (row.role ?? '').split(',').some((role) => role.trim() === admin))
    .map((row) => row.email)
    .filter((email) => email.includes('@'))
}

/** El aviso no cambia la fila: la ventana de reintentos cuenta desde el descarte. */
const unchanged = sql`${socialPublications.updatedAt}`

const siteLink = (path: string) => new URL(path, env.SITE_URL).toString()

/** Dónde se vuelve a programar: la página de la jornada o la del partido. */
function reprogramPath(kind: string, subjectKey: string): string {
  return kind === 'jornada'
    ? `/admin/partidos/jornadas/${subjectKey}`
    : `/admin/partidos/${subjectKey}/facebook`
}

/**
 * Avisa por correo a los administradores de cada programada que un seguro descartó: qué era, el motivo y el
 * enlace para reprogramarla. Una sola vez por fila (`discard_notified_at`); si falla, se reintenta en los
 * ticks siguientes hasta 5 veces y dentro de 48 horas.
 */
export async function notifyDiscardedScheduled(now: Date): Promise<number> {
  const pending = await db
    .select({
      id: socialPublications.id,
      kind: socialPublications.kind,
      subjectKey: socialPublications.subjectKey,
      scheduledAt: socialPublications.scheduledAt,
      lastError: socialPublications.lastError,
      attempts: socialPublications.discardNotifyAttempts,
    })
    .from(socialPublications)
    .where(
      and(
        eq(socialPublications.status, 'descartado'),
        isNotNull(socialPublications.scheduledAt),
        isNull(socialPublications.discardNotifiedAt),
        lt(socialPublications.discardNotifyAttempts, MAX_DISCARD_NOTIFY_ATTEMPTS),
        gt(socialPublications.updatedAt, new Date(now.getTime() - NOTIFY_WINDOW_MS)),
      ),
    )
    .limit(10)
  if (pending.length === 0) return 0
  const to = await adminEmails()
  let sent = 0
  for (const row of pending) {
    // Se reserva el intento antes de enviar: dos ticks a la vez no mandan el mismo aviso dos veces.
    const [claimed] = await db
      .update(socialPublications)
      .set({ discardNotifyAttempts: row.attempts + 1, updatedAt: unchanged })
      .where(
        and(
          eq(socialPublications.id, row.id),
          eq(socialPublications.discardNotifyAttempts, row.attempts),
          isNull(socialPublications.discardNotifiedAt),
        ),
      )
      .returning({ id: socialPublications.id })
    if (!claimed) continue
    try {
      if (to.length === 0) throw new Error('No hay administradores activos con correo.')
      const what = publicationKindLabels[row.kind]
      await sendMail({
        to,
        subject: `No se publicará en Facebook: ${what.toLowerCase()}`,
        text: [
          `La publicación programada «${what}»${row.scheduledAt ? ` para el ${formatLongDateTime(row.scheduledAt)}` : ''} no saldrá.`,
          '',
          `Motivo: ${row.lastError ?? 'cambió el partido.'}`,
          '',
          `Revísala y vuelve a programarla: ${siteLink(reprogramPath(row.kind, row.subjectKey))}`,
        ].join('\n'),
      })
      await db
        .update(socialPublications)
        .set({ discardNotifiedAt: now, updatedAt: unchanged })
        .where(eq(socialPublications.id, row.id))
      sent++
    } catch (error) {
      logger.warn(
        { err: error, kind: row.kind, attempts: row.attempts + 1 },
        'redes: no se pudo avisar el descarte',
      )
    }
  }
  return sent
}
