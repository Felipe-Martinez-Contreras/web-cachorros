import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events, venues } from '@/db/schema'
import { getSite } from '@/features/settings/queries'
import { env } from '@/lib/env'
import { isUuid } from '@/lib/form-schemas'
import { buildIcs } from '@/lib/ics'

/** Duración que se anota en el calendario si el evento no tiene hora de término. */
const DEFAULT_MINUTES = 120

/** `.ics` de un evento publicado del club (especificación 6.11). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return new Response(null, { status: 404 })

  const [event] = await db
    .select({
      slug: events.slug,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: events.status,
      updatedAt: events.updatedAt,
      locationText: events.locationText,
      priceText: events.priceText,
      venueName: venues.name,
      venueAddress: venues.address,
      venueCommune: venues.commune,
    })
    .from(events)
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(eq(events.id, id), eq(events.isPublished, true)))
    .limit(1)
  if (!event) return new Response(null, { status: 404 })

  const site = await getSite()
  const url = `${env.SITE_URL}/eventos/${event.slug}`
  const location =
    [event.venueName ?? event.locationText, event.venueAddress, event.venueCommune]
      .filter(Boolean)
      .join(', ') || null
  const body = buildIcs(
    {
      uid: `evento-${id}@${new URL(env.SITE_URL ?? url).hostname}`,
      title: event.title,
      startsAt: event.startsAt,
      durationMinutes: event.endsAt
        ? Math.max(1, Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000))
        : DEFAULT_MINUTES,
      description: [event.priceText, url].filter(Boolean).join('\n'),
      location,
      url,
      // Cada edición cambia la versión: el calendario reemplaza la anterior (en segundos, cabe en un entero).
      sequence: Math.floor(event.updatedAt.getTime() / 1000) - 1_700_000_000,
      cancelled: event.status === 'cancelado',
    },
    site?.clubName ?? 'Club Deportivo Los Cachorros',
  )
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  })
}
