import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createPlayer, createSportFixture, type SportFixture } from './fixtures'

const { proxySql } = await import('@/db/proxy-client')
const { matchSlugStatus } = await import('@/features/matches/slug')
const { newsSlugStatus } = await import('@/features/news/slug')
const { playerSlugStatus, seriesSlugStatus } = await import('@/features/players/slug')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

const FOUND = { kind: 'found' }
const MISSING = { kind: 'missing' }

const redirect = (entityType: string, oldSlug: string, entityId: string) =>
  admin`insert into slug_redirects (entity_type, old_slug, entity_id) values (${entityType}, ${oldSlug}, ${entityId})`

beforeAll(async () => {
  await cleanSport(admin)
  await admin`delete from slug_redirects`
  f = await createSportFixture(admin)
})

afterAll(async () => {
  await cleanSport(admin)
  await admin`delete from slug_redirects`
  await admin.end()
  await proxySql.end()
})

// Lo que `proxy.ts` consulta para responder 200, 301 o 404 en las páginas de detalle (ADR 0008).
describe('estado de un slug para el proxy', () => {
  it('partido: existe, cambió de slug o no existe; uno ajeno al club no existe', async () => {
    const id = await createMatch(admin, f, 'honor-fecha-1')
    await redirect('match', 'honor-fecha-uno', id)
    const foreign = await createMatch(admin, f, 'partido-ajeno')
    await admin`update matches set club_side = 'ninguno' where id = ${foreign}`
    await redirect('match', 'partido-ajeno-antiguo', foreign)

    expect(await matchSlugStatus('honor-fecha-1')).toEqual(FOUND)
    expect(await matchSlugStatus('honor-fecha-uno')).toEqual({ kind: 'moved', slug: 'honor-fecha-1' })
    expect(await matchSlugStatus('no-existe')).toEqual(MISSING)
    expect(await matchSlugStatus('partido-ajeno')).toEqual(MISSING)
    expect(await matchSlugStatus('partido-ajeno-antiguo')).toEqual(MISSING)
    // La redirección de otra entidad con el mismo slug antiguo no cuenta.
    expect(await seriesSlugStatus('honor-fecha-uno')).toEqual(MISSING)
  })

  it('un slug vigente gana a una redirección antigua con el mismo texto', async () => {
    const other = await createMatch(admin, f, 'honor-fecha-2')
    await createMatch(admin, f, 'honor-fecha-3')
    await redirect('match', 'honor-fecha-3', other)
    expect(await matchSlugStatus('honor-fecha-3')).toEqual(FOUND)
  })

  it('jugador: la ficha de un menor o de un inactivo no existe, ni siquiera por su slug antiguo', async () => {
    const year = new Date().getFullYear()
    const adult = await createPlayer(admin, 'adulto')
    const minor = await createPlayer(admin, 'menor')
    const noBirthDate = await createPlayer(admin, 'juvenil-sin-fecha')
    const inactive = await createPlayer(admin, 'inactivo')
    await admin`update players set birth_date = ${`${year - 30}-01-15`} where id = ${adult}`
    await admin`update players set birth_date = ${`${year - 15}-01-15`} where id = ${minor}`
    await admin`update players set is_active = false where id = ${inactive}`
    const [juvenil] = await admin<{ id: string }[]>`
      insert into series (name, slug, short_name, kind, contains_minors)
      values ('Juvenil', 'juvenil', 'Juvenil', 'juvenil', true) returning id`
    await admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number)
      values (${noBirthDate}, ${f.seasonId}, ${juvenil?.id ?? ''}, 7)`
    await redirect('player', 'adulto-antiguo', adult)
    await redirect('player', 'menor-antiguo', minor)

    expect(await playerSlugStatus('adulto')).toEqual(FOUND)
    expect(await playerSlugStatus('adulto-antiguo')).toEqual({ kind: 'moved', slug: 'adulto' })
    expect(await playerSlugStatus('menor')).toEqual(MISSING)
    expect(await playerSlugStatus('menor-antiguo')).toEqual(MISSING)
    expect(await playerSlugStatus('juvenil-sin-fecha')).toEqual(MISSING)
    expect(await playerSlugStatus('inactivo')).toEqual(MISSING)
    expect(await playerSlugStatus('nadie')).toEqual(MISSING)
  })

  it('serie del plantel: solo las activas, con su redirección', async () => {
    await admin`insert into series (name, slug, short_name, kind, is_active)
      values ('Antigua', 'antigua', 'Antigua', 'adulta', false)`
    await redirect('series', 'primera', f.seriesId)

    expect(await seriesSlugStatus('honor')).toEqual(FOUND)
    expect(await seriesSlugStatus('primera')).toEqual({ kind: 'moved', slug: 'honor' })
    expect(await seriesSlugStatus('antigua')).toEqual(MISSING)
    expect(await seriesSlugStatus('no-existe')).toEqual(MISSING)
  })

  it('noticia: solo la publicada cuya fecha ya llegó', async () => {
    const insert = (slug: string, status: string, publishedAt: string | null) =>
      admin<{ id: string }[]>`
        insert into news (title, slug, status, published_at)
        values (${slug}, ${slug}, ${status}, ${publishedAt}) returning id`
    const [published] = await insert('publicada', 'publicada', '2026-01-01T12:00:00Z')
    await insert('borrador', 'borrador', null)
    await insert('futura', 'publicada', '2999-01-01T12:00:00Z')
    await redirect('news', 'publicada-antigua', published?.id ?? '')

    expect(await newsSlugStatus('publicada')).toEqual(FOUND)
    expect(await newsSlugStatus('publicada-antigua')).toEqual({ kind: 'moved', slug: 'publicada' })
    expect(await newsSlugStatus('borrador')).toEqual(MISSING)
    expect(await newsSlugStatus('futura')).toEqual(MISSING)
  })
})
