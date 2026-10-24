import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishChannel, PublishResult } from '@/features/social-publishing/channels/types'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createSportFixture, type SportFixture } from './fixtures'

const { sql } = await import('@/db/client')
const { santiagoWallTime } = await import('@/features/matches/lib/schedule')
const { addDays, weekendOf } = await import('@/features/share/lib/cards')
const { runSocialPublishing } = await import('@/features/social-publishing/tick')
const { facebookChannel, GRAPH_API_VERSION } = await import('@/features/social-publishing/channels/facebook')

// Publicación en Facebook con la Graph API simulada: nunca se llama a Facebook real.

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture

// Un fin de semana lejano, para no cruzarse con otros datos.
const saturday = weekendOf('2030-10-28')
const friday = addDays(saturday, -1)
const fridayAt = (time: string) => santiagoWallTime(friday, time)

/** Canal simulado: responde lo que se le indique y cuenta las publicaciones. */
function fakeChannel(...results: PublishResult[]) {
  let call = 0
  const publishPhoto = vi.fn(async () => {
    const result = results[Math.min(call, results.length - 1)] ?? { ok: true, externalId: 'x', url: 'x' }
    call++
    return result
  })
  const channel: PublishChannel = {
    id: 'facebook',
    publishPhoto,
    testConnection: async () => ({ ok: true, name: 'Página de prueba' }),
  }
  return { channel, publishPhoto }
}

const published = (id = '111_222'): PublishResult => ({
  ok: true,
  externalId: id,
  url: `https://www.facebook.com/${id}`,
})

async function setFacebook(settings: Record<string, string | number | boolean> | null) {
  await admin`update site_settings set social_publishing = ${settings ? admin.json({ facebook: settings }) : null} where id = 1`
}

const enabled = {
  enabled: true,
  weekday: 5,
  time: '12:00',
  publishResults: false,
  enabledAt: '2020-01-01T00:00:00.000Z',
}

async function weekendMatch(slug: string, day: string, time: string) {
  const id = await createMatch(admin, f, slug, 'programado')
  await admin`update matches set kickoff_at = ${santiagoWallTime(day, time)} where id = ${id}`
  return id
}

async function publications() {
  return admin<
    {
      kind: string
      subject_key: string
      status: string
      attempts: number
      external_id: string | null
      last_error: string | null
      next_attempt_at: Date | null
    }[]
  >`select kind, subject_key, status, attempts, external_id, last_error, next_attempt_at
    from social_publications order by created_at`
}

beforeAll(async () => {
  await cleanSport(admin)
  f = await createSportFixture(admin)
})

beforeEach(async () => {
  await admin`delete from social_publications`
  await admin`delete from matches`
  await setFacebook(enabled)
})

afterAll(async () => {
  await cleanSport(admin)
  await setFacebook(null)
  await admin`delete from audit_log where entity_type = 'social_publication'`
  await admin.end()
  await sql.end()
})

describe('programación automática', () => {
  it('a la hora programada se encola una sola vez y se publica una sola vez', async () => {
    await weekendMatch('fb-sabado', saturday, '15:30')
    await weekendMatch('fb-domingo', addDays(saturday, 1), '11:00')
    const { channel, publishPhoto } = fakeChannel(published())

    // Antes de la hora no pasa nada.
    expect(await runSocialPublishing(fridayAt('11:55'), channel)).toEqual({
      queued: 0,
      published: 0,
      failed: 0,
    })

    // Dos ticks a la vez: el índice único y el bloqueo de la fila impiden un post duplicado.
    const now = fridayAt('12:02')
    await Promise.all([runSocialPublishing(now, channel), runSocialPublishing(now, channel)])
    await runSocialPublishing(fridayAt('12:07'), channel)

    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [
      { image: Buffer; caption: string; filename: string },
    ]
    expect(input.image.subarray(1, 4).toString()).toBe('PNG')
    expect(input.caption).toContain('⚽ Programación del fin de semana')
    expect(input.caption).toContain('Prueba vs Rival')
    expect(input.caption).toContain('Todos los partidos: http://localhost:3000/partidos')
    expect(await publications()).toMatchObject([
      {
        kind: 'programacion',
        subject_key: saturday,
        status: 'publicado',
        attempts: 1,
        external_id: '111_222',
      },
    ])
    const [log] = await admin<{ user_id: string | null; action: string }[]>`
      select user_id, action from audit_log where entity_type = 'social_publication' and action = 'social.publish'`
    expect(log).toEqual({ user_id: null, action: 'social.publish' })
  })

  it('sin partidos ese fin de semana no publica nada', async () => {
    const { channel, publishPhoto } = fakeChannel(published())
    expect(await runSocialPublishing(fridayAt('12:02'), channel)).toEqual({
      queued: 0,
      published: 0,
      failed: 0,
    })
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await publications()).toEqual([])
  })

  it('desactivada no encola ni llama a Facebook', async () => {
    await weekendMatch('fb-apagado', saturday, '15:30')
    await setFacebook({ ...enabled, enabled: false })
    const { channel, publishPhoto } = fakeChannel(published())
    expect(await runSocialPublishing(fridayAt('12:02'), channel)).toMatchObject({ skipped: 'desactivada' })
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await publications()).toEqual([])
  })
})

