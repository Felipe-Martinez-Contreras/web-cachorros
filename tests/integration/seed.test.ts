import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runSeed } from '../../scripts/seed/run'
import { testDb } from './db-urls'
import { cleanSport } from './fixtures'

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
const now = new Date('2026-10-07T15:00:00Z') // miércoles 7 de octubre, 12:00 en Santiago
let uploadsDir: string

const TABLES = [
  'seasons',
  'series',
  'competitions',
  'teams',
  'venues',
  'players',
  'squad_registrations',
  'staff_members',
  'staff_assignments',
  'training_schedules',
  'matches',
  'match_events',
  'match_lineups',
  'standings_tables',
  'standings_rows',
  'player_stat_adjustments',
  'media_assets',
  'news_categories',
  'news',
  'news_series',
  'albums',
  'album_items',
  'videos',
  'social_posts',
  'history_milestones',
  'honours',
  'hall_of_fame',
  'historic_kits',
  'page_blocks',
  'events',
  'sponsors',
  'product_categories',
  'products',
  'product_variants',
  'product_images',
  'membership_plans',
  'board_members',
  'documents',
  'site_settings',
] as const

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const [row] = await admin<{ n: number }[]>`select count(*)::int as n from ${admin(table)}`
    out[table] = row?.n ?? -1
  }
  return out
}

const seed = (live = false) => runSeed({ now, live, uploadsDir, siteEnv: 'development' })

beforeAll(async () => {
  await cleanSport(admin)
  uploadsDir = await mkdtemp(path.join(tmpdir(), 'cachorros-seed-'))
  await seed()
}, 180_000)

afterAll(async () => {
  // Deja la base de pruebas como la encontró para los demás archivos.
  await admin.unsafe(`
    UPDATE site_settings SET featured_series_id = NULL, hero = NULL;
    DELETE FROM documents; DELETE FROM board_members; DELETE FROM membership_plans;
    DELETE FROM product_images; DELETE FROM product_variants; DELETE FROM products; DELETE FROM product_categories;
    DELETE FROM sponsors; DELETE FROM page_blocks; DELETE FROM historic_kits; DELETE FROM hall_of_fame;
    DELETE FROM honours; DELETE FROM history_milestones; DELETE FROM social_posts; DELETE FROM videos;
    DELETE FROM news_series; DELETE FROM news; DELETE FROM album_items; DELETE FROM albums; DELETE FROM events;
    DELETE FROM news_categories; DELETE FROM training_schedules; DELETE FROM staff_assignments; DELETE FROM staff_members;
  `)
  await cleanSport(admin)
  await admin.unsafe('DELETE FROM venues; DELETE FROM media_assets;')
  await admin.end()
  await rm(uploadsDir, { recursive: true, force: true })
})

