import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createPlayer, createSportFixture, type SportFixture } from './fixtures'

const { sql } = await import('@/db/client')
const current = await import('@/app/api/live/current/route')
const single = await import('@/app/api/live/[matchId]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

function getCurrent(headers: Record<string, string> = {}) {
  return current.GET(new Request('http://localhost:3000/api/live/current', { headers }))
}

function getMatch(matchId: string, headers: Record<string, string> = {}) {
  return single.GET(new Request(`http://localhost:3000/api/live/${matchId}`, { headers }), {
    params: Promise.resolve({ matchId }),
  })
}

beforeAll(async () => {
  await cleanSport(admin)
  f = await createSportFixture(admin)
})

afterAll(async () => {
  await cleanSport(admin)
  await admin.end()
  await sql.end()
})

describe('GET /api/live/current', () => {
  it('lista los en vivo y los que empiezan en 30 min; nada más', async () => {
    const live = await createMatch(admin, f, 'en-vivo-ahora', 'en_vivo')
    const soon = await createMatch(admin, f, 'por-comenzar', 'programado')
    await admin`update matches set kickoff_at = now() + interval '20 minutes' where id = ${soon}`
    const later = await createMatch(admin, f, 'mas-tarde', 'programado')
    await admin`update matches set kickoff_at = now() + interval '2 hours' where id = ${later}`
    const foreign = await createMatch(admin, f, 'entre-rivales', 'en_vivo')
    await admin`update matches set club_side = 'ninguno' where id = ${foreign}`

    const response = await getCurrent()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=10')
    const body = (await response.json()) as { serverNow: string; matches: { id: string }[] }
    expect(body.matches.map((match) => match.id).sort()).toEqual([live, soon].sort())
    expect(Date.parse(body.serverNow)).not.toBeNaN()

    // Sin cambios: 304 sin cuerpo.
    const etag = response.headers.get('etag') ?? ''
    const again = await getCurrent({ 'If-None-Match': etag })
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')

    // Un gol (sube share_version): cambia el ETag.
    await admin`update matches set home_score = 1, share_version = share_version + 1 where id = ${live}`
    expect((await getCurrent({ 'If-None-Match': etag })).status).toBe(200)
    await admin`update matches set status = 'finalizado' where id in (${live}, ${foreign})`
    await admin`delete from matches where id in (${soon}, ${later})`
  })
})

describe('GET /api/live/[matchId]', () => {
  it('pesa 2 KB o menos con 20 eventos, y un menor sale con nombre e inicial', async () => {
    const year = new Date().getFullYear()
    const minor = await createPlayer(admin, 'menor-en-vivo')
    await admin`update players set first_name = 'Benjamín', last_name = 'Zúñiga', birth_date = ${`${year - 15}-03-01`}
      where id = ${minor}`
    const adult = await createPlayer(admin, 'adulto-en-vivo')
    const id = await createMatch(admin, f, 'veinte-eventos', 'en_vivo')
    for (let minute = 1; minute <= 20; minute++) {
      const club = minute % 2 === 0
      await admin`insert into match_events (match_id, type, period, minute, team_id, player_id, free_text_name)
        values (${id}, ${minute % 5 === 0 ? 'tarjeta_amarilla' : 'gol'}, 'primer_tiempo', ${minute},
          ${club ? f.ownTeamId : f.rivalTeamId}, ${club ? (minute === 2 ? minor : adult) : null},
          ${club ? null : 'Pedro Rival Apellido'})`
    }

    const response = await getMatch(id)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(2048)
    const body = JSON.parse(text) as { events: { n?: string }[]; match: { id: string } }
    expect(body.match.id).toBe(id)
    expect(body.events).toHaveLength(20)
    expect(text).not.toContain('Zúñiga')
    expect(body.events.map((event) => event.n)).toContain('Benjamín Z.')

    const etag = response.headers.get('etag') ?? ''
    expect((await getMatch(id, { 'If-None-Match': etag })).status).toBe(304)
  })

  it('un partido que no existe, entre rivales o un id inválido responde 404', async () => {
    const foreign = await createMatch(admin, f, 'rivales-404', 'en_vivo')
    await admin`update matches set club_side = 'ninguno' where id = ${foreign}`
    expect((await getMatch(foreign)).status).toBe(404)
    expect((await getMatch('00000000-0000-4000-8000-000000000000')).status).toBe(404)
    expect((await getMatch('no-es-un-id')).status).toBe(404)
  })

  it('responde en el origen con un p95 de 50 ms o menos (100 peticiones)', async () => {
    const id = await createMatch(admin, f, 'p95-en-vivo', 'en_vivo')
    await getMatch(id)
    const times: number[] = []
    for (let index = 0; index < 100; index++) {
      const start = performance.now()
      await getMatch(id)
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    const p95 = times[94] ?? Number.POSITIVE_INFINITY
    expect(p95, `p95 de /api/live/[matchId] en el origen: ${p95.toFixed(1)} ms`).toBeLessThanOrEqual(50)
  })
})
