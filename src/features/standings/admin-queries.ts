import 'server-only'
import { asc, count, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { competitions, seasons, series, standingsRows, standingsTables, teams } from '@/db/schema'
import { rankTable } from './compute'

// Lecturas del panel: sin caché, siempre el estado actual.

export function listStandingsAdmin() {
  return db
    .select({
      id: standingsTables.id,
      mode: standingsTables.mode,
      asOf: standingsTables.asOf,
      groupLabel: standingsTables.groupLabel,
      seriesName: series.name,
      competitionName: competitions.name,
      seasonName: seasons.name,
      teams: count(standingsRows.id),
    })
    .from(standingsTables)
    .innerJoin(series, eq(series.id, standingsTables.seriesId))
    .innerJoin(competitions, eq(competitions.id, standingsTables.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .leftJoin(standingsRows, eq(standingsRows.tableId, standingsTables.id))
    .groupBy(standingsTables.id, series.id, competitions.id, seasons.id)
    .orderBy(desc(seasons.year), asc(series.sortOrder), asc(standingsTables.groupLabel))
}

export type StandingsAdminDetail = NonNullable<Awaited<ReturnType<typeof getStandingsAdmin>>>

export async function getStandingsAdmin(id: string) {
  const [table] = await db
    .select({
      id: standingsTables.id,
      mode: standingsTables.mode,
      asOf: standingsTables.asOf,
      sourceNote: standingsTables.sourceNote,
      groupLabel: standingsTables.groupLabel,
      competitionId: standingsTables.competitionId,
      seriesId: standingsTables.seriesId,
      seriesName: series.name,
      competitionName: competitions.name,
      seasonName: seasons.name,
      pointsWin: competitions.pointsWin,
      pointsDraw: competitions.pointsDraw,
    })
    .from(standingsTables)
    .innerJoin(series, eq(series.id, standingsTables.seriesId))
    .innerJoin(competitions, eq(competitions.id, standingsTables.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(eq(standingsTables.id, id))
    .limit(1)
  if (!table) return null

  const [rows, teamRows, ranked] = await Promise.all([
    db
      .select({
        teamId: standingsRows.teamId,
        won: standingsRows.won,
        drawn: standingsRows.drawn,
        lost: standingsRows.lost,
        goalsFor: standingsRows.goalsFor,
        goalsAgainst: standingsRows.goalsAgainst,
        pointsAdjustment: standingsRows.pointsAdjustment,
        position: standingsRows.position,
        note: standingsRows.note,
      })
      .from(standingsRows)
      .where(eq(standingsRows.tableId, id)),
    db
      .select({ id: teams.id, name: teams.name, isOwnClub: teams.isOwnClub })
      .from(teams)
      .orderBy(desc(teams.isOwnClub), asc(teams.name)),
    rankTable(table),
  ])
  const nameOf = new Map(teamRows.map((team) => [team.id, team.name]))
  // Las filas se muestran en el orden actual de la tabla.
  const order = new Map(ranked.map((row) => [row.teamId, row.position]))
  return {
    table,
    rows: rows.sort((a, b) => (order.get(a.teamId) ?? 99) - (order.get(b.teamId) ?? 99)),
    teams: teamRows.map((team) => ({ value: team.id, label: team.name })),
    preview: ranked.map((row) => ({ ...row, teamName: nameOf.get(row.teamId) ?? 'Equipo eliminado' })),
  }
}