describe('seed de datos de ejemplo (sección 13)', () => {
  it('carga el contenido de la tabla de la especificación', async () => {
    expect(await counts()).toMatchObject({
      seasons: 2,
      series: 8,
      competitions: 2,
      teams: 12,
      venues: 12,
      players: 105,
      matches: 77 + 35, // 11 fechas × 7 series + los partidos entre rivales de Honor (tabla calculada)
      standings_tables: 7,
      standings_rows: 6 * 12,
      news: 6,
      events: 3,
      sponsors: 4,
      products: 5,
      membership_plans: 3,
      board_members: 6,
      documents: 3,
      albums: 3,
      videos: 2,
      social_posts: 6,
      history_milestones: 7,
      site_settings: 1,
    })
  })

  it('correrlo dos veces no duplica nada', async () => {
    const before = await counts()
    await seed()
    expect(await counts()).toEqual(before)
  }, 180_000)

  it('deja unas 7 fechas jugadas y 4 por jugar en cada serie, con fechas relativas a hoy', async () => {
    const rows = await admin<
      { slug: string; played: number; upcoming: number; past_ok: boolean; future_ok: boolean }[]
    >`
      select s.slug,
        count(*) filter (where m.status = 'finalizado')::int as played,
        count(*) filter (where m.status = 'programado')::int as upcoming,
        bool_and(m.status <> 'finalizado' or m.kickoff_at < ${now}) as past_ok,
        bool_and(m.status <> 'programado' or m.kickoff_at > ${now}) as future_ok
      from matches m join series s on s.id = m.series_id
      where m.club_side <> 'ninguno' group by s.slug order by s.slug`
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row).toMatchObject({ played: 7, upcoming: 4, past_ok: true, future_ok: true })
    }
    const [next] = await admin<{ days: number }[]>`
      select extract(epoch from min(kickoff_at) - ${now}) / 86400 as days from matches where status = 'programado'`
    expect(Number(next?.days)).toBeLessThanOrEqual(7)
  })

  it('el marcador de cada partido del club coincide con sus eventos de gol', async () => {
    const rows = await admin<{ slug: string }[]>`
      select m.slug from matches m
      where m.club_side <> 'ninguno' and m.status = 'finalizado' and (
        m.home_score <> (select count(*) from match_events e where e.match_id = m.id
          and ((e.type in ('gol', 'gol_penal') and e.team_id = m.home_team_id) or (e.type = 'autogol' and e.team_id = m.away_team_id)))
        or m.away_score <> (select count(*) from match_events e where e.match_id = m.id
          and ((e.type in ('gol', 'gol_penal') and e.team_id = m.away_team_id) or (e.type = 'autogol' and e.team_id = m.home_team_id))))`
    expect(rows).toEqual([])
  })

  it('juega las jornadas de las series adultas contra el mismo rival, el mismo día y en la misma cancha', async () => {
    const rows = await admin<{ round_number: number; rivals: number; venues: number; days: number }[]>`
      select m.round_number,
        count(distinct case when m.club_side = 'local' then m.away_team_id else m.home_team_id end)::int as rivals,
        count(distinct m.venue_id)::int as venues,
        count(distinct (m.kickoff_at at time zone 'America/Santiago')::date)::int as days
      from matches m join series s on s.id = m.series_id
      where s.slug in ('honor', 'segunda', 'tercera') and m.club_side <> 'ninguno'
      group by m.round_number`
    expect(rows).toHaveLength(11)
    for (const row of rows) expect(row).toMatchObject({ rivals: 1, venues: 1, days: 1 })
  })

  it('arma planteles de 15 con posiciones equilibradas y deja a Juvenil en modo menores', async () => {
    const squads = await admin<{ slug: string; position: string; n: number }[]>`
      select s.slug, p.primary_position as position, count(*)::int as n
      from squad_registrations r join players p on p.id = r.player_id join series s on s.id = r.series_id
      where r.shirt_number <= 15 group by s.slug, p.primary_position`
    for (const slug of ['honor', 'segunda', 'tercera', 'juvenil', 'senior-35', 'senior-45', 'senior-50']) {
      const shape = Object.fromEntries(squads.filter((r) => r.slug === slug).map((r) => [r.position, r.n]))
      expect(shape).toEqual({ arquero: 2, defensa: 5, mediocampista: 5, delantero: 3 })
    }
    const [minors] = await admin<{ adults: number; without_date: number; in_adult_series: number }[]>`
      select
        count(*) filter (where p.birth_date <= (${now}::date - interval '18 years'))::int as adults,
        count(*) filter (where p.birth_date is null)::int as without_date,
        (select count(*) from squad_registrations r2 join series s2 on s2.id = r2.series_id
          where not s2.contains_minors and r2.player_id in (
            select r3.player_id from squad_registrations r3 join series s3 on s3.id = r3.series_id where s3.contains_minors))::int as in_adult_series
      from players p
      where p.id in (select r.player_id from squad_registrations r join series s on s.id = r.series_id where s.contains_minors)`
    expect(minors).toEqual({ adults: 0, without_date: 3, in_adult_series: 1 })
    const [formativas] = await admin<{ n: number }[]>`
      select count(*)::int as n from squad_registrations r join series s on s.id = r.series_id where s.slug = 'formativas'`
    expect(formativas?.n).toBe(0)
  })

  it('con --en-vivo deja un partido de Honor en curso y sin él lo vuelve a dejar programado', async () => {
    await seed(true)
    const live = await admin<{ slug: string; home_score: number; away_score: number; events: number }[]>`
      select s.slug, m.home_score, m.away_score,
        (select count(*) from match_events e where e.match_id = m.id)::int as events
      from matches m join series s on s.id = m.series_id where m.status = 'en_vivo'`
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({ slug: 'honor', events: 2 })
    expect((live[0]?.home_score ?? 0) + (live[0]?.away_score ?? 0)).toBe(1)

    await seed()
    const [after] = await admin<
      { n: number }[]
    >`select count(*)::int as n from matches where status = 'en_vivo'`
    expect(after?.n).toBe(0)
  }, 240_000)

  it('no inventa datos del club: lo no confirmado queda marcado', async () => {
    const [settings] = await admin<Record<string, string>[]>`
      select club_name, founded_on::text, commune, address, bank_details::text as bank from site_settings`
    expect(settings).toMatchObject({
      club_name: 'Club Deportivo Los Cachorros',
      founded_on: '1934-04-01',
      commune: 'Sagrada Familia',
    })
    expect(settings?.address).toMatch(/^\[COMPLETAR: /)
    expect(settings?.bank).toMatch(/\[COMPLETAR: /)
    const real = await admin<
      { title: string }[]
    >`select title from history_milestones where not is_placeholder`
    expect(real).toEqual([{ title: 'Fundación del club' }])
    const board = await admin<{ n: number }[]>`
      select count(*)::int as n from board_members where full_name not like '%(ejemplo)'`
    expect(board[0]?.n).toBe(0)
  })

  it('procesa las imágenes con el pipeline de medios y guarda los documentos PDF', async () => {
    const [crest] = await admin<{ variants: { webp: unknown[]; png512: string }; lqip: string }[]>`
      select m.variants, m.lqip from teams t join media_assets m on m.id = t.crest_media_id where t.is_own_club`
    expect(crest?.variants.webp.length).toBeGreaterThan(0)
    expect(crest?.variants.png512).toBe('seed-escudo/png512.png')
    expect(crest?.lqip).toMatch(/^data:image\/webp;base64,/)
    expect(await readdir(path.join(uploadsDir, 'seed-doc-estatutos'))).toEqual(['documento.pdf'])
  })

  it('se niega a correr en producción sobre una base con contenido', async () => {
    await expect(runSeed({ now, live: false, uploadsDir, siteEnv: 'production' })).rejects.toThrow(
      /no corre en producción/,
    )
  })
})
