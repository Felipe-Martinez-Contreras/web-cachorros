import 'server-only'
import { sportOptions } from '@/features/series/queries'
import { teamAndVenueOptions } from '@/features/teams/queries'

/** Listas y valores por defecto de los formularios de partidos (temporada actual, club y su cancha). */
export async function matchFormOptions() {
  const [sport, places] = await Promise.all([sportOptions(), teamAndVenueOptions()])
  // Primero las competencias de la temporada actual: es lo que casi siempre se elige.
  const competitions = [...sport.competitions].sort(
    (a, b) => Number(b.seasonId === sport.currentSeasonId) - Number(a.seasonId === sport.currentSeasonId),
  )
  return {
    series: sport.series,
    competitions: competitions.map(({ value, label }) => ({ value, label })),
    teams: places.teams.map(({ value, label }) => ({ value, label })),
    rivals: places.teams.filter((team) => !team.isOwnClub).map(({ value, label }) => ({ value, label })),
    venues: places.venues.map(({ value, label }) => ({ value, label })),
    ownTeamId: places.ownTeamId,
    homeVenueId: places.homeVenueId,
  }
}

/** Qué falta para poder programar, en palabras simples; `null` si está todo. */
export function missingForScheduling(options: Awaited<ReturnType<typeof matchFormOptions>>): string | null {
  if (options.series.length === 0) return 'una serie'
  if (options.competitions.length === 0) return 'una competencia (y su temporada)'
  if (!options.ownTeamId) return 'el club propio en Rivales'
  if (options.rivals.length === 0) return 'al menos un rival'
  return null
}
