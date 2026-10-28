import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createSportFixture, type SportFixture } from './fixtures'
import { actAs, ensureTestUsers } from './session'

// Incidente de staging (sha-8191eed): «Escudos en las tarjetas» pedía ~45 vistas previas a la vez, cada una
// dibujada de nuevo (~1,6 s de CPU en la VM) y aunque el navegador ya se hubiera ido. La app quedó sin CPU y
// sus consultas fallaban con CONNECT_TIMEOUT. Estas pruebas cubren lo que lo evita.

const { sql } = await import('@/db/client')
const { uploadsDir } = await import('@/features/media/files')
const { processImage } = await import('@/lib/images/process')
const { runHeavy } = await import('@/lib/heavy-queue')
const { crestPreviewDir } = await import('@/features/share/crest-preview')
const { getShareImage } = await import('@/features/share/images')
const { shareVersionOf } = await import('@/features/share/queries')
const crestRoute = await import('@/app/api/admin/escudos/[id]/[estilo]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

const STYLES = ['color', 'blanco', 'grises'] as const

function preview(team: string, estilo: string, signal?: AbortSignal) {
  return crestRoute.GET(
    new Request(`http://localhost:3000/api/admin/escudos/${team}/${estilo}`, { signal }),
    {
      params: Promise.resolve({ id: team, estilo }),
    },
  )
}

/** Lo mismo que hace /api/health: `select 1` en el pool de la app, con 2 s de plazo. */
async function ping(): Promise<boolean> {
  return Promise.race([
    sql`select 1`.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
  ]).catch(() => false)
}

/** Conexiones de la app en la BD (por su `application_name`) y cuántas quedaron en una transacción. */
async function appConnections() {
  const [row] = await admin<{ total: number; inTransaction: number }[]>`
    select count(*)::int as total,
      count(*) filter (where state like 'idle in transaction%')::int as "inTransaction"
    from pg_stat_activity where application_name = 'cachorros-web'`
  return row ?? { total: 0, inTransaction: 0 }
}

/** Ocupa la cola de imágenes hasta llamar a `release`. */
function blockQueue() {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const blocker = runHeavy(() => gate)
  return { release, blocker }
}

beforeAll(async () => {
  await rm(crestPreviewDir(), { recursive: true, force: true })
  await cleanSport(admin)
  await ensureTestUsers()
  f = await createSportFixture(admin)
  // Un escudo real del sitio (el del club), procesado como una subida.
  const svg = await readFile(path.join(process.cwd(), 'public', 'placeholder', 'escudo.svg'))
  const processed = await processImage(svg, { uploadsDir: uploadsDir(), kind: 'logo' })
  const [media] = await admin<{ id: string }[]>`
    insert into media_assets (kind, storage_key, mime, bytes, width, height, variants, alt_text)
    values ('imagen', ${processed.storageKey}, ${processed.mime}, ${processed.bytes}, ${processed.width},
      ${processed.height}, ${admin.json(processed.variants)}, 'Escudo de conexiones') returning id`
  await admin`update teams set crest_media_id = ${media?.id ?? null} where id in (${f.rivalTeamId}, ${f.ownTeamId})`
})

afterAll(async () => {
  await cleanSport(admin)
  await admin`delete from media_assets where alt_text = 'Escudo de conexiones'`
  await admin.end()
  await sql.end()
})

describe('conexiones con muchas vistas previas', () => {
  it('50 vistas previas simultáneas no dejan sin conexión a /api/health y se dibujan una sola vez', async () => {
    await actAs('admin')
    const pings: boolean[] = []
    const connections: { total: number; inTransaction: number }[] = []
    let running = true
    const probe = (async () => {
      while (running) {
        pings.push(await ping())
        connections.push(await appConnections())
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    })()
    // Los dos equipos usan el mismo escudo: hay 3 vistas previas distintas (una por estilo).
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        preview(index % 2 ? f.rivalTeamId : f.ownTeamId, STYLES[index % 3] ?? 'color'),
      ),
    )
    running = false
    await probe

    expect(responses.map((response) => response.status)).toEqual(Array(50).fill(200))
    expect(responses.filter((response) => response.headers.get('X-Cache') === 'miss')).toHaveLength(3)
    expect(pings.length).toBeGreaterThan(0)
    expect(pings.every(Boolean)).toBe(true)
    expect(Math.max(...connections.map((row) => row.total))).toBeLessThanOrEqual(5)
    expect(connections.every((row) => row.inTransaction === 0)).toBe(true)
    expect((await readdir(crestPreviewDir())).filter((name) => name.endsWith('.png'))).toHaveLength(3)

    // La segunda vez salen todas del disco, sin entrar a la cola.
    const again = await Promise.all(
      Array.from({ length: 30 }, (_, index) => preview(f.ownTeamId, STYLES[index % 3] ?? 'color')),
    )
    expect(again.every((response) => response.headers.get('X-Cache') === 'hit')).toBe(true)
    expect(runHeavy.pending()).toBe(0)
  }, 120_000)

  it('una vista previa que el navegador abandonó mientras esperaba su turno no se dibuja', async () => {
    await actAs('admin')
    await rm(crestPreviewDir(), { recursive: true, force: true })
    const { release, blocker } = blockQueue()
    const controller = new AbortController()
    const abandoned = preview(f.rivalTeamId, 'blanco', controller.signal)
    await new Promise((resolve) => setTimeout(resolve, 100))
    controller.abort()
    release()
    await blocker
    expect((await abandoned).status).toBe(499)
    const files = await readdir(crestPreviewDir()).catch(() => [] as string[])
    expect(files.filter((name) => name.endsWith('-blanco.png'))).toHaveLength(0)
  })

  it('las tarjetas leen sus datos antes de entrar a la cola de imágenes', async () => {
    const id = await createMatch(admin, f, 'conexiones-tarjeta')
    const request = { template: 'resultado', id, format: 'cuadrado' } as const
    const version = (await shareVersionOf(request))?.version ?? ''
    const { release, blocker } = blockQueue()
    const card = getShareImage(request, version)
    // Mientras la cola está ocupada, la tarjeta ya leyó sus datos: aunque el partido desaparezca ahora, se
    // dibuja con lo leído. Ninguna consulta quedó esperando su turno ni una transacción abierta.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect((await appConnections()).inTransaction).toBe(0)
    await admin`delete from matches where id = ${id}`
    release()
    await blocker
    const image = await card
    expect(image?.fromCache).toBe(false)
    expect(image?.bytes.byteLength).toBeGreaterThan(1000)
  })
})
