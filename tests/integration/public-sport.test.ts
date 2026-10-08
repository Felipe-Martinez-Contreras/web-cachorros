import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createSportFixture, type SportFixture } from './fixtures'

const { sql } = await import('@/db/client')
const { getFixture, getMatchDetail, getSportsNav, getStandings, getTopScorers, resolveSlugRedirect } =
  await import('@/features/matches/public-queries')
const { getPlayerProfile, getSquad } = await import('@/features/players/public-queries')
const { GET: getIcs } = await import('@/app/api/ics/partido/[id]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture
let juvenilId: string
let matchId: string
const ids: Record<string, string> = {}
const year = new Date().getFullYear()

async function player(
  key: string,
  first: string,
  last: string,
  birthDate: string | null,
  nickname: string | null,
) {
  const [row] = await admin<{ id: string }[]>`
    insert into players (first_name, last_name, nickname, slug, birth_date, primary_position)
    values (${first}, ${last}, ${nickname}, ${key}, ${birthDate}, 'delantero') returning id`
  ids[key] = row?.id ?? ''
  return ids[key] ?? ''
}

const register = (playerId: string, seriesId: string, shirt: number, captain = false) =>
  admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number, is_captain)
    values (${playerId}, ${f.seasonId}, ${seriesId}, ${shirt}, ${captain})`

beforeAll(async () => {
  await admin`delete from staff_assignments`
  await admin`delete from staff_members`
  await cleanSport(admin)
  await admin`delete from slug_redirects`
  f = await createSportFixture(admin)
  await admin`update site_settings set featured_series_id = ${f.seriesId} where id = 1`
  const [juvenil] = await admin<{ id: string }[]>`
    insert into series (name, slug, short_name, kind, sort_order, contains_minors)
    values ('Juvenil', 'juvenil', 'Juvenil', 'juvenil', 20, true) returning id`
  juvenilId = juvenil?.id ?? ''
  await admin`insert into series (name, slug, short_name, kind, sort_order, is_active)
    values ('Antigua', 'antigua', 'Antigua', 'adulta', 30, false)`

  // Un adulto con ficha, un menor por edad que juega en la serie adulta y un juvenil sin fecha de nacimiento.
  const adult = await player('adulto-goleador', 'Carlos', 'Fuentealba', '1995-03-10', 'Chino')
  const minorByAge = await player('menor-en-honor', 'Tomás', 'Valdebenito', `${year - 16}-01-15`, 'Tomy')
  const minorBySeries = await player('juvenil-sin-fecha', 'Benjamín', 'Sanhueza', null, 'Benja')
  const benched = await player('adulto-suplente', 'Luis', 'Arriagada', '1990-01-01', null)
  await register(adult, f.seriesId, 9, true)
  await register(minorByAge, f.seriesId, 17)
  await register(minorBySeries, juvenilId, 10)
  await register(benched, f.seriesId, 12)

  matchId = await createMatch(admin, f, 'honor-fecha-1', 'finalizado')
  await admin`update matches set home_score = 3, away_score = 1, round_label = 'Fecha 1', notes = 'Clásico' where id = ${matchId}`
  await admin`insert into match_lineups (match_id, player_id, role, shirt_number, played) values
    (${matchId}, ${adult}, 'titular', 9, true), (${matchId}, ${minorByAge}, 'titular', 17, true),
    (${matchId}, ${benched}, 'suplente', 12, false)`
  await admin`insert into match_events (match_id, type, period, minute, team_id, player_id) values
    (${matchId}, 'gol', 'primer_tiempo', 10, ${f.ownTeamId}, ${adult}),
    (${matchId}, 'gol', 'primer_tiempo', 30, ${f.ownTeamId}, ${minorByAge}),
    (${matchId}, 'gol_penal', 'segundo_tiempo', 70, ${f.ownTeamId}, ${minorByAge})`
  await admin`insert into match_events (match_id, type, period, minute, team_id, free_text_name) values
    (${matchId}, 'gol', 'segundo_tiempo', 80, ${f.rivalTeamId}, 'Delantero rival')`
  await createMatch(admin, f, 'honor-fecha-2', 'programado')
  // Partido entre rivales: no pertenece al fixture público del club.
  await admin`insert into teams (name, short_name, slug) values ('Tercero', 'Tercero', 'tercero')`
  await admin`insert into matches (season_id, competition_id, series_id, home_team_id, away_team_id, kickoff_at, status, club_side, slug, home_score, away_score, score_locked)
    select ${f.seasonId}, ${f.competitionId}, ${f.seriesId}, ${f.rivalTeamId}, id, now(), 'finalizado', 'ninguno', 'entre-rivales', 2, 2, true
    from teams where slug = 'tercero'`
  await admin`insert into standings_tables (competition_id, series_id, mode) values (${f.competitionId}, ${f.seriesId}, 'calculada')`
})

afterAll(async () => {
  await admin`update site_settings set featured_series_id = null where id = 1`
  await cleanSport(admin)
  await admin`delete from slug_redirects`
  await admin.end()
  await sql.end()
})

describe('partidos (público)', () => {
  it('la navegación lista solo las series activas y marca la destacada', async () => {
    const nav = await getSportsNav()
    expect(nav.series.map((serie) => serie.slug)).toEqual(['honor', 'juvenil'])
    expect(nav.featuredSeriesSlug).toBe('honor')
    expect(nav.seasons).toMatchObject([{ year: 2026, isCurrent: true }])
  })

  it('el fixture trae solo los partidos del club', async () => {
    const fixture = await getFixture(f.seriesId, f.seasonId)
    expect(fixture.map((match) => match.slug).sort()).toEqual(['honor-fecha-1', 'honor-fecha-2'])
  })

  it('el detalle nombra a los menores solo con su inicial y no les da ficha', async () => {
    const detail = await getMatchDetail('honor-fecha-1')
    expect(detail?.notes).toBe('Clásico')
    expect(detail?.events.map((event) => [event.minute, event.side, event.playerName])).toEqual([
      [10, 'home', 'Carlos Fuentealba'],
      [30, 'home', 'Tomás V.'],
      [70, 'home', 'Tomás V.'],
      [80, 'away', 'Delantero rival'],
    ])
    expect(detail?.lineup.starters).toEqual([
      { name: 'Carlos Fuentealba', slug: 'adulto-goleador', shirtNumber: 9 },
      { name: 'Tomás V.', slug: null, shirtNumber: 17 },
    ])
    expect(detail?.lineup.substitutes).toEqual([
      { name: 'Luis Arriagada', slug: 'adulto-suplente', shirtNumber: 12, played: false },
    ])
    // Ni el apellido, ni el apodo, ni la fecha de nacimiento, ni el slug del menor salen en el DTO.
    const serialized = JSON.stringify(detail)
    for (const secret of ['Valdebenito', 'Tomy', 'menor-en-honor', `${year - 16}-01-15`]) {
      expect(serialized).not.toContain(secret)
    }

    expect(await getMatchDetail('no-existe')).toBeNull()
    expect(await getMatchDetail('entre-rivales')).toBeNull()
  })

  it('los goleadores comparten posición en los empates y los menores van sin enlace', async () => {
    await admin`insert into player_stat_adjustments (player_id, season_id, series_id, appearances, goals)
      values (${ids['adulto-goleador'] ?? ''}, ${f.seasonId}, ${f.seriesId}, 1, 1), (${ids['adulto-suplente'] ?? ''}, ${f.seasonId}, ${f.seriesId}, 3, 1)`
    const scorers = await getTopScorers(f.seriesId, f.seasonId)
    expect(scorers).toEqual([
      // Dos goles cada uno: primero quien los hizo en menos partidos, pero con la misma posición.
      { rank: 1, player: { name: 'Tomás V.', slug: null }, goals: 2, appearances: 1 },
      { rank: 1, player: { name: 'Carlos Fuentealba', slug: 'adulto-goleador' }, goals: 2, appearances: 2 },
      { rank: 3, player: { name: 'Luis Arriagada', slug: 'adulto-suplente' }, goals: 1, appearances: 3 },
    ])
  })

  it('la tabla calculada incluye el partido entre rivales', async () => {
    const [table] = await getStandings(f.seriesId, f.seasonId)
    expect(table?.mode).toBe('calculada')
    expect(table?.rows.map((row) => [row.team.shortName, row.played, row.points])).toEqual([
      ['Prueba', 1, 3],
      ['Tercero', 1, 1],
      ['Rival', 2, 1],
    ])
    expect(await getStandings(juvenilId, f.seasonId)).toEqual([])
  })

  it('el .ics de un partido del club trae la fecha y el enlace; uno entre rivales no existe', async () => {
    const response = await getIcs(new Request('http://localhost/x'), {
      params: Promise.resolve({ id: matchId }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    const body = await response.text()
    expect(body).toContain('SUMMARY:Honor: Prueba vs Rival')
    expect(body).toContain('URL:http://localhost:3000/partidos/honor-fecha-1')
    expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z/)

    const [neutral] = await admin<{ id: string }[]>`select id from matches where slug = 'entre-rivales'`
    const hidden = await getIcs(new Request('http://localhost/x'), {
      params: Promise.resolve({ id: neutral?.id ?? '' }),
    })
    expect(hidden.status).toBe(404)
    const bad = await getIcs(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'x' }) })
    expect(bad.status).toBe(404)
  })

  it('una dirección antigua resuelve al slug vigente', async () => {
    await admin`insert into slug_redirects (entity_type, old_slug, entity_id) values ('match', 'slug-antiguo', ${matchId})`
    expect(await resolveSlugRedirect('match', 'slug-antiguo')).toBe('honor-fecha-1')
    expect(await resolveSlugRedirect('match', 'nunca-existio')).toBeNull()
    expect(await resolveSlugRedirect('player', 'slug-antiguo')).toBeNull()
  })
})

describe('plantel y fichas (público)', () => {
  it('el plantel muestra a los menores sin apellido, apodo, foto ni ficha', async () => {
    const honor = await getSquad('honor', f.seasonId)
    expect(honor?.players.map((p) => [p.shirtNumber, p.name, p.slug, p.nickname, p.isCaptain])).toEqual([
      [9, 'Carlos Fuentealba', 'adulto-goleador', 'Chino', true],
      [12, 'Luis Arriagada', 'adulto-suplente', null, false],
      [17, 'Tomás V.', null, null, false],
    ])
    const juvenil = await getSquad('juvenil', f.seasonId)
    expect(juvenil?.players).toEqual([
      {
        name: 'Benjamín S.',
        slug: null,
        nickname: null,
        photo: null,
        shirtNumber: 10,
        position: 'delantero',
        isCaptain: false,
      },
    ])
    for (const squad of [honor, juvenil]) {
      const serialized = JSON.stringify(squad)
      for (const secret of [
        'Valdebenito',
        'Sanhueza',
        'Tomy',
        'Benja"',
        'menor-en-honor',
        'juvenil-sin-fecha',
      ]) {
        expect(serialized).not.toContain(secret)
      }
    }
    // Una serie inactiva o inexistente no tiene plantel público.
    expect(await getSquad('antigua', f.seasonId)).toBeNull()
    expect(await getSquad('no-existe', f.seasonId)).toBeNull()
  })

  it('la ficha existe para adultos, con sus estadísticas, y no existe para menores', async () => {
    const profile = await getPlayerProfile('adulto-goleador')
    expect(profile).toMatchObject({
      name: 'Carlos Fuentealba',
      nickname: 'Chino',
      current: [{ seriesSlug: 'honor', shirtNumber: 9, isCaptain: true }],
      stats: [{ seriesName: 'Honor', appearances: 2, goals: 2, yellowCards: 0, redCards: 0 }],
      totals: { appearances: 2, goals: 2 },
    })
    expect(JSON.stringify(profile)).not.toContain('1995-03-10')

    expect(await getPlayerProfile('menor-en-honor')).toBeNull()
    expect(await getPlayerProfile('juvenil-sin-fecha')).toBeNull()
    expect(await getPlayerProfile('no-existe')).toBeNull()
    await admin`update players set is_active = false where slug = 'adulto-suplente'`
    expect(await getPlayerProfile('adulto-suplente')).toBeNull()
  })
})
