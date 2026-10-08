export type PointsRule = { pointsWin: number; pointsDraw: number }

/** Lo que se ingresa a mano en una tabla manual (o se acumula desde los resultados). */
export type StandingsInput = {
  teamId: string
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  pointsAdjustment?: number
  /** Ajuste manual de posición: último criterio de desempate. */
  manualPosition?: number | null
}

export type StandingsRow = Required<Omit<StandingsInput, 'manualPosition'>> & {
  manualPosition: number | null
  played: number
  goalDiff: number
  points: number
  position: number
}

export type FinishedMatch = {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
}

/**
 * Completa PJ, DIF y PTS y ordena la tabla (especificación 8.6): PTS, DIF, GF y, si persiste el empate,
 * la posición manual. [DECIDIR: desempate en la tabla calculada. Default: PTS, DIF, GF y luego manual]
 */
export function rankStandings(inputs: readonly StandingsInput[], rule: PointsRule): StandingsRow[] {
  const rows = inputs.map((input) => {
    const pointsAdjustment = input.pointsAdjustment ?? 0
    return {
      ...input,
      pointsAdjustment,
      manualPosition: input.manualPosition ?? null,
      played: input.won + input.drawn + input.lost,
      goalDiff: input.goalsFor - input.goalsAgainst,
      points: input.won * rule.pointsWin + input.drawn * rule.pointsDraw + pointsAdjustment,
      position: 0,
    }
  })
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      (a.manualPosition ?? Number.MAX_SAFE_INTEGER) - (b.manualPosition ?? Number.MAX_SAFE_INTEGER) ||
      a.teamId.localeCompare(b.teamId),
  )
  rows.forEach((row, index) => {
    row.position = index + 1
  })
  return rows
}

type Adjustment = { teamId: string; pointsAdjustment?: number; manualPosition?: number | null }

/**
 * Tabla calculada desde los partidos finalizados de una competencia y serie, incluidos los partidos entre
 * rivales. `teamIds` agrega a los equipos que aún no juegan; `adjustments`, los descuentos o bonificaciones.
 * [VERIFICAR: puntos por triunfo y empate según el reglamento de la asociación]
 */
export function computeStandings(
  matches: readonly FinishedMatch[],
  rule: PointsRule,
  options: { teamIds?: readonly string[]; adjustments?: readonly Adjustment[] } = {},
): StandingsRow[] {
  const byTeam = new Map<string, StandingsInput>()
  const rowOf = (teamId: string): StandingsInput => {
    let row = byTeam.get(teamId)
    if (!row) {
      row = { teamId, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
      byTeam.set(teamId, row)
    }
    return row
  }

  for (const teamId of options.teamIds ?? []) rowOf(teamId)

  for (const match of matches) {
    const home = rowOf(match.homeTeamId)
    const away = rowOf(match.awayTeamId)
    home.goalsFor += match.homeScore
    home.goalsAgainst += match.awayScore
    away.goalsFor += match.awayScore
    away.goalsAgainst += match.homeScore
    if (match.homeScore > match.awayScore) {
      home.won += 1
      away.lost += 1
    } else if (match.homeScore < match.awayScore) {
      away.won += 1
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
    }
  }

  for (const adjustment of options.adjustments ?? []) {
    const row = rowOf(adjustment.teamId)
    row.pointsAdjustment = adjustment.pointsAdjustment ?? 0
    row.manualPosition = adjustment.manualPosition ?? null
  }

  return rankStandings([...byTeam.values()], rule)
}

/** Mini-tabla de la portada: los primeros `top` y, si quedó fuera, la fila del club. */
export function compactStandings(rows: readonly StandingsRow[], clubTeamId: string, top = 5): StandingsRow[] {
  const head = rows.slice(0, top)
  if (head.some((row) => row.teamId === clubTeamId)) return head
  const club = rows.find((row) => row.teamId === clubTeamId)
  return club ? [...head, club] : head
}
