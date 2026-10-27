import 'server-only'
import { and, asc, eq, gte, lt, lte, ne, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { matches, socialPublications } from '@/db/schema'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { isClubMatch } from '@/features/matches/queries'
import { addDays } from '@/features/share/lib/cards'
import { weekendCardOf } from '@/features/share/queries'
import { logger } from '@/lib/logger'
import type { PublishChannel } from './channels/types'
import { facebook, facebookAvailability, loadFacebookSettings } from './config'
import {
  MAX_PUBLISH_ATTEMPTS,
  RESULT_DELAY_MS,
  RESULT_WINDOW_MS,
  STALE_PENDING_MS,
  STUCK_PUBLISHING_MS,
} from './lib/rules'
import { upcomingWeekend, weeklyDecision } from './lib/schedule'
import { processPublication } from './publish'

// Lo que hace la tarea `tick` (cada 5 minutos) con las redes: encola la programación del fin de semana y
// los resultados cuando corresponde, y publica lo pendiente o reintenta lo que falló. Idempotente: el
// índice único `(canal, tipo, sujeto)` impide encolar dos veces lo mismo.

/** Cuántas publicaciones se envían por tick, como máximo (cada una dibuja una tarjeta). */
const PER_TICK = 3

export type SocialTickSummary = {
  skipped?: string
  queued: number
  published: number
  failed: number
}

export async function runSocialPublishing(
  now = new Date(),
  channel: PublishChannel | null = facebook(),
): Promise<SocialTickSummary> {
  await housekeeping(now)
  const settings = await loadFacebookSettings()
  const availability = facebookAvailability(settings)
  if (!availability.ok || !channel) {
    return {
      skipped: availability.ok ? 'sin_configurar' : availability.reason,
      queued: 0,
      published: 0,
      failed: 0,
    }
  }

  let queued = 0
  const saturday = upcomingWeekend(now)
  const decision = weeklyDecision({
    now,
    weekday: settings.weekday,
    time: settings.time,
    enabledAt: settings.enabledAt,
    firstKickoff: await firstKickoff(saturday),
  })
  if (decision.publish && !(await weekendAlreadyPublished(decision.saturday))) {
    const inserted = await db
      .insert(socialPublications)
      .values({
        channel: 'facebook',
        kind: 'programacion',
        subjectKey: decision.saturday,
        weekend: decision.saturday,
        trigger: 'automatica',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: socialPublications.id })
    queued += inserted.length
  }

  if (settings.publishResults && settings.resultsEnabledAt) {
    const since = Math.max(Date.parse(settings.resultsEnabledAt), now.getTime() - RESULT_WINDOW_MS)
    const finished = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          isClubMatch,
          eq(matches.status, 'finalizado'),
          gte(matches.finishedAt, new Date(since)),
          lte(matches.finishedAt, new Date(now.getTime() - RESULT_DELAY_MS)),
        ),
      )
    if (finished.length > 0) {
      const inserted = await db
        .insert(socialPublications)
        .values(
          finished.map(({ id }) => ({
            channel: 'facebook' as const,
            kind: 'resultado' as const,
            subjectKey: id,
            matchId: id,
            trigger: 'automatica' as const,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: socialPublications.id })
      queued += inserted.length
    }
  }

  const due = await db
    .select({ id: socialPublications.id })
    .from(socialPublications)
    .where(
      and(
        eq(socialPublications.channel, 'facebook'),
        or(
          eq(socialPublications.status, 'pendiente'),
          and(
            eq(socialPublications.status, 'error'),
            lte(socialPublications.nextAttemptAt, now),
            lt(socialPublications.attempts, MAX_PUBLISH_ATTEMPTS),
          ),
        ),
      ),
    )
    .orderBy(asc(socialPublications.createdAt))
    .limit(PER_TICK)

  let published = 0
  let failed = 0
  for (const { id } of due) {
    const outcome = await processPublication(id, channel, now)
    if (outcome.status === 'publicado') published++
    else if (outcome.status !== 'omitida') failed++
  }
  return { queued, published, failed }
}

/**
 * Con un solo partido (o una sola jornada) el fin de semana, la programación publica la tarjeta de ese
 * partido (o de esa jornada): si ya se publicó a mano, sería el mismo post dos veces.
 */
async function weekendAlreadyPublished(saturday: string): Promise<boolean> {
  const weekend = await weekendCardOf(saturday)
  const [only] = weekend?.matchIds ?? []
  const subject =
    weekend?.card === 'proximo' && only
      ? { kind: 'proximo' as const, key: only }
      : weekend?.card === 'jornada' && weekend.jornadaKey
        ? { kind: 'jornada' as const, key: weekend.jornadaKey }
        : null
  if (!subject) return false
  const [row] = await db
    .select({ id: socialPublications.id })
    .from(socialPublications)
    .where(
      and(
        eq(socialPublications.channel, 'facebook'),
        eq(socialPublications.kind, subject.kind),
        eq(socialPublications.subjectKey, subject.key),
        ne(socialPublications.status, 'descartado'),
      ),
    )
    .limit(1)
  return Boolean(row)
}

/** Primer partido del club del fin de semana (sábado y domingo en Santiago) que no está cancelado. */
async function firstKickoff(saturday: string): Promise<Date | null> {
  const [row] = await db
    .select({ kickoffAt: matches.kickoffAt })
    .from(matches)
    .where(
      and(
        isClubMatch,
        ne(matches.status, 'cancelado'),
        gte(matches.kickoffAt, santiagoWallTime(saturday, '00:00')),
        lt(matches.kickoffAt, santiagoWallTime(addDays(saturday, 2), '00:00')),
      ),
    )
    .orderBy(asc(matches.kickoffAt))
    .limit(1)
  return row?.kickoffAt ?? null
}

/**
 * Orden de la cola, aunque la publicación esté apagada: un «publicando» que quedó a medias pasa a
 * «Sin confirmar» (no se sabe si llegó a Facebook) y un pendiente viejo se descarta.
 */
async function housekeeping(now: Date): Promise<void> {
  const stuck = await db
    .update(socialPublications)
    .set({
      status: 'incierto',
      lastError: 'La publicación se cortó a medias: revisa la página antes de reintentar.',
    })
    .where(
      and(
        eq(socialPublications.status, 'publicando'),
        lt(socialPublications.updatedAt, new Date(now.getTime() - STUCK_PUBLISHING_MS)),
      ),
    )
    .returning({ id: socialPublications.id })
  const stale = await db
    .update(socialPublications)
    .set({
      status: 'descartado',
      lastError: 'Pasó demasiado tiempo sin poder publicarla.',
      nextAttemptAt: null,
    })
    .where(
      and(
        lt(socialPublications.createdAt, new Date(now.getTime() - STALE_PENDING_MS)),
        // Lo que agotó sus intentos queda «Con error», visible en el panel.
        or(
          eq(socialPublications.status, 'pendiente'),
          and(eq(socialPublications.status, 'error'), lt(socialPublications.attempts, MAX_PUBLISH_ATTEMPTS)),
        ),
      ),
    )
    .returning({ id: socialPublications.id })
  if (stuck.length + stale.length > 0) {
    logger.warn({ stuck: stuck.length, stale: stale.length }, 'redes: publicaciones sin terminar')
  }
}
