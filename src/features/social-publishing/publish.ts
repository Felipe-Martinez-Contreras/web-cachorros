import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, socialPublications } from '@/db/schema'
import { getShareImage } from '@/features/share/images'
import type { ShareRequest } from '@/features/share/lib/cards'
import { loadShareCard, shareVersionOf, weekendCardOf } from '@/features/share/queries'
import { audit } from '@/lib/audit'
import { env } from '@/lib/env'
import { publicationKindLabels } from '@/lib/labels'
import { logger } from '@/lib/logger'
import type { PublishChannel } from './channels/types'
import { loadFacebookSettings } from './config'
import { jornadaCaption, nextMatchCaption, resultCaption, weekendCaption } from './lib/caption'
import {
  type GraphFailure,
  isPublishable,
  nextAttemptAt,
  type PublicationKind,
  statusAfterFailure,
} from './lib/rules'
import { withFallbackPhotos } from './lib/scheduling'
import { checkScheduled } from './scheduled'

// Publicar una fila de `social_publications` (ADR 0009): se toma con bloqueo para que dos procesos no la
// envíen a la vez, se dibuja la tarjeta (caché y cola de 1 de `share`), se publica y se registra el
// resultado con su auditoría. El texto se arma con los mismos datos públicos de la tarjeta.

/** Las publicaciones van en 4:5: ocupan más pantalla en el feed del celular. */
const PUBLISH_FORMAT = 'vertical' as const

/**
 * La tarjeta de una publicación. `photos`: las del matchday elegidas para ella («Próximo partido» y
 * «Jornada»); `series`: las series marcadas (solo «Jornada»).
 */
export function shareRequestFor(
  kind: PublicationKind,
  subjectKey: string,
  photos?: readonly (string | null)[] | null,
  series?: readonly string[] | null,
): ShareRequest {
  const request: ShareRequest = { template: kind, id: subjectKey, format: PUBLISH_FORMAT }
  if (kind === 'proximo') return photos ? { ...request, photos } : request
  if (kind !== 'jornada') return request
  return { ...request, ...(photos ? { photos } : {}), ...(series ? { series } : {}) }
}

const siteLink = (path: string) => new URL(path, env.SITE_URL).toString()

export type PublicationContent = {
  /**
   * La tarjeta que se sube (la programación de un solo partido usa la de «Próximo partido», y la de una sola
   * jornada, la de «Jornada»).
   */
  request: ShareRequest
  version: string
  caption: string
  slug: string
}

/**
 * Versión vigente de la tarjeta y el texto sugerido; `null` si el partido, la jornada o el fin de semana ya
 * no aplica.
 */
export async function publicationContent(
  kind: PublicationKind,
  subjectKey: string,
  photos?: readonly (string | null)[] | null,
  series?: readonly string[] | null,
): Promise<PublicationContent | null> {
  if (kind === 'jornada') return jornadaContent(subjectKey, photos, series)
  if (kind === 'programacion') {
    // Un solo partido o una sola jornada: la tarjeta matchday dice más que una grilla (y sigue siendo un post).
    const weekend = await weekendCardOf(subjectKey)
    const [only] = weekend?.matchIds ?? []
    if (weekend?.card === 'proximo' && only) return matchContent('proximo', only, 'Partido del fin de semana')
    if (weekend?.card === 'jornada' && weekend.jornadaKey) {
      return jornadaContent(weekend.jornadaKey, null, null, 'Jornada del fin de semana')
    }
  }
  const request = shareRequestFor(kind, subjectKey)
  if (request.template === 'programacion') {
    const current = await shareVersionOf(request)
    const data = current ? await loadShareCard(request) : null
    if (!current || data?.kind !== 'weekend') return null
    return { request, ...current, caption: weekendCaption(data, siteLink('/partidos')) }
  }
  return matchContent(kind, subjectKey, undefined, photos)
}

async function jornadaContent(
  key: string,
  photos: readonly (string | null)[] | null | undefined,
  series: readonly string[] | null | undefined,
  heading?: string,
): Promise<PublicationContent | null> {
  const request = shareRequestFor('jornada', key, photos, series)
  const current = await shareVersionOf(request)
  const data = current ? await loadShareCard(request) : null
  if (!current || data?.kind !== 'jornada') return null
  return { request, ...current, caption: jornadaCaption(data, siteLink('/partidos'), heading) }
}

