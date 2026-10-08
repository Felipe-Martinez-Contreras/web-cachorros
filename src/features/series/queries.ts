import 'server-only'
import { asc, count, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { competitions, seasons, series, squadRegistrations, staffAssignments } from '@/db/schema'

// Lecturas del panel: sin caché, siempre el estado actual.

export type SeriesAdminRow = Awaited<ReturnType<typeof listSeriesAdmin>>[number]

export function listSeriesAdmin() {
  return db
    .select({
      id: series.id,
      name: series.name,
      shortName: series.shortName,
      slug: series.slug,
      kind: series.kind,
      sortOrder: series.sortOrder,
      isActive: series.isActive,
      containsMinors: series.containsMinors,
      halfLengthMinutes: series.halfLengthMinutes,
      description: series.description,
    })
    .from(series)
    .orderBy(asc(series.sortOrder), asc(series.name))
}

export async function getSeriesAdmin(id: string): Promise<SeriesAdminRow | null> {
  const rows = await listSeriesAdmin()
  return rows.find((row) => row.id === id) ?? null
}

export type SeasonAdminRow = Awaited<ReturnType<typeof listSeasonsAdmin>>[number]

export function listSeasonsAdmin() {
  return db
    .select({
      id: seasons.id,
      name: seasons.name,
      year: seasons.year,
      startsOn: seasons.startsOn,
      endsOn: seasons.endsOn,
      isCurrent: seasons.isCurrent,
    })
    .from(seasons)
    .orderBy(desc(seasons.year), desc(seasons.name))
}

export async function getSeasonAdmin(
  id: string,
): Promise<(SeasonAdminRow & { players: number; staff: number }) | null> {
  const rows = await listSeasonsAdmin()
  const season = rows.find((row) => row.id === id)
  if (!season) return null
  const [[registered], [assigned]] = await Promise.all([
    db.select({ n: count() }).from(squadRegistrations).where(eq(squadRegistrations.seasonId, id)),
    db.select({ n: count() }).from(staffAssignments).where(eq(staffAssignments.seasonId, id)),
  ])
  return { ...season, players: registered?.n ?? 0, staff: assigned?.n ?? 0 }
}

export type CompetitionAdminRow = Awaited<ReturnType<typeof listCompetitionsAdmin>>[number]

export function listCompetitionsAdmin() {
  return db
    .select({
      id: competitions.id,
      seasonId: competitions.seasonId,
      seasonName: seasons.name,
      name: competitions.name,
      kind: competitions.kind,
      organizer: competitions.organizer,
      pointsWin: competitions.pointsWin,
      pointsDraw: competitions.pointsDraw,
    })
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .orderBy(desc(seasons.year), asc(competitions.name))
}

export async function getCompetitionAdmin(id: string): Promise<CompetitionAdminRow | null> {
  const rows = await listCompetitionsAdmin()
  return rows.find((row) => row.id === id) ?? null
}

/** Listas para los `<select>` de los formularios del panel. */
export async function sportOptions() {
  const [seriesRows, seasonRows, competitionRows] = await Promise.all([
    listSeriesAdmin(),
    listSeasonsAdmin(),
    listCompetitionsAdmin(),
  ])
  return {
    series: seriesRows.map((row) => ({
      value: row.id,
      label: row.isActive ? row.name : `${row.name} (inactiva)`,
    })),
    seasons: seasonRows.map((row) => ({ value: row.id, label: row.name })),
    competitions: competitionRows.map((row) => ({
      value: row.id,
      label: `${row.name} · ${row.seasonName}`,
      seasonId: row.seasonId,
    })),
    currentSeasonId: seasonRows.find((row) => row.isCurrent)?.id ?? seasonRows[0]?.id ?? null,
  }
}
