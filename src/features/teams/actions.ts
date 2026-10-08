'use server'

import { eq } from 'drizzle-orm'
import { teams, venues } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { parseCoordinates } from './lib/parse-coordinates'
import { teamSchema, venueSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

// Equipos y canchas aparecen en el fixture, las tablas y la portada.
const MATCH_TAGS = [tags.matches(), tags.settings()]
const nothing = z.unknown()

const teamConstraints = {
  teams_slug_uq: { message: 'Ya existe un club con ese nombre.', field: 'name' },
}

export async function crearRival(input: unknown): Result {
  return mutate({
    action: 'team.create',
    permission: 'sport:write',
    entityType: 'team',
    schema: teamSchema,
    input,
    tags: MATCH_TAGS,
    constraints: teamConstraints,
    write: async (tx, data) => {
      await assertPublishableMedia(tx, data.crestMediaId, 'crestMediaId')
      const slug = await resolveSlug(tx, teams, data.name)
      const [row] = await tx
        .insert(teams)
        .values({ ...data, slug })
        .returning({ id: teams.id })
      if (!row) throw new Error('El club no se creó.')
      return { id: row.id, summary: `Creó el rival ${data.name}`, meta: data }
    },
  })
}

export async function actualizarEquipo(id: string, input: unknown): Result {
  return mutate({
    action: 'team.update',
    permission: 'sport:write',
    entityType: 'team',
    schema: teamSchema,
    input,
    tags: MATCH_TAGS,
    constraints: teamConstraints,
    write: async (tx, data) => {
      const teamId = assertId(id, 'No encontramos ese club.')
      await assertPublishableMedia(tx, data.crestMediaId, 'crestMediaId')
      const [current] = await tx
        .select({ slug: teams.slug, name: teams.name })
        .from(teams)
        .where(eq(teams.id, teamId))
        .for('update')
      if (!current) throw new Rejection('No encontramos ese club. Puede que lo hayan eliminado.')
      const slug = data.name === current.name ? current.slug : await resolveSlug(tx, teams, data.name, teamId)
      await tx
        .update(teams)
        .set({ ...data, slug })
        .where(eq(teams.id, teamId))
      await recordSlugChange(tx, 'team', teamId, current.slug, slug)
      return { id: teamId, summary: `Editó el club ${data.name}`, meta: data }
    },
  })
}

export async function eliminarRival(id: string): Result {
  return mutate({
    action: 'team.delete',
    permission: 'sport:write',
    entityType: 'team',
    schema: nothing,
    input: null,
    tags: MATCH_TAGS,
    write: async (tx) => {
      const teamId = assertId(id, 'No encontramos ese club.')
      const [current] = await tx
        .select({ name: teams.name, isOwnClub: teams.isOwnClub })
        .from(teams)
        .where(eq(teams.id, teamId))
      if (!current) throw new Rejection('No encontramos ese club. Puede que ya lo hayan eliminado.')
      if (current.isOwnClub) throw new Rejection('El club propio no se puede eliminar.')
      await tx.delete(teams).where(eq(teams.id, teamId))
      return { id: teamId, summary: `Eliminó el rival ${current.name}` }
    },
  })
}

type VenueData = z.output<typeof venueSchema>

function venueValues({ location, ...data }: VenueData) {
  const coordinates = location ? parseCoordinates(location) : null
  return { ...data, geoLat: coordinates?.lat ?? null, geoLng: coordinates?.lng ?? null }
}

export async function crearCancha(input: unknown): Result {
  return mutate({
    action: 'venue.create',
    permission: 'sport:write',
    entityType: 'venue',
    schema: venueSchema,
    input,
    tags: MATCH_TAGS,
    write: async (tx, data) => {
      const [row] = await tx.insert(venues).values(venueValues(data)).returning({ id: venues.id })
      if (!row) throw new Error('La cancha no se creó.')
      return { id: row.id, summary: `Creó la cancha ${data.name}`, meta: venueValues(data) }
    },
  })
}

export async function actualizarCancha(id: string, input: unknown): Result {
  return mutate({
    action: 'venue.update',
    permission: 'sport:write',
    entityType: 'venue',
    schema: venueSchema,
    input,
    tags: MATCH_TAGS,
    write: async (tx, data) => {
      const venueId = assertId(id, 'No encontramos esa cancha.')
      const [row] = await tx
        .update(venues)
        .set(venueValues(data))
        .where(eq(venues.id, venueId))
        .returning({ id: venues.id })
      if (!row) throw new Rejection('No encontramos esa cancha. Puede que la hayan eliminado.')
      return { id: venueId, summary: `Editó la cancha ${data.name}`, meta: venueValues(data) }
    },
  })
}

export async function eliminarCancha(id: string): Result {
  return mutate({
    action: 'venue.delete',
    permission: 'sport:write',
    entityType: 'venue',
    schema: nothing,
    input: null,
    tags: MATCH_TAGS,
    write: async (tx) => {
      const venueId = assertId(id, 'No encontramos esa cancha.')
      const [row] = await tx.delete(venues).where(eq(venues.id, venueId)).returning({ name: venues.name })
      if (!row) throw new Rejection('No encontramos esa cancha. Puede que ya la hayan eliminado.')
      return { id: venueId, summary: `Eliminó la cancha ${row.name}` }
    },
  })
}
