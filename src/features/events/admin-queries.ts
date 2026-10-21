import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events, mediaAssets } from '@/db/schema'
import type { MediaVariants } from '@/db/schema/media'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual.

const columns = {
  id: events.id,
  title: events.title,
  slug: events.slug,
  type: events.type,
  status: events.status,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  locationText: events.locationText,
  venueId: events.venueId,
  description: events.description,
  priceText: events.priceText,
  ctaUrl: events.ctaUrl,
  isPublished: events.isPublished,
  posterId: mediaAssets.id,
  posterVariants: mediaAssets.variants,
  posterAlt: mediaAssets.altText,
  posterMinors: mediaAssets.containsMinors,
}

type Row = {
  posterId: string | null
  posterVariants: MediaVariants | null
  posterAlt: string | null
  posterMinors: boolean | null
}

function withPoster<T extends Row>({ posterId, posterVariants, posterAlt, posterMinors, ...row }: T) {
  return {
    ...row,
    poster: posterId
      ? toMediaThumbDTO({
          id: posterId,
          variants: posterVariants,
          altText: posterAlt,
          containsMinors: posterMinors ?? false,
        })
      : (null as MediaThumbDTO | null),
  }
}

/** Todos los eventos, del más reciente al más antiguo. */
export async function listEventsAdmin() {
  const rows = await db
    .select(columns)
    .from(events)
    .leftJoin(mediaAssets, eq(mediaAssets.id, events.posterMediaId))
    .orderBy(desc(events.startsAt))
  return rows.map(withPoster)
}

export async function getEventAdmin(id: string) {
  const [row] = await db
    .select(columns)
    .from(events)
    .leftJoin(mediaAssets, eq(mediaAssets.id, events.posterMediaId))
    .where(eq(events.id, id))
    .limit(1)
  return row ? withPoster(row) : null
}
export type EventAdmin = NonNullable<Awaited<ReturnType<typeof getEventAdmin>>>
