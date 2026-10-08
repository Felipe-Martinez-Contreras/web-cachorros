import 'server-only'
import { and, asc, eq, gte, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { events, mediaAssets } from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import type { EventCardDTO } from './dto'

/** Próximos eventos publicados, del más cercano al más lejano. */
export async function getUpcomingEvents(limit = 3): Promise<EventCardDTO[]> {
  'use cache'
  cacheTag(tags.events())
  cacheLife('minutes')

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      type: events.type,
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
      },
    })
    .from(events)
    .leftJoin(mediaAssets, eq(mediaAssets.id, events.posterMediaId))
    .where(
      and(eq(events.isPublished, true), eq(events.status, 'programado'), gte(events.startsAt, sql`now()`)),
    )
    .orderBy(asc(events.startsAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    startsAt: row.startsAt.toISOString(),
    locationText: row.locationText,
    priceText: row.priceText,
    poster: toImageDTO(row.poster),
  }))
}
