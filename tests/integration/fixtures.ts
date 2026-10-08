import type postgres from 'postgres'

type Sql = postgres.Sql

/** Borra los datos deportivos en orden de dependencias (sin TRUNCATE … CASCADE, que vaciaría `site_settings`). */
export async function cleanSport(sql: Sql) {
  await sql.unsafe(`
    DELETE FROM news_series; DELETE FROM news; DELETE FROM album_items; DELETE FROM albums;
    DELETE FROM match_events; DELETE FROM match_lineups; DELETE FROM matches;
    DELETE FROM player_stat_adjustments; DELETE FROM squad_registrations; DELETE FROM players;
    DELETE FROM standings_rows; DELETE FROM standings_tables;
    DELETE FROM competitions; DELETE FROM teams; DELETE FROM series; DELETE FROM seasons;
  `)
}

export type SportFixture = {
  seasonId: string
  seriesId: string
  competitionId: string
  ownTeamId: string
  rivalTeamId: string
}

/** Lo mínimo para crear partidos: temporada actual, una serie, una competencia, el club y un rival. */
export async function createSportFixture(sql: Sql): Promise<SportFixture> {
  const [season] = await sql<{ id: string }[]>`
    insert into seasons (name, year, is_current) values ('Temporada 2026', 2026, true) returning id`
  const [serie] = await sql<{ id: string }[]>`
    insert into series (name, slug, short_name, kind) values ('Honor', 'honor', 'Honor', 'adulta') returning id`
  const [own] = await sql<{ id: string }[]>`
    insert into teams (name, short_name, slug, is_own_club)
    values ('Club de prueba', 'Prueba', 'club-de-prueba', true) returning id`
  const [rival] = await sql<{ id: string }[]>`
    insert into teams (name, short_name, slug) values ('Rival de prueba', 'Rival', 'rival-de-prueba') returning id`
  if (!season || !serie || !own || !rival) throw new Error('No se pudo crear el escenario de prueba.')
  const [competition] = await sql<{ id: string }[]>`
    insert into competitions (season_id, name) values (${season.id}, 'Campeonato de prueba') returning id`
  if (!competition) throw new Error('No se pudo crear la competencia de prueba.')
  return {
    seasonId: season.id,
    seriesId: serie.id,
    competitionId: competition.id,
    ownTeamId: own.id,
    rivalTeamId: rival.id,
  }
}

export async function createMatch(
  sql: Sql,
  f: SportFixture,
  slug: string,
  status: 'programado' | 'en_vivo' | 'finalizado' = 'finalizado',
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into matches (season_id, competition_id, series_id, home_team_id, away_team_id, kickoff_at, status, club_side, slug)
    values (${f.seasonId}, ${f.competitionId}, ${f.seriesId}, ${f.ownTeamId}, ${f.rivalTeamId}, now(), ${status}, 'local', ${slug})
    returning id`
  if (!row) throw new Error('No se pudo crear el partido de prueba.')
  return row.id
}

export async function createPlayer(sql: Sql, slug: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into players (first_name, last_name, slug, primary_position)
    values ('Jugador', ${slug}, ${slug}, 'delantero') returning id`
  if (!row) throw new Error('No se pudo crear el jugador de prueba.')
  return row.id
}