async function matchContent(
  kind: PublicationKind,
  matchId: string,
  heading?: string,
  photos?: readonly (string | null)[] | null,
): Promise<PublicationContent | null> {
  const request = shareRequestFor(kind, matchId, photos)
  const current = await shareVersionOf(request)
  const data = current ? await loadShareCard(request) : null
  if (!current || data?.kind !== 'match') return null
  const link = siteLink(`/partidos/${current.slug}`)
  return {
    request,
    ...current,
    caption: kind === 'resultado' ? resultCaption(data, link) : nextMatchCaption(data, link, heading),
  }
}

export type ProcessOutcome =
  | { status: 'publicado'; url: string }
  | { status: 'error' | 'incierto' | 'descartado'; message: string }
  | { status: 'omitida' }

/**
 * Las fotos elegidas que ya no se pueden publicar (borradas o marcadas «contiene menores» después de elegirlas)
 * se reemplazan por la de respaldo de Ajustes en la misma posición, o quedan en gris: nunca sale una foto
 * vetada y el post sale igual.
 */
async function publishablePhotos(
  photos: readonly (string | null)[] | null,
): Promise<{ photos: (string | null)[] | null; replaced: number }> {
  if (!photos) return { photos: null, replaced: 0 }
  const defaults = (await loadFacebookSettings()).photos ?? [null, null, null]
  const ids = [...photos, ...defaults].filter((photo): photo is string => Boolean(photo))
  const usable =
    ids.length > 0
      ? await db
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(
            and(
              inArray(mediaAssets.id, ids),
              eq(mediaAssets.kind, 'imagen'),
              eq(mediaAssets.containsMinors, false),
            ),
          )
      : []
  return withFallbackPhotos(photos, defaults, new Set(usable.map((row) => row.id)))
}

/**
 * Intenta publicar la fila `id`. Si otro proceso ya la tomó, o no le toca (publicada, incierta, esperando
 * su reintento o su hora), no hace nada (`omitida`). Una programada vuelve a pasar por sus seguros dentro del
 * bloqueo: si el partido cambió o ya empezó, se descarta con el motivo.
 */
export async function processPublication(
  id: string,
  channel: PublishChannel,
  now = new Date(),
): Promise<ProcessOutcome> {
  const taken = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(socialPublications)
      .where(
        and(
          eq(socialPublications.id, id),
          inArray(socialPublications.status, ['pendiente', 'error', 'programada']),
        ),
      )
      .for('update', { skipLocked: true })
    if (!row || !isPublishable(row, now)) return null
    if (row.scheduledAt) {
      const guard = await checkScheduled(row, now, true, tx)
      if (!guard.ok) return { discard: true as const, row, message: guard.message }
    }
    const attempts = row.attempts + 1
    await tx
      .update(socialPublications)
      .set({ status: 'publicando', attempts, nextAttemptAt: null, updatedAt: now })
      .where(eq(socialPublications.id, id))
    return { discard: false as const, row: { ...row, attempts } }
  })
  if (!taken) return { status: 'omitida' }
  if (taken.discard) return finishWith(taken.row, taken.message, now)
  const claimed = taken.row

  const subject = { kind: claimed.kind, subject: claimed.subjectKey, channel: claimed.channel }
  const photos = await publishablePhotos(claimed.photoIds)
  if (photos.replaced > 0) {
    logger.warn({ ...subject, replaced: photos.replaced }, 'redes: fotos reemplazadas por las de respaldo')
  }
  const content = await publicationContent(
    claimed.kind,
    claimed.subjectKey,
    photos.photos,
    claimed.seriesIds,
  ).catch((error: unknown) => {
    logger.error({ err: error, ...subject }, 'redes: no se pudo preparar la publicación')
    return undefined
  })
  if (content === null) {
    return finishWith(
      claimed,
      'El partido, la jornada o el fin de semana ya no está disponible para publicar.',
      now,
    )
  }
  const image = content
    ? await getShareImage(content.request, content.version).catch((error: unknown) => {
        logger.error({ err: error, ...subject }, 'redes: no se pudo dibujar la tarjeta')
        return null
      })
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
    filename: `${content.request.template}-${content.slug}.png`,
    caption,
  })
  if (!result.ok) return fail(claimed, result.failure, now)

  await db.transaction(async (tx) => {
    await tx
      .update(socialPublications)
      .set({
        status: 'publicado',
        message: caption,
        photoIds: photos.photos,
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
      meta: {
        ...subject,
        trigger: claimed.trigger,
        scheduled: claimed.scheduledAt !== null,
        postId: result.externalId,
        ...(photos.replaced > 0 ? { replacedPhotos: photos.replaced } : {}),
      },
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
