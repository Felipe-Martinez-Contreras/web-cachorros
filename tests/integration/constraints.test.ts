import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createPlayer, createSportFixture, type SportFixture } from './fixtures'

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

beforeAll(async () => {
  await cleanSport(admin)
  f = await createSportFixture(admin)
})

afterAll(async () => {
  await cleanSport(admin)
  await admin.end()
})

describe('unicidades de la sección 8.6', () => {
  it('permite un solo club propio', async () => {
    await expect(
      admin`insert into teams (name, short_name, slug, is_own_club) values ('Otro', 'Otro', 'otro-club', true)`,
    ).rejects.toThrow(/teams_own_club_uq/)
  })

  it('permite una sola temporada actual, y varias que no lo son', async () => {
    await expect(
      admin`insert into seasons (name, year, is_current) values ('Temporada 2027', 2027, true)`,
    ).rejects.toThrow(/seasons_current_uq/)
    await admin`insert into seasons (name, year) values ('Temporada 2025', 2025), ('Temporada 2024', 2024)`
  })

  it('inscribe a un jugador una sola vez por temporada y serie', async () => {
    const player = await createPlayer(admin, 'inscrito-una-vez')
    await admin`insert into squad_registrations (player_id, season_id, series_id) values (${player}, ${f.seasonId}, ${f.seriesId})`
    await expect(
      admin`insert into squad_registrations (player_id, season_id, series_id) values (${player}, ${f.seasonId}, ${f.seriesId})`,
    ).rejects.toThrow(/squad_registrations_player_season_series_uq/)
  })

  it('no repite un número de camiseta en la misma temporada y serie, pero sí permite varios sin número', async () => {
    const [a, b, c, d] = await Promise.all(
      ['camiseta-a', 'camiseta-b', 'camiseta-c', 'camiseta-d'].map((slug) => createPlayer(admin, slug)),
    )
    await admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number) values (${a ?? ''}, ${f.seasonId}, ${f.seriesId}, 9)`
    await expect(
      admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number) values (${b ?? ''}, ${f.seasonId}, ${f.seriesId}, 9)`,
    ).rejects.toThrow(/squad_registrations_shirt_uq/)
    await admin`insert into squad_registrations (player_id, season_id, series_id) values (${c ?? ''}, ${f.seasonId}, ${f.seriesId}), (${d ?? ''}, ${f.seasonId}, ${f.seriesId})`
  })

  it('ignora eventos duplicados por client_event_id', async () => {
    const match = await createMatch(admin, f, 'partido-idempotente')
    const clientEventId = '0198c0de-0000-7000-8000-000000000001'
    const insert = () => admin`
      insert into match_events (match_id, type, period, minute, team_id, client_event_id)
      values (${match}, 'gol', 'primer_tiempo', 10, ${f.ownTeamId}, ${clientEventId})
      on conflict (client_event_id) do nothing returning id`
    expect(await insert()).toHaveLength(1)
    expect(await insert()).toHaveLength(0)
    await expect(
      admin`insert into match_events (match_id, type, period, minute, team_id, client_event_id)
            values (${match}, 'gol', 'primer_tiempo', 10, ${f.ownTeamId}, ${clientEventId})`,
    ).rejects.toThrow(/match_events_client_event_id_uq/)
  })

  it('no repite un jugador en la nómina de un partido', async () => {
    const match = await createMatch(admin, f, 'partido-nomina')
    const player = await createPlayer(admin, 'nomina-unica')
    await admin`insert into match_lineups (match_id, player_id) values (${match}, ${player})`
    await expect(
      admin`insert into match_lineups (match_id, player_id) values (${match}, ${player})`,
    ).rejects.toThrow(/match_lineups_match_player_uq/)
  })

  it('no repite slugs', async () => {
    await expect(createMatch(admin, f, 'partido-nomina')).rejects.toThrow(/matches_slug_uq/)
    await expect(
      admin`insert into series (name, slug, short_name, kind) values ('Honor B', 'honor', 'HB', 'adulta')`,
    ).rejects.toThrow(/series_slug_uq/)
  })
})

