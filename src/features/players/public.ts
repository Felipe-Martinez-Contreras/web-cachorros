import 'server-only'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { players, series, squadRegistrations } from '@/db/schema'
import { toIsoDate } from '@/lib/format'
import { isMinor, publicPlayerName } from './lib/is-minor'

/**
 * Único punto de paso de los jugadores hacia el sitio público (especificación 6.3 y 8.6). Todo DTO
 * público, el JSON-LD y el sitemap obtienen de aquí el nombre y el enlace: un menor de edad sale solo
 * como nombre + inicial, sin ficha, sin foto y sin fecha de nacimiento.
 */

/** Cómo se puede nombrar y enlazar a un jugador en el sitio. */
export type PublicPlayerRef = {
  /** «Juan Pérez», o «Juan P.» si es menor de edad. */
  name: string
  /** Slug de su ficha; `null` si no tiene (menores de edad). */
  slug: string | null
}

type PlayerIdentity = { id: string; firstName: string; lastName: string; slug: string }

/**
 * De un conjunto de jugadores, cuáles son menores de edad hoy: por su fecha de nacimiento o, si no la
 * tienen, por estar inscritos en alguna serie con menores. Una sola consulta para todos.
 */
export async function loadMinorIds(playerIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(playerIds)]
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({
      id: players.id,
      birthDate: players.birthDate,
      inMinorsSeries: sql<boolean>`coalesce(bool_or(${series.containsMinors}), false)`,
    })
    .from(players)
    .leftJoin(squadRegistrations, eq(squadRegistrations.playerId, players.id))
    .leftJoin(series, eq(series.id, squadRegistrations.seriesId))
    .where(inArray(players.id, ids))
    .groupBy(players.id)
  const today = toIsoDate(new Date())
  return new Set(
    rows
      .filter((row) => isMinor(row, row.inMinorsSeries ? [{ containsMinors: true }] : [], today))
      .map((row) => row.id),
  )
}

export function toPublicPlayerRef(player: PlayerIdentity, minors: ReadonlySet<string>): PublicPlayerRef {
  const minor = minors.has(player.id)
  return { name: publicPlayerName(player, minor), slug: minor ? null : player.slug }
}
