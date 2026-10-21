'use server'

import { eq } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { events, venues } from '@/db/schema'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { assertPublishableMedia } from '@/features/media/guards'
import { assertRichTextMedia } from '@/features/media/rich-text-images'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { type EventData, eventSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const nothing = z.unknown()

async function eventValues(tx: Tx, data: EventData) {
  await assertPublishableMedia(tx, data.posterMediaId, 'posterMediaId')
  await assertRichTextMedia(tx, data.description, 'description')
  if (data.venueId) {
    const [venue] = await tx.select({ id: venues.id }).from(venues).where(eq(venues.id, data.venueId))
    if (!venue) throw new Rejection('Esa cancha ya no existe. Elige otra.', 'venueId')
  }
  const { startDate, startTime, endDate, endTime, ...rest } = data
  return {
    ...rest,
    startsAt: santiagoWallTime(startDate, startTime),
    endsAt: endTime ? santiagoWallTime(endDate ?? startDate, endTime) : null,
  }
}

export async function crearEvento(input: unknown): Result {
  return mutate({
    action: 'event.create',
    permission: 'events:write',
    entityType: 'event',
    schema: eventSchema,
    input,
    tags: [tags.events()],
    write: async (tx, data) => {
      const values = await eventValues(tx, data)
      const slug = await resolveSlug(tx, events, data.title)
      const [row] = await tx
        .insert(events)
        .values({ ...values, slug })
        .returning({ id: events.id })
      if (!row) throw new Error('El evento no se creó.')
      return {
        id: row.id,
        summary: `Creó el evento ${data.title}`,
        meta: { slug, status: data.status, isPublished: data.isPublished },
      }
    },
  })
}

export async function actualizarEvento(id: string, input: unknown): Result {
  return mutate({
    action: 'event.update',
    permission: 'events:write',
    entityType: 'event',
    schema: eventSchema,
    input,
    tags: [tags.events()],
    write: async (tx, data) => {
      const eventId = assertId(id, 'No encontramos ese evento.')
      const [current] = await tx
        .select({ slug: events.slug })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update')
      if (!current) throw new Rejection('No encontramos ese evento. Puede que lo hayan eliminado.')
      const values = await eventValues(tx, data)
      // Al renombrar cambia la dirección; la anterior responde con un 301 (3.9).
      const slug = await resolveSlug(tx, events, data.title, eventId)
      await tx
        .update(events)
        .set({ ...values, slug })
        .where(eq(events.id, eventId))
      await recordSlugChange(tx, 'event', eventId, current.slug, slug)
      return {
        id: eventId,
        summary: `Editó el evento ${data.title}`,
        meta: { slug, status: data.status, isPublished: data.isPublished },
      }
    },
  })
}

export async function eliminarEvento(id: string): Result {
  return mutate({
    action: 'event.delete',
    permission: 'events:write',
    entityType: 'event',
    schema: nothing,
    input: null,
    tags: [tags.events()],
    write: async (tx) => {
      const eventId = assertId(id, 'No encontramos ese evento.')
      // Un álbum del evento queda sin evento (ON DELETE SET NULL); el afiche sigue en la biblioteca.
      const [row] = await tx.delete(events).where(eq(events.id, eventId)).returning({ title: events.title })
      if (!row) throw new Rejection('No encontramos ese evento. Puede que ya lo hayan eliminado.')
      return { id: eventId, summary: `Eliminó el evento ${row.title}` }
    },
  })
}