describe('reintentos', () => {
  it('una falla transitoria se reintenta con espera hasta 5 veces y ahí se detiene', async () => {
    await weekendMatch('fb-reintento', saturday, '15:30')
    const { channel, publishPhoto } = fakeChannel({
      ok: false,
      failure: { kind: 'transitorio', message: 'Facebook respondió: Limit (código 4)' },
    })
    let now = fridayAt('12:00')
    await runSocialPublishing(now, channel)
    expect(await publications()).toMatchObject([{ status: 'error', attempts: 1 }])

    // Antes de la espera (5 min) no se reintenta.
    await runSocialPublishing(new Date(now.getTime() + 2 * 60_000), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)

    // Ticks cada 5 minutos durante 4 horas: alcanza para las esperas de 5, 15, 45 y 120 minutos.
    for (let minute = 5; minute <= 240; minute += 5) {
      now = new Date(fridayAt('12:00').getTime() + minute * 60_000)
      await runSocialPublishing(now, channel)
    }
    expect(publishPhoto).toHaveBeenCalledTimes(5)
    expect(await publications()).toMatchObject([
      {
        status: 'error',
        attempts: 5,
        next_attempt_at: null,
        last_error: 'Facebook respondió: Limit (código 4)',
      },
    ])
    const failures = await admin`
      select 1 from audit_log where entity_type = 'social_publication' and action = 'social.publish.failed'`
    expect(failures.length).toBeGreaterThanOrEqual(5)
  })

  it('si no hubo respuesta clara queda «Sin confirmar» y no se reintenta solo', async () => {
    await weekendMatch('fb-incierto', saturday, '15:30')
    const { channel, publishPhoto } = fakeChannel({
      ok: false,
      failure: { kind: 'incierto', message: 'Facebook no respondió a tiempo.' },
    })
    await runSocialPublishing(fridayAt('12:00'), channel)
    await runSocialPublishing(fridayAt('14:00'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    expect(await publications()).toMatchObject([{ status: 'incierto', attempts: 1, next_attempt_at: null }])
  })

  it('una publicación que quedó a medias pasa a «Sin confirmar»', async () => {
    await admin`insert into social_publications (channel, kind, subject_key, trigger, status, attempts, updated_at)
      values ('facebook', 'programacion', '2030-01-05', 'automatica', 'publicando', 1, now() - interval '1 hour')`
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(new Date(), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await publications()).toMatchObject([{ status: 'incierto' }])
  })
})

describe('resultados automáticos', () => {
  it('publica el resultado diez minutos después de finalizar, si está activo', async () => {
    const now = new Date()
    const id = await createMatch(admin, f, 'fb-resultado')
    // Se jugó hace dos horas: si hoy es fin de semana, la programación ya no corresponde.
    await admin`update matches set home_score = 3, away_score = 1, kickoff_at = ${new Date(now.getTime() - 2 * 3_600_000)},
      finished_at = ${new Date(now.getTime() - 3 * 60_000)} where id = ${id}`
    await setFacebook({
      ...enabled,
      weekday: 1,
      time: '00:00',
      publishResults: true,
      resultsEnabledAt: '2020-01-01T00:00:00.000Z',
    })
    const { channel, publishPhoto } = fakeChannel(published('333_444'))

    // Recién finalizado: espera por si se corrige el marcador.
    await runSocialPublishing(now, channel)
    expect(await publications()).toEqual([])

    await runSocialPublishing(new Date(now.getTime() + 8 * 60_000), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string }]
    expect(input.caption).toContain('Prueba 3–1 Rival')
    expect(await publications()).toMatchObject([{ kind: 'resultado', subject_key: id, status: 'publicado' }])
  })

  it('no publica resultados de antes de activarlo', async () => {
    const id = await createMatch(admin, f, 'fb-resultado-viejo')
    await admin`update matches set finished_at = now() - interval '30 minutes' where id = ${id}`
    await setFacebook({ ...enabled, publishResults: true, resultsEnabledAt: new Date().toISOString() })
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(new Date(), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
  })
})

describe('canal de Facebook (Graph API simulada)', () => {
  it('sube la imagen como archivo, con el token en el cuerpo y nunca en la URL', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ id: '999', post_id: '123_999' }),
    )
    const channel = facebookChannel({
      pageId: '123',
      token: 'token-secreto-de-prueba-0123456789',
      baseUrl: 'https://graph.example',
      fetch: fetchMock as unknown as typeof fetch,
    })
    const result = await channel.publishPhoto({
      image: Buffer.from('png'),
      filename: 'tarjeta.png',
      caption: 'Hola',
    })
    expect(result).toEqual({ ok: true, externalId: '123_999', url: 'https://www.facebook.com/123_999' })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe(`https://graph.example/${GRAPH_API_VERSION}/123/photos`)
    const form = init?.body as FormData
    expect(form.get('caption')).toBe('Hola')
    expect(form.get('access_token')).toBe('token-secreto-de-prueba-0123456789')
    expect((form.get('source') as File).name).toBe('tarjeta.png')
  })

  it('un token vencido es un error definitivo y el mensaje no trae el token', async () => {
    const token = 'token-secreto-de-prueba-0123456789'
    const channel = facebookChannel({
      pageId: '123',
      token,
      baseUrl: 'https://graph.example',
      fetch: (async () =>
        Response.json(
          { error: { message: `Invalid ${token}`, code: 190 } },
          { status: 400 },
        )) as unknown as typeof fetch,
    })
    const result = await channel.publishPhoto({ image: Buffer.from('png'), filename: 'x.png', caption: '' })
    expect(result).toMatchObject({ ok: false, failure: { kind: 'definitivo' } })
    expect(JSON.stringify(result)).not.toContain(token)
  })
})
