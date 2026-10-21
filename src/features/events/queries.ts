import 'server-only'
import { and, asc, count, desc, eq, gte, lt, ne, or, type SQL, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { events, mediaAssets, slugRedirects, venues } from '@/db/schema'
import { loadRichTextImages } from '@/features/media/rich-text-images'
import { tags } from '@/lib/cache-tags'
import { mediaUrl, toImageDTO } from '@/lib/images/dto'
import type { EventCardDTO, EventDetailDTO, EventsPageDTO } from './dto'
import { eventMapUrl, PAST_EVENTS_PAGE_SIZE } from './lib/public'

// Un evento sigue «próximo» mientras no termina (si no tiene término, hasta que empieza) y no se marcó
// como realizado. La misma regla para el listado, el detalle y el sitemap.
const endOf = sql`coalesce(${events.endsAt}, ${events.startsAt})`
const isUpcoming = and(gte(endOf, sql`now()`), ne(events.status, 'realizado'))
const isPast = or(lt(endOf, sql`now()`), eq(events.status, 'realizado'))

const cardColumns = {
  id: events.id,
  slug: events.slug,
  title: events.title,
  type: events.type,
  status: events.status,
  startsAt: events.startsAt,
  locationText: events.locationText,
  priceText: events.priceText,
  poster: {
    variants: mediaAssets.variants,
    width: mediaAssets.width,
    height: mediaAssets.height,
    altText: mediaAssets.altText,
    lqip: mediaAssets.lqip,
    credit: mediaAssets.credit,
    focalX: mediaAssets.focalX,
    focalY: mediaAssets.focalY,
    containsMinors: mediaAssets.containsMinors,
  },
}

function selectCards(where: SQL | undefined) {
  return db
    .select(cardColumns)
    .from(events)
    .leftJoin(mediaAssets, eq(mediaAssets.id, events.posterMediaId))
    .where(and(eq(events.isPublished, true), where))
}

type CardRow = Awaited<ReturnType<typeof selectCards>>[number]

function toCard(row: CardRow): EventCardDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    locationText: row.locationText,
    priceText: row.priceText,
    // Un afiche marcado con menores después de asignarlo no se entrega al sitio (9.6).
    poster: row.poster?.containsMinors ? null : toImageDTO(row.poster),
  }
}

/** Próximos eventos publicados y programados, del más cercano al más lejano (portada). */
export async function getUpcomingEvents(limit = 3): Promise<EventCardDTO[]> {
  'use cache'
  cacheTag(tags.events(), tags.media())
  cacheLife('minutes')

  const rows = await selectCards(and(isUpcoming, eq(events.status, 'programado')))
    .orderBy(asc(events.startsAt))
    .limit(limit)
  return rows.map(toCard)
}

/** `/eventos`: todos los próximos (ascendente) y una página de los pasados (descendente). */
export async function getEventsPage(requestedPage: number): Promise<EventsPageDTO> {
  'use cache'
  cacheTag(tags.events(), tags.media())
  cacheLife('minutes')

  const [upcoming, [totals]] = await Promise.all([
    selectCards(isUpcoming).orderBy(asc(events.startsAt)),
    db
      .select({ total: count() })
      .from(events)
      .where(and(eq(events.isPublished, true), isPast)),
  ])
  const totalPages = Math.max(1, Math.ceil((totals?.total ?? 0) / PAST_EVENTS_PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  const past = await selectCards(isPast)
    .orderBy(desc(events.startsAt), desc(events.id))
    .limit(PAST_EVENTS_PAGE_SIZE)
    .offset((page - 1) * PAST_EVENTS_PAGE_SIZE)
  return { upcoming: upcoming.map(toCard), past: past.map(toCard), page, totalPages }
}

/** Detalle público por el slug vigente; `null` si no existe o no está publicado. */
export async function getEventDetail(slug: string): Promise<EventDetailDTO | null> {
  'use cache'
  cacheTag(tags.events(), tags.media())
  cacheLife('minutes')

  const [row] = await db
    .select({
      ...cardColumns,
      endsAt: events.endsAt,
      description: events.description,
      ctaUrl: events.ctaUrl,
      updatedAt: events.updatedAt,
      venueName: venues.name,
      venueAddress: venues.address,
      venueCommune: venues.commune,
      geoLat: venues.geoLat,
      geoLng: venues.geoLng,
    })
    .from(events)
    .leftJoin(mediaAssets, eq(mediaAssets.id, events.posterMediaId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(eq(events.slug, slug), eq(events.isPublished, true)))
    .limit(1)
  if (!row) return null

  const card = toCard(row)
  const largest = card.poster ? row.poster?.variants?.webp.at(-1) : undefined
  return {
    ...card,
    endsAt: row.endsAt?.toISOString() ?? null,
    description: row.description,
    descriptionImages: await loadRichTextImages(row.description),
    ctaUrl: row.ctaUrl,
    venue: row.venueName
      ? { name: row.venueName, address: row.venueAddress, commune: row.venueCommune }
      : null,
    mapUrl: eventMapUrl({ locationText: row.locationText, geoLat: row.geoLat, geoLng: row.geoLng }),
    posterFull: largest ? mediaUrl(largest.path) : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Slug vigente de un evento publicado al que se llegó por una dirección antigua (segunda barrera). */
export async function resolveEventRedirect(oldSlug: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: events.slug })
    .from(slugRedirects)
    .innerJoin(events, eq(events.id, slugRedirects.entityId))
    .where(
      and(
        eq(slugRedirects.entityType, 'event'),
        eq(slugRedirects.oldSlug, oldSlug),
        eq(events.isPublished, true),
      ),
    )
    .limit(1)
  return row?.slug ?? null
}
