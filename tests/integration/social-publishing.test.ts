import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishChannel, PublishResult } from '@/features/social-publishing/channels/types'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createSportFixture, type SportFixture } from './fixtures'
import { actAs, ensureTestUsers } from './session'

// Antes de importar los módulos que leen el entorno: si algo llamara a la Graph API sin simularla, esta
// dirección falla al instante y nunca se llega a Facebook.
vi.stubEnv('FACEBOOK_GRAPH_URL', 'http://127.0.0.1:9')

const { sql } = await import('@/db/client')
const { santiagoWallTime } = await import('@/features/matches/lib/schedule')
const { addDays, weekendOf } = await import('@/features/share/lib/cards')
const { runSocialPublishing } = await import('@/features/social-publishing/tick')
const { facebookChannel, GRAPH_API_VERSION } = await import('@/features/social-publishing/channels/facebook')
const actions = await import('@/features/social-publishing/actions')
const previewRoute = await import('@/app/api/admin/tarjetas/[id]/route')

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
  await ensureTestUsers()
  await cleanSport(admin)
  f = await createSportFixture(admin)
})

beforeEach(async () => {
  await admin`delete from social_publications`
  await admin`delete from matches`
  await setFacebook(enabled)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await cleanSport(admin)
  await admin`delete from media_assets where storage_key like 'fb-foto-%'`
  await setFacebook(null)
  await admin`delete from audit_log where entity_type = 'social_publication'`
  await admin.end()
  await sql.end()
  vi.unstubAllEnvs()
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

  it('con un solo partido el fin de semana publica su tarjeta matchday', async () => {
    const id = await weekendMatch('fb-unico', saturday, '15:30')
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(fridayAt('12:02'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string; filename: string }]
    expect(input.filename).toMatch(/^proximo-/)
    expect(input.caption).toMatch(/^⚽ Partido del fin de semana · Honor/)
    expect(input.caption).toContain(`/partidos/fb-unico`)
    // Sigue siendo la publicación del fin de semana: una sola por sábado.
    expect(await publications()).toMatchObject([{ kind: 'programacion', subject_key: saturday }])
    expect(id).toBeTruthy()
  })

  it('con un solo partido cuya previa ya se publicó, la programación no sale', async () => {
    const id = await weekendMatch('fb-unico-previa', saturday, '15:30')
    await admin`insert into social_publications (channel, kind, subject_key, match_id, trigger, status)
      values ('facebook', 'proximo', ${id}, ${id}, 'manual', 'publicado')`
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(fridayAt('12:02'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await publications()).toMatchObject([{ kind: 'proximo' }])
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

describe('acciones del panel', () => {
  /** Graph API simulada en el `fetch` global: la usa el canal real que arman las acciones. */
  function graphReplies(body: unknown, status = 200) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(body, { status }))
  }

  it('publicar a mano exige permiso', async () => {
    const id = await createMatch(admin, f, 'fb-sin-permiso', 'programado')
    await actAs('prensa')
    expect(await actions.publicarEnFacebook(id, null, { message: 'Hola' })).toEqual({
      ok: false,
      message: 'No tienes permiso para hacer esto.',
    })
    expect(await publications()).toEqual([])
  })

  it('publica la previa con el texto editado y no deja publicarla dos veces', async () => {
    const id = await createMatch(admin, f, 'fb-manual', 'programado')
    await actAs('admin')
    const fetchMock = graphReplies({ id: '1', post_id: '555_666' })
    expect(
      await actions.publicarEnFacebook(id, null, { message: '  Texto revisado a mano  ' }),
    ).toMatchObject({
      ok: true,
    })
    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(form.get('caption')).toBe('Texto revisado a mano')
    expect(await publications()).toMatchObject([
      { kind: 'proximo', subject_key: id, status: 'publicado', external_id: '555_666' },
    ])
    const [log] = await admin<{ user_id: string | null }[]>`
      select user_id from audit_log where action = 'social.publish.request' order by created_at desc limit 1`
    expect(log?.user_id).toBeTruthy()

    expect(await actions.publicarEnFacebook(id, null, { message: 'Otra vez' })).toEqual({
      ok: false,
      message: 'Este partido ya se publicó en Facebook (o está en la cola).',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('si Facebook falla, queda en la cola y «Reintentar» la publica', async () => {
    const id = await createMatch(admin, f, 'fb-manual-error', 'programado')
    await actAs('admin')
    graphReplies({ error: { message: 'Temporarily unavailable', code: 2 } }, 503)
    const result = await actions.publicarEnFacebook(id, null, { message: 'Previa' })
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('se reintentará') })
    const [row] = await admin<{ id: string; status: string }[]>`select id, status from social_publications`
    expect(row?.status).toBe('error')

    vi.restoreAllMocks()
    graphReplies({ id: '1', post_id: '777_888' })
    expect(await actions.reintentarPublicacion(row?.id ?? '')).toMatchObject({ ok: true })
    expect(await publications()).toMatchObject([{ status: 'publicado', external_id: '777_888', attempts: 1 }])
  })

  it('no publica con la publicación desactivada', async () => {
    const id = await createMatch(admin, f, 'fb-manual-apagado', 'programado')
    await setFacebook({ ...enabled, enabled: false })
    await actAs('admin')
    const fetchMock = graphReplies({ id: '1', post_id: '1_1' })
    expect(await actions.publicarEnFacebook(id, null, { message: 'Previa' })).toEqual({
      ok: false,
      message: 'La publicación en Facebook está desactivada en Configuración.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('guardar la configuración anota desde cuándo está activa', async () => {
    await setFacebook(null)
    await actAs('admin')
    expect(
      await actions.guardarFacebook({
        enabled: true,
        weekday: '4',
        time: '18:30',
        publishResults: false,
        topLineMode: 'ninguna',
      }),
    ).toEqual({ ok: true, data: { id: '1' } })
    const [row] = await admin<{ social_publishing: { facebook: Record<string, unknown> } }[]>`
      select social_publishing from site_settings where id = 1`
    expect(row?.social_publishing.facebook).toMatchObject({ enabled: true, weekday: 4, time: '18:30' })
    expect(row?.social_publishing.facebook.enabledAt).toEqual(expect.any(String))
  })

  it('probar la conexión no publica nada', async () => {
    await actAs('admin')
    const fetchMock = graphReplies({ id: '1234567890', name: 'Página de prueba' })
    expect(await actions.probarConexionFacebook()).toEqual({ ok: true, data: { name: 'Página de prueba' } })
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain(`/${GRAPH_API_VERSION}/1234567890?fields=id%2Cname`)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined()
  })
})

describe('fotos del matchday', () => {
  /** Una imagen de la biblioteca (sin archivo: la tarjeta usa el fondo del club, basta para las reglas). */
  async function photo(key: string, containsMinors: boolean) {
    const [row] = await admin<{ id: string }[]>`
      insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors,
        minors_consent_confirmed_at)
      values ('imagen', ${`fb-foto-${key}`}, 'image/jpeg', 10, 'Foto de prueba', ${containsMinors},
        ${containsMinors ? new Date() : null})
      returning id`
    return row?.id ?? ''
  }

  it('Configuración no acepta fotos con menores y guarda las demás', async () => {
    const ok = await photo('ok', false)
    const minors = await photo('menores', true)
    await actAs('admin')
    const base = {
      enabled: true,
      weekday: '5',
      time: '12:00',
      publishResults: false,
      photo3: '',
      topLineMode: 'ninguna',
    }
    expect(await actions.guardarFacebook({ ...base, photo1: ok, photo2: minors })).toMatchObject({
      ok: false,
      fieldErrors: { photo2: [expect.stringContaining('menores')] },
    })
    expect(await actions.guardarFacebook({ ...base, photo1: ok, photo2: '' })).toEqual({
      ok: true,
      data: { id: '1' },
    })
    const [row] = await admin<{ social_publishing: { facebook: { photos: (string | null)[] } } }[]>`
      select social_publishing from site_settings where id = 1`
    expect(row?.social_publishing.facebook.photos).toEqual([ok, null, null])
  })

  it('la línea superior con logo no acepta una imagen con menores y guarda el texto', async () => {
    const logo = await photo('linea-logo', false)
    const minors = await photo('linea-menores', true)
    await actAs('admin')
    const base = { enabled: false, weekday: '5', time: '12:00', publishResults: false }
    expect(
      await actions.guardarFacebook({ ...base, topLineMode: 'logo', topLineLogo: minors }),
    ).toMatchObject({ ok: false, fieldErrors: { topLineLogo: [expect.stringContaining('menores')] } })
    expect(await actions.guardarFacebook({ ...base, topLineMode: 'logo', topLineLogo: logo })).toMatchObject({
      ok: true,
    })
    expect(
      await actions.guardarFacebook({ ...base, topLineMode: 'texto', topLineText: 'Asociación de prueba' }),
    ).toMatchObject({ ok: true })
    const [row] = await admin<{ social_publishing: { facebook: { topLine: unknown } } }[]>`
      select social_publishing from site_settings where id = 1`
    expect(row?.social_publishing.facebook.topLine).toEqual({
      mode: 'texto',
      text: 'Asociación de prueba',
      logoId: null,
    })
  })

  it('elegir las fotos de un post las valida y no guarda nada', async () => {
    const ok = await photo('post-ok', false)
    const minors = await photo('post-menores', true)
    await actAs('prensa')
    expect(await actions.elegirFotosPublicacion({ photo1: ok })).toMatchObject({ ok: false })
    await actAs('admin')
    expect(await actions.elegirFotosPublicacion({ photo1: ok, photo2: minors, photo3: '' })).toMatchObject({
      ok: false,
      fieldErrors: { photo2: [expect.stringContaining('menores')] },
    })
    expect(await actions.elegirFotosPublicacion({ photo1: ok, photo2: '', photo3: ok })).toEqual({
      ok: true,
      data: { id: `${ok},,${ok}` },
    })
  })

  it('la publicación manual guarda sus fotos y vuelve a revisar la regla de menores', async () => {
    const ok = await photo('pub-ok', false)
    const minors = await photo('pub-menores', true)
    await actAs('admin')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ id: '1', post_id: '9_9' }))
    const first = await createMatch(admin, f, 'fb-fotos-menores', 'programado')
    expect(await actions.publicarEnFacebook(first, `${minors},,`, { message: 'Previa' })).toMatchObject({
      ok: false,
    })
    expect(await publications()).toEqual([])

    const second = await createMatch(admin, f, 'fb-fotos-ok', 'programado')
    expect(await actions.publicarEnFacebook(second, `${ok},,`, { message: 'Previa' })).toMatchObject({
      ok: true,
    })
    const [row] = await admin<{ photo_ids: (string | null)[] | null }[]>`
      select photo_ids from social_publications where subject_key = ${second}`
    expect(row?.photo_ids).toEqual([ok, null, null])
  })

  it('la vista previa con fotos elegidas es solo del panel', async () => {
    const id = await createMatch(admin, f, 'fb-fotos-vista', 'programado')
    const get = () =>
      previewRoute.GET(new Request(`http://localhost:3000/api/admin/tarjetas/${id}?fotos=,,`), {
        params: Promise.resolve({ id }),
      })
    await actAs('nadie')
    expect((await get()).status).toBe(401)
    await actAs('admin')
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('jornada', () => {
  const sat = (time: string) => santiagoWallTime(saturday, time)
  let tercera = ''
  let juvenil = ''

  beforeAll(async () => {
    const rows = await admin<{ id: string; slug: string }[]>`
      insert into series (name, slug, short_name, kind, sort_order) values
        ('Tercera', 'tercera', 'Tercera', 'adulta', 1), ('Juvenil', 'juvenil', 'Juvenil', 'juvenil', 2)
      returning id, slug`
    tercera = rows.find((row) => row.slug === 'tercera')?.id ?? ''
    juvenil = rows.find((row) => row.slug === 'juvenil')?.id ?? ''
  })

  /** Un partido programado del sábado contra el rival de prueba, en la serie indicada. */
  async function jornadaMatch(slug: string, seriesId: string, time: string) {
    const id = await createMatch(admin, f, slug, 'programado')
    await admin`update matches set kickoff_at = ${sat(time)}, series_id = ${seriesId} where id = ${id}`
    return id
  }

  async function threeSeries(prefix: string) {
    await jornadaMatch(`${prefix}-tercera`, tercera, '10:00')
    await jornadaMatch(`${prefix}-juvenil`, juvenil, '12:00')
    await jornadaMatch(`${prefix}-honor`, f.seriesId, '15:30')
    return `${saturday}_${f.rivalTeamId}`
  }

  it('se publica a mano una sola vez, con las series marcadas y la hora de la primera', async () => {
    const key = await threeSeries('jo-manual')
    await actAs('admin')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => Response.json({ id: '1', post_id: '42_42' }))
    expect(
      await actions.publicarJornadaEnFacebook(key, `${juvenil},${f.seriesId}`, null, { message: 'Jornada' }),
    ).toMatchObject({ ok: true })
    const [row] = await admin<
      {
        kind: string
        subject_key: string
        status: string
        series_ids: string[] | null
        image_version: string
      }[]
    >`select kind, subject_key, status, series_ids, image_version from social_publications`
    expect(row).toMatchObject({
      kind: 'jornada',
      subject_key: key,
      status: 'publicado',
      series_ids: [juvenil, f.seriesId],
    })
    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData | undefined
    expect(form?.get('caption')).toBe('Jornada')

    // Otra vez (o con otras series): sigue siendo la misma jornada.
    expect(await actions.publicarJornadaEnFacebook(key, null, null, { message: 'Otra' })).toEqual({
      ok: false,
      message: 'Esta jornada ya se publicó en Facebook (o está en la cola).',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // El texto sugerido: hora de inicio de la primera serie marcada (Juvenil, 12:00) y sus series.
    const { publicationContent } = await import('@/features/social-publishing/publish')
    const content = await publicationContent('jornada', key, null, [juvenil, f.seriesId])
    expect(content?.caption).toContain('desde las 12:00 h')
    expect(content?.caption).toContain('Series: Juvenil · Honor')
    expect(content?.version).toBe(row?.image_version)
  })

  it('rechaza series que no juegan y fotos con menores', async () => {
    const key = await threeSeries('jo-rechazos')
    const [minors] = await admin<{ id: string }[]>`
      insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors, minors_consent_confirmed_at)
      values ('imagen', 'fb-foto-jornada-menores', 'image/jpeg', 10, 'Foto de prueba', true, now())
      returning id`
    await actAs('admin')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}))
    expect(
      await actions.publicarJornadaEnFacebook(key, f.seasonId, null, { message: 'Jornada' }),
    ).toMatchObject({ ok: false })
    expect(
      await actions.publicarJornadaEnFacebook(key, null, `${minors?.id},,`, { message: 'Jornada' }),
    ).toMatchObject({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await publications()).toEqual([])
  })

  it('la programación de un fin de semana de una sola jornada publica la tarjeta de la jornada', async () => {
    await threeSeries('jo-auto')
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(fridayAt('12:02'), channel)
    await runSocialPublishing(fridayAt('12:07'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string; filename: string }]
    expect(input.filename).toMatch(/^jornada-/)
    expect(input.caption).toMatch(/^⚽ Jornada del fin de semana · Prueba vs Rival/)
    expect(input.caption).toContain('desde las 10:00 h')
    expect(input.caption).toContain('Series: Tercera · Juvenil · Honor')
    expect(await publications()).toMatchObject([{ kind: 'programacion', subject_key: saturday }])

    // Ya salió como la programación: publicarla a mano sería el mismo post.
    await actAs('admin')
    expect(
      await actions.publicarJornadaEnFacebook(`${saturday}_${f.rivalTeamId}`, null, null, { message: 'x' }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('programación del fin de semana') })
  })

  it('si la jornada ya se publicó a mano, la programación no sale', async () => {
    const key = await threeSeries('jo-previa')
    await admin`insert into social_publications (channel, kind, subject_key, trigger, status)
      values ('facebook', 'jornada', ${key}, 'manual', 'publicado')`
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(fridayAt('12:02'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await publications()).toMatchObject([{ kind: 'jornada' }])
  })

  it('con dos rivales el fin de semana sale la grilla (un solo post)', async () => {
    await jornadaMatch('jo-grilla-1', tercera, '10:00')
    const [other] = await admin<{ id: string }[]>`
      insert into teams (name, short_name, slug) values ('Otro rival', 'Otro', 'otro-rival') returning id`
    const second = await jornadaMatch('jo-grilla-2', juvenil, '12:00')
    await admin`update matches set away_team_id = ${other?.id ?? ''} where id = ${second}`
    const { channel, publishPhoto } = fakeChannel(published())
    await runSocialPublishing(fridayAt('12:02'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string; filename: string }]
    expect(input.filename).toMatch(/^programacion-/)
    await admin`delete from matches`
    await admin`delete from teams where slug = 'otro-rival'`
  })
})