describe('restricciones', () => {
  it('un equipo no juega contra sí mismo', async () => {
    await expect(
      admin`insert into matches (season_id, competition_id, series_id, home_team_id, away_team_id, kickoff_at, slug)
            values (${f.seasonId}, ${f.competitionId}, ${f.seriesId}, ${f.ownTeamId}, ${f.ownTeamId}, now(), 'contra-si-mismo')`,
    ).rejects.toThrow(/matches_distinct_teams_check/)
  })

  it('una crónica exige partido y una galería exige álbum', async () => {
    await expect(
      admin`insert into news (title, slug, type) values ('Crónica sin partido', 'cronica-sin-partido', 'cronica')`,
    ).rejects.toThrow(/news_cronica_match_check/)
    await expect(
      admin`insert into news (title, slug, type) values ('Galería sin álbum', 'galeria-sin-album', 'galeria')`,
    ).rejects.toThrow(/news_galeria_album_check/)
    const match = await createMatch(admin, f, 'partido-con-cronica')
    await admin`insert into news (title, slug, type, match_id) values ('Crónica', 'cronica-ok', 'cronica', ${match})`
  })

  it('una noticia publicada exige fecha de publicación', async () => {
    await expect(
      admin`insert into news (title, slug, status) values ('Sin fecha', 'sin-fecha', 'publicada')`,
    ).rejects.toThrow(/news_published_at_check/)
  })

  it('un álbum con menores no se publica sin confirmar las autorizaciones', async () => {
    await expect(
      admin`insert into albums (title, slug, is_published, contains_minors) values ('Formativas', 'formativas', true, true)`,
    ).rejects.toThrow(/albums_minors_consent_check/)
    await admin`insert into albums (title, slug, is_published, contains_minors, minors_consent_confirmed_at)
                values ('Formativas', 'formativas', true, true, now())`
  })

  it('una imagen exige texto alternativo; un documento no', async () => {
    await expect(
      admin`insert into media_assets (kind, storage_key, mime, bytes) values ('imagen', 'sin-alt', 'image/jpeg', 10)`,
    ).rejects.toThrow(/media_assets_alt_text_check/)
    await admin`insert into media_assets (kind, storage_key, mime, bytes) values ('documento', 'doc-prueba', 'application/pdf', 10)`
    await admin`delete from media_assets where storage_key = 'doc-prueba'`
  })

  it('el dinero no puede ser negativo', async () => {
    await expect(
      admin`insert into products (name, slug, price_clp) values ('Polera', 'polera', -1)`,
    ).rejects.toThrow(/products_price_check/)
    await expect(
      admin`insert into membership_plans (name, fee_clp, fee_period) values ('Plan', -1, 'mensual')`,
    ).rejects.toThrow(/membership_plans_fee_check/)
  })

  it('borrar un partido borra sus eventos y su nómina, pero no se puede borrar un equipo con partidos', async () => {
    const match = await createMatch(admin, f, 'partido-cascada')
    const player = await createPlayer(admin, 'cascada')
    await admin`insert into match_events (match_id, type, period, minute, team_id, player_id) values (${match}, 'gol', 'primer_tiempo', 5, ${f.ownTeamId}, ${player})`
    await admin`insert into match_lineups (match_id, player_id, played) values (${match}, ${player}, true)`
    await expect(admin`delete from teams where id = ${f.rivalTeamId}`).rejects.toThrow(/foreign key/)
    await admin`delete from matches where id = ${match}`
    const [row] = await admin<{ n: number }[]>`
      select (select count(*) from match_events where match_id = ${match})::int
           + (select count(*) from match_lineups where match_id = ${match})::int as n`
    expect(row?.n).toBe(0)
  })

  it('calcula PJ y DIF como columnas generadas', async () => {
    const [table] = await admin<{ id: string }[]>`
      insert into standings_tables (competition_id, series_id) values (${f.competitionId}, ${f.seriesId}) returning id`
    const [row] = await admin<{ played: number; goal_diff: number }[]>`
      insert into standings_rows (table_id, team_id, won, drawn, lost, goals_for, goals_against)
      values (${table?.id ?? ''}, ${f.ownTeamId}, 4, 2, 1, 12, 7) returning played, goal_diff`
    expect(row).toEqual({ played: 7, goal_diff: 5 })
    await expect(
      admin`insert into standings_tables (competition_id, series_id) values (${f.competitionId}, ${f.seriesId})`,
    ).rejects.toThrow(/standings_tables_uq/)
  })
})
