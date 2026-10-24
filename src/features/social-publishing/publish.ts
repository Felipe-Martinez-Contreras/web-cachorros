import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { socialPublications } from '@/db/schema'
import { getShareImage } from '@/features/share/images'
import type { ShareRequest } from '@/features/share/lib/cards'
import { loadShareCard, shareVersionOf } from '@/features/share/queries'
import { audit } from '@/lib/audit'
import { env } from '@/lib/env'
import { publicationKindLabels } from '@/lib/labels'
import { logger } from '@/lib/logger'
import type { PublishChannel } from './channels/types'
import { nextMatchCaption, resultCaption, weekendCaption } from './lib/caption'
import {
  type GraphFailure,
  isPublishable,
  nextAttemptAt,
  type PublicationKind,
  statusAfterFailure,
} from './lib/rules'

// Publicar una fila de `social_publications` (ADR 0009): se toma con bloqueo para que dos procesos no la
// envíen a la vez, se dibuja la tarjeta (caché y cola de 1 de `share`), se publica y se registra el
// resultado con su auditoría. El texto se arma con los mismos datos públicos de la tarjeta.

/** Las publicaciones van en 4:5: ocupan más pantalla en el feed del celular. */
const PUBLISH_FORMAT = 'vertical' as const

export function shareRequestFor(kind: PublicationKind, subjectKey: string): ShareRequest {
  return { template: kind, id: subjectKey, format: PUBLISH_FORMAT }
}

const siteLink = (path: string) => new URL(path, env.SITE_URL).toString()

export type PublicationContent = { version: string; caption: string; slug: string }

/** Versión vigente de la tarjeta y el texto sugerido; `null` si el partido o el fin de semana ya no aplica. */
export async function publicationContent(
  kind: PublicationKind,
  subjectKey: string,
): Promise<PublicationContent | null> {
  const request = shareRequestFor(kind, subjectKey)
  const current = await shareVersionOf(request)
  if (!current) return null
  const data = await loadShareCard(request)
  if (!data) return null
  if (data.kind === 'weekend') {
    return { ...current, caption: weekendCaption(data, siteLink('/partidos')) }
  }
  if (data.kind !== 'match') return null
  const link = siteLink(`/partidos/${current.slug}`)
  return {
    ...current,
    caption: kind === 'resultado' ? resultCaption(data, link) : nextMatchCaption(data, link),
  }
}

export type ProcessOutcome =
  | { status: 'publicado'; url: string }
  | { status: 'error' | 'incierto' | 'descartado'; message: string }
  | { status: 'omitida' }

/**
 * Intenta publicar la fila `id`. Si otro proceso ya la tomó, o no le toca (publicada, incierta o esperando
 * su reintento), no hace nada (`omitida`).
 */
export async function processPublication(
  id: string,
  channel: PublishChannel,
  now = new Date(),
): Promise<ProcessOutcome> {
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(socialPublications)
      .where(and(eq(socialPublications.id, id), inArray(socialPublications.status, ['pendiente', 'error'])))
      .for('update', { skipLocked: true })
    if (!row || !isPublishable(row, now)) return null
    const attempts = row.attempts + 1
    await tx
      .update(socialPublications)
      .set({ status: 'publicando', attempts, nextAttemptAt: null, updatedAt: now })
      .where(eq(socialPublications.id, id))
    return { ...row, attempts }
  })
  if (!claimed) return { status: 'omitida' }

  const subject = { kind: claimed.kind, subject: claimed.subjectKey, channel: claimed.channel }
  const content = await publicationContent(claimed.kind, claimed.subjectKey).catch((error: unknown) => {
    logger.error({ err: error, ...subject }, 'redes: no se pudo preparar la publicación')
    return undefined
  })
  if (content === null) {
    return finishWith(claimed, 'El partido o el fin de semana ya no está disponible para publicar.', now)
  }
  const image = content
    ? await getShareImage(shareRequestFor(claimed.kind, claimed.subjectKey), content.version).catch(
        (error: unknown) => {
          logger.error({ err: error, ...subject }, 'redes: no se pudo dibujar la tarjeta')
          return null
        },
      )
    : null
  if (!content || !image) {
    // Falla nuestra (base o disco), no de Facebook: se reintenta como una falla transitoria.
    return fail(
      claimed,
      { kind: 'transitorio', message: 'No se pudo preparar la tarjeta. Se reintentará.' },
      now,
    )
  }

  const caption = claimed.message ?? content.caption
  const result = await channel.publishPhoto({
    image: image.bytes,
    filename: `${claimed.kind}-${content.slug}.png`,
    caption,
  })
  if (!result.ok) return fail(claimed, result.failure, now)

  await db.transaction(async (tx) => {
    await tx
      .update(socialPublications)
      .set({
        status: 'publicado',
        message: caption,
        imageVersion: content.version,
        externalId: result.externalId,
        externalUrl: result.url,
        publishedAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(socialPublications.id, claimed.id))
    await audit(tx, null, 'social.publish', {
      entityType: 'social_publication',
      entityId: claimed.id,
      summary: `Publicó en ${channelName(claimed.channel)}: ${kindName(claimed.kind)}`,
      meta: { ...subject, trigger: claimed.trigger, postId: result.externalId },
    })
  })
  logger.info({ ...subject, postId: result.externalId }, 'redes: publicado')
  return { status: 'publicado', url: result.url }
}

type ClaimedRow = typeof socialPublications.$inferSelect

async function fail(row: ClaimedRow, failure: GraphFailure, now: Date): Promise<ProcessOutcome> {
  const status = statusAfterFailure(failure)
  const retryAt = nextAttemptAt(row.attempts, now, failure)
  await db.transaction(async (tx) => {
    await tx
      .update(socialPublications)
      .set({ status, lastError: failure.message, nextAttemptAt: retryAt, updatedAt: now })
      .where(eq(socialPublications.id, row.id))
    await audit(tx, null, 'social.publish.failed', {
      entityType: 'social_publication',
      entityId: row.id,
      summary: `No se pudo publicar en ${channelName(row.channel)}: ${kindName(row.kind)}`,
      meta: {
        kind: row.kind,
        subject: row.subjectKey,
        attempts: row.attempts,
        failure: failure.kind,
        retry: retryAt !== null,
      },
    })
  })
  logger.warn(
    { kind: row.kind, subject: row.subjectKey, attempts: row.attempts, failure: failure.kind },
    'redes: falló la publicación',
  )
  return { status, message: failure.message }
}

async function finishWith(row: ClaimedRow, message: string, now: Date): Promise<ProcessOutcome> {
  const status = 'descartado'
  await db.transaction(async (tx) => {
    await tx
      .update(socialPublications)
      .set({ status, lastError: message, nextAttemptAt: null, updatedAt: now })
      .where(eq(socialPublications.id, row.id))
    await audit(tx, null, 'social.publish.discard', {
      entityType: 'social_publication',
      entityId: row.id,
      summary: `Descartó la publicación en ${channelName(row.channel)}: ${kindName(row.kind)}`,
      meta: { kind: row.kind, subject: row.subjectKey },
    })
  })
  return { status, message }
}

const channelName = (channel: string) => (channel === 'instagram' ? 'Instagram' : 'Facebook')
const kindName = (kind: PublicationKind) => publicationKindLabels[kind].toLowerCase()
