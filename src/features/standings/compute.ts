import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { matches, standingsRows } from '@/db/schema'
import { computeStandings, rankStandings, type StandingsRow } from '@/features/matches/lib/standings'

export type RankableTable = {
  id: string
  mode: 'manual' | 'calculada'
  competitionId: string
  seriesId: string
  pointsWin: number
  pointsDraw: number
}

/**
 * Filas ordenadas de una tabla de posiciones (especificación 8.6). Es el único lugar que decide cómo se
 * arma: lo usan la portada, la página pública y la vista previa del panel.
 * - Manual: lo ingresado en la grilla.
 * - Calculada: los partidos finalizados de la competencia y serie (incluidos los partidos entre rivales),
 *   más los ajustes de puntos y de posición guardados por equipo.
 */
export async function rankTable(table: RankableTable): Promise<StandingsRow[]> {
  const rule = { pointsWin: table.pointsWin, pointsDraw: table.pointsDraw }
  const rows = await db
    .select({
      teamId: standingsRows.teamId,
      won: standingsRows.won,
      drawn: standingsRows.drawn,
      lost: standingsRows.lost,
      goalsFor: standingsRows.goalsFor,
      goalsAgainst: standingsRows.goalsAgainst,
      pointsAdjustment: standingsRows.pointsAdjustment,
      manualPosition: standingsRows.position,
    })
    .from(standingsRows)
    .where(eq(standingsRows.tableId, table.id))
  if (table.mode === 'manual') return rankStandings(rows, rule)

  const finished = await db
    .select({
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches)
    .where(
      and(
        eq(matches.competitionId, table.competitionId),
        eq(matches.seriesId, table.seriesId),
        eq(matches.status, 'finalizado'),
      ),
    )
  return computeStandings(finished, rule, {
    // Los equipos agregados a la tabla aparecen aunque todavía no jueguen.
    teamIds: rows.map((row) => row.teamId),
    adjustments: rows.map(({ teamId, pointsAdjustment, manualPosition }) => ({
      teamId,
      pointsAdjustment,
      manualPosition,
    })),
  })
}
