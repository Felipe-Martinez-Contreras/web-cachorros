import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createPlayer, createSportFixture, type SportFixture } from './fixtures'

const { sql } = await import('@/db/client')
const { uploadsDir } = await import('@/features/media/files')
const { processImage } = await import('@/lib/images/process')
const { getShareImage, shareCacheDir } = await import('@/features/share/images')
const { loadShareCard, shareVersionOf } = await import('@/features/share/queries')
const route = await import('@/app/api/share/[plantilla]/[id]/[formato]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

function getCard(plantilla: string, id: string, formato: string, query = '') {
  return route.GET(new Request(`http://localhost:3000/api/share/${plantilla}/${id}/${formato}${query}`), {
    params: Promise.resolve({ plantilla, id, formato }),
  })
}

async function versionOf(template: 'programacion' | 'resultados' | 'noticia', id: string) {
  return (await shareVersionOf({ template, id, format: template === 'noticia' ? 'og' : 'cuadrado' }))?.version
}

/** Escudo procesado por el mismo pipeline que una subida (con su PNG de 512 px para Satori). */
async function crestFor(teamId: string, color: string) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="240" fill="${color}"/></svg>`,
  )
  const processed = await processImage(svg, { uploadsDir: uploadsDir(), kind: 'logo' })
  const [media] = await admin<{ id: string }[]>`
    insert into media_assets (kind, storage_key, mime, bytes, width, height, variants, alt_text)
    values ('imagen', ${processed.storageKey}, ${processed.mime}, ${processed.bytes}, ${processed.width},
      ${processed.height}, ${admin.json(processed.variants)}, 'Escudo de tarjeta') returning id`
  await admin`update teams set crest_media_id = ${media?.id ?? null} where id = ${teamId}`
}

beforeAll(async () => {
  await rm(shareCacheDir(), { recursive: true, force: true })
  await cleanSport(admin)
  f = await createSportFixture(admin)
  await crestFor(f.ownTeamId, '#f27604')
  await crestFor(f.rivalTeamId, '#1f7a4d')
})

afterAll(async () => {
  await cleanSport(admin)
  await admin`delete from media_assets where alt_text = 'Escudo de tarjeta'`
  await admin.end()
  await sql.end()
})

describe('tarjetas para redes', () => {
  it('la primera generación se guarda en disco y la siguiente viene de la caché', async () => {
    const id = await createMatch(admin, f, 'tarjeta-resultado')
    const scorer = await createPlayer(admin, 'goleador-tarjeta')
    await admin`update matches set home_score = 2, away_score = 1 where id = ${id}`
    await admin`insert into match_events (match_id, type, period, minute, team_id, player_id) values
      (${id}, 'gol', 'primer_tiempo', 12, ${f.ownTeamId}, ${scorer}),
      (${id}, 'gol_penal', 'segundo_tiempo', 67, ${f.ownTeamId}, ${scorer})`
    const request = { template: 'resultado', id, format: 'cuadrado' } as const
    const version = (await shareVersionOf(request))?.version ?? ''
    expect(version).toBe('1e1')

    const started = performance.now()
    const first = await getShareImage(request, version)
    const firstMs = performance.now() - started
    expect(first?.fromCache).toBe(false)
    // Meta de la especificación: ≤ 3 s en la VM. Aquí con holgura por la carga del CI.
    expect(firstMs, `primera generación: ${Math.round(firstMs)} ms`).toBeLessThan(6000)
    const meta = await sharp(first?.bytes).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 1080, 1080])

    const second = await getShareImage(request, version)
    expect(second?.fromCache).toBe(true)
    expect(second?.bytes.equals(first?.bytes ?? Buffer.alloc(0))).toBe(true)

    const card = await loadShareCard(request)
    expect(card?.kind === 'match' && card.scorers.home).toEqual(["Jugador goleador-tarjeta 12', 67' (p)"])
  })

  it('una versión nueva da otro archivo y borra la anterior', async () => {
    const id = await createMatch(admin, f, 'tarjeta-version')
    const request = { template: 'resultado', id, format: 'vertical' } as const
    await getShareImage(request, '1e1')
    await admin`update matches set home_score = 1, share_version = share_version + 1 where id = ${id}`
    expect((await shareVersionOf(request))?.version).toBe('2e1')
    const fresh = await getShareImage(request, '2e1')
    expect(fresh?.fromCache).toBe(false)
    const files = (await readdir(path.join(shareCacheDir(), 'resultado'))).filter((name) =>
      name.startsWith(id),
    )
    expect(files).toEqual([`${id}-v2e1-vertical.png`])
  })

  it('la imagen Open Graph es JPEG de 1200 × 630 y pesa 300 KB o menos', async () => {
    const id = await createMatch(admin, f, 'tarjeta-og', 'programado')
    // La versión de la previa: la del partido, la del matchday (fotos y auspiciador) y la del diseño.
    const version = (await shareVersionOf({ template: 'proximo', id, format: 'og' }))?.version
    expect(version).toMatch(/^1[0-9a-z]+d4$/)
    const response = await getCard('proximo', id, 'og', `?v=${version}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.byteLength).toBeLessThanOrEqual(300 * 1024)
    const meta = await sharp(bytes).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630])
  })

  it('sin versión o con una antigua redirige a la vigente; lo que no corresponde es 404', async () => {
    const id = await createMatch(admin, f, 'tarjeta-redirige')
    const missing = await getCard('resultado', id, 'historia', '?descargar=1')
    expect(missing.status).toBe(302)
    expect(missing.headers.get('location')).toBe(`/api/share/resultado/${id}/historia?v=1e1&descargar=1`)
    expect((await getCard('resultado', id, 'historia', '?v=0')).status).toBe(302)

    const download = await getCard('resultado', id, 'historia', '?v=1e1&descargar=1')
    expect(download.headers.get('content-disposition')).toBe(
      'attachment; filename="resultado-tarjeta-redirige-historia.png"',
    )

    // Un partido finalizado no tiene «próximo»; uno sin goles del club no tiene «¡Gol!».
    expect((await getCard('proximo', id, 'cuadrado', '?v=1')).status).toBe(404)
    expect((await getCard('gol', id, 'cuadrado', '?v=1e1')).status).toBe(404)
    expect((await getCard('resultado', 'no-es-un-id', 'cuadrado')).status).toBe(404)
    expect((await getCard('resultado', id, 'gigante')).status).toBe(404)
    expect((await getCard('noticia', id, 'cuadrado')).status).toBe(404)

    // Un partido entre rivales no es del club: no hay tarjeta.
    const foreign = await createMatch(admin, f, 'tarjeta-ajena')
    await admin`update matches set club_side = 'ninguno' where id = ${foreign}`
    expect((await getCard('resultado', foreign, 'cuadrado', '?v=1')).status).toBe(404)
  })

  it('«¡Gol!» nombra a un menor solo con nombre e inicial', async () => {
    const id = await createMatch(admin, f, 'tarjeta-gol', 'en_vivo')
    const minor = await createPlayer(admin, 'menor-tarjeta')
    const year = new Date().getFullYear()
    await admin`update players set first_name = 'Benjamín', last_name = 'Zúñiga', birth_date = ${`${year - 15}-03-01`}
      where id = ${minor}`
    await admin`insert into match_events (match_id, type, period, minute, stoppage_minute, team_id, player_id)
      values (${id}, 'gol', 'primer_tiempo', 45, 2, ${f.ownTeamId}, ${minor})`
    const card = await loadShareCard({ template: 'gol', id, format: 'historia' })
    expect(card?.kind === 'match' && card.goal).toEqual({ scorer: 'Benjamín Z.', minute: "45+2'" })
    expect((await getCard('gol', id, 'historia', '?v=1e1')).status).toBe(200)
  })

  it('programación y resultados del fin de semana: solo partidos del club de sábado y domingo', async () => {
    // Un fin de semana lejano: con una fecha cercana, los partidos «de hoy» de otras pruebas caían en él.
    const saturday = '2030-06-01'
    const sat = await createMatch(admin, f, 'sabado', 'programado')
    const sun = await createMatch(admin, f, 'domingo', 'finalizado')
    const monday = await createMatch(admin, f, 'lunes', 'programado')
    await admin`update matches set kickoff_at = '2030-06-01T19:00:00Z' where id = ${sat}`
    await admin`update matches set kickoff_at = '2030-06-02T18:00:00Z' where id = ${sun}`
    await admin`update matches set kickoff_at = '2030-06-03T15:00:00Z' where id = ${monday}`

    const schedule = await loadShareCard({ template: 'programacion', id: saturday, format: 'cuadrado' })
    expect(schedule?.kind === 'weekend' && schedule.matches.length).toBe(2)
    const results = await loadShareCard({ template: 'resultados', id: saturday, format: 'cuadrado' })
    expect(results?.kind === 'weekend' && results.matches.length).toBe(1)

    const before = await versionOf('resultados', saturday)
    await admin`update matches set share_version = share_version + 1 where id = ${sun}`
    expect(await versionOf('resultados', saturday)).not.toBe(before)

    const version = await versionOf('programacion', saturday)
    expect((await getCard('programacion', saturday, 'historia', `?v=${version}`)).status).toBe(200)
    expect((await getCard('resultados', '2026-02-30', 'cuadrado')).status).toBe(404)
    expect((await getCard('programacion', '2030-01-05', 'cuadrado')).status).toBe(404)
  })

  it('la imagen Open Graph de una noticia publicada; una en borrador no tiene', async () => {
    const [published] = await admin<{ id: string }[]>`
      insert into news (title, slug, status, published_at) values
      ('Los Cachorros ganan el clásico en un partido inolvidable', 'noticia-tarjeta', 'publicada',
        now() - interval '1 hour')
      returning id`
    const [draft] = await admin<{ id: string }[]>`
      insert into news (title, slug) values ('Borrador', 'noticia-borrador') returning id`
    const id = published?.id ?? ''
    const response = await getCard('noticia', id, 'og', `?v=${await versionOf('noticia', id)}`)
    expect(response.status).toBe(200)
    expect((await response.arrayBuffer()).byteLength).toBeLessThanOrEqual(300 * 1024)
    expect((await getCard('noticia', draft?.id ?? '', 'og')).status).toBe(404)
  })
})
