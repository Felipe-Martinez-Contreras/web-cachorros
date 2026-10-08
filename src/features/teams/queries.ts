import 'server-only'
import { asc, desc, eq, ilike } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, teams, venues } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual.

export type TeamAdminRow = {
  id: string
  name: string
  shortName: string
  commune: string | null
  isOwnClub: boolean
  crest: MediaThumbDTO | null
}

export async function listTeamsAdmin(q?: string): Promise<TeamAdminRow[]> {
  const term = q?.trim()
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      commune: teams.commune,
      isOwnClub: teams.isOwnClub,
      crestId: mediaAssets.id,
      crestVariants: mediaAssets.variants,
      crestAlt: mediaAssets.altText,
      crestMinors: mediaAssets.containsMinors,
    })
    .from(teams)
    .leftJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
    .where(term ? ilike(teams.name, `%${term}%`) : undefined)
    // El club propio primero; después los rivales por nombre.
    .orderBy(desc(teams.isOwnClub), asc(teams.name))
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    commune: row.commune,
    isOwnClub: row.isOwnClub,
    crest: row.crestId
      ? toMediaThumbDTO({
          id: row.crestId,
          variants: row.crestVariants,
          altText: row.crestAlt,
          containsMinors: row.crestMinors ?? false,
        })
      : null,
  }))
}

export async function getTeamAdmin(id: string): Promise<TeamAdminRow | null> {
  const rows = await listTeamsAdmin()
  return rows.find((row) => row.id === id) ?? null
}

export type VenueAdminRow = Awaited<ReturnType<typeof listVenuesAdmin>>[number]

export function listVenuesAdmin() {
  return db
    .select({
      id: venues.id,
      name: venues.name,
      address: venues.address,
      commune: venues.commune,
      geoLat: venues.geoLat,
      geoLng: venues.geoLng,
      isHome: venues.isHome,
      notes: venues.notes,
    })
    .from(venues)
    .orderBy(desc(venues.isHome), asc(venues.name))
}

export async function getVenueAdmin(id: string): Promise<VenueAdminRow | null> {
  const rows = await listVenuesAdmin()
  return rows.find((row) => row.id === id) ?? null
}

/** Listas para los `<select>` de los formularios de partidos. */
export async function teamAndVenueOptions() {
  const [teamRows, venueRows] = await Promise.all([listTeamsAdmin(), listVenuesAdmin()])
  return {
    teams: teamRows.map((row) => ({ value: row.id, label: row.name, isOwnClub: row.isOwnClub })),
    venues: venueRows.map((row) => ({ value: row.id, label: row.name, isHome: row.isHome })),
    ownTeamId: teamRows.find((row) => row.isOwnClub)?.id ?? null,
    homeVenueId: venueRows.find((row) => row.isHome)?.id ?? null,
  }
}
