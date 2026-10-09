import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createPlayer, createSportFixture, type SportFixture } from './fixtures'

const { sql } = await import('@/db/client')
const { getSitemapEntries } = await import('@/features/seo/sitemap')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

beforeAll(async () => {
  await cleanSport(admin)
  f = await createSportFixture(admin)
})

afterAll(async () => {
  await cleanSport(admin)
  await admin.end()
  await sql.end()
})

describe('entradas del sitemap', () => {
  it('lista solo lo que el sitio muestra: sin menores, sin borradores, sin partidos ajenos ni series inactivas', async () => {
    const year = new Date().getFullYear()
    const adult = await createPlayer(admin, 'adulto-del-sitemap')
    const minor = await createPlayer(admin, 'menor-por-edad')
    const juvenile = await createPlayer(admin, 'juvenil-sin-fecha')
    const inactive = await createPlayer(admin, 'jugador-inactivo')
    await admin`update players set birth_date = ${`${year - 30}-01-15`} where id = ${adult}`
    await admin`update players set birth_date = ${`${year - 15}-01-15`} where id = ${minor}`
    await admin`update players set is_active = false where id = ${inactive}`
    const [minorsSeries] = await admin<{ id: string }[]>`
      insert into series (name, slug, short_name, kind, contains_minors)
      values ('Juvenil', 'juvenil', 'Juvenil', 'juvenil', true) returning id`
    await admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number)
      values (${juvenile}, ${f.seasonId}, ${minorsSeries?.id ?? ''}, 7)`
    // Un juvenil que además juega en una serie adulta sigue siendo menor.
    await admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number)
      values (${juvenile}, ${f.seasonId}, ${f.seriesId}, 17)`
    await admin`insert into series (name, slug, short_name, kind, is_active)
      values ('Antigua', 'serie-antigua', 'Antigua', 'adulta', false)`

    await createMatch(admin, f, 'partido-del-club')
    const foreign = await createMatch(admin, f, 'partido-entre-rivales')
    await admin`update matches set club_side = 'ninguno' where id = ${foreign}`

    await admin`insert into news (title, slug, status, published_at) values
      ('Publicada', 'noticia-publicada', 'publicada', now() - interval '1 day'),
      ('Borrador', 'noticia-borrador', 'borrador', null),
      ('Futura', 'noticia-futura', 'publicada', now() + interval '1 day'),
      ('Programada', 'noticia-programada', 'programada', now() + interval '1 day')`

    const entries = await getSitemapEntries()
    const paths = entries.map((entry) => entry.path)

    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/noticias',
        '/partidos',
        '/historia',
        '/plantel/honor',
        '/plantel/juvenil',
        '/noticias/noticia-publicada',
        '/partidos/partido-del-club',
        '/jugadores/adulto-del-sitemap',
      ]),
    )
    for (const hidden of [
      '/jugadores/menor-por-edad',
      '/jugadores/juvenil-sin-fecha',
      '/jugadores/jugador-inactivo',
      '/noticias/noticia-borrador',
      '/noticias/noticia-futura',
      '/noticias/noticia-programada',
      '/partidos/partido-entre-rivales',
      '/plantel/serie-antigua',
    ]) {
      expect(paths, `${hidden} no debe estar en el sitemap`).not.toContain(hidden)
    }
    // Ninguna sección que sigue en «Próximamente», ni el panel ni la API.
    expect(paths.some((path) => /^\/(admin|api|tienda|socios|contacto)/.test(path))).toBe(false)
    expect(new Set(paths).size).toBe(paths.length)

    const news = entries.find((entry) => entry.path === '/noticias/noticia-publicada')
    expect(news?.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(entries.find((entry) => entry.path === '/')?.lastModified).toBe(news?.lastModified)
  })
})
