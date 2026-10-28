import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishChannel, PublishResult } from '@/features/social-publishing/channels/types'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createSportFixture, type SportFixture } from './fixtures'
import { actAs, ensureTestUsers } from './session'

// Publicaciones programadas de una jornada o un partido: programar, el tick a su hora (una sola vez), cambiar
// la fecha, cancelar, los seguros (partido postergado, cambio de hora o de día, Facebook apagado) y el aviso
// por correo del descarte. La Graph API y el correo son dobles: nunca se llama a Facebook ni se envía nada.

vi.stubEnv('FACEBOOK_GRAPH_URL', 'http://127.0.0.1:9')
const doubles = vi.hoisted(() => ({
  sendMail: vi.fn<(message: { to: string | string[]; subject: string; text: string }) => Promise<void>>(),
}))
vi.mock('@/lib/mail', () => ({ sendMail: doubles.sendMail }))

const { sql } = await import('@/db/client')
const { santiagoWallTime } = await import('@/features/matches/lib/schedule')
const { addDays, weekendOf } = await import('@/features/share/lib/cards')
const { runSocialPublishing } = await import('@/features/social-publishing/tick')
const { publicationContent } = await import('@/features/social-publishing/publish')
const { STARTED_WHILE_DISABLED } = await import('@/features/social-publishing/lib/scheduling')
const actions = await import('@/features/social-publishing/actions')
const { recentlyDiscardedScheduled } = await import('@/features/social-publishing/admin-queries')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture
let tercera = ''
let juvenil = ''

// Un sábado lejano, para no cruzarse con otros datos.
const saturday = weekendOf('2030-11-11')
const friday = addDays(saturday, -1)
const sat = (time: string) => santiagoWallTime(saturday, time)
const fri = (time: string) => santiagoWallTime(friday, time)

const enabled = {
  enabled: true,
  weekday: 5,
  time: '12:00',
  publishResults: false,
  enabledAt: '2020-01-01T00:00:00.000Z',
}

async function setFacebook(settings: Record<string, unknown> | null) {
  await admin`update site_settings set social_publishing = ${settings ? admin.json({ facebook: settings } as never) : null} where id = 1`
}

/** Canal simulado: publica bien y cuenta las publicaciones. */
function fakeChannel() {
  let call = 0
  const publishPhoto = vi.fn(async (): Promise<PublishResult> => {
    call++
    return { ok: true, externalId: `post_${call}`, url: `https://www.facebook.com/post_${call}` }
  })
  const channel: PublishChannel = {
    id: 'facebook',
    publishPhoto,
    testConnection: async () => ({ ok: true, name: 'Página de prueba' }),
  }
  return { channel, publishPhoto }
}

type Row = {
  id: string
  kind: string
  status: string
  message: string | null
  scheduled_at: Date | null
  last_error: string | null
  photo_ids: (string | null)[] | null
  discard_notified_at: Date | null
  discard_notify_attempts: number
}

async function rows(): Promise<Row[]> {
  return admin<Row[]>`
    select id, kind, status, message, scheduled_at, last_error, photo_ids, discard_notified_at,
      discard_notify_attempts
    from social_publications order by created_at`
}

async function only(): Promise<Row> {
  const [row] = await rows()
  if (!row) throw new Error('No hay publicaciones.')
  return row
}

/** Un partido programado del sábado contra el rival de prueba, en la serie indicada. */
async function match(slug: string, seriesId: string, time: string) {
  const id = await createMatch(admin, f, slug, 'programado')
  await admin`update matches set kickoff_at = ${sat(time)}, series_id = ${seriesId} where id = ${id}`
  return id
}

/** Jornada de tres series: Tercera 10:00, Juvenil 12:00 y Honor 15:30. */
async function jornada(prefix: string) {
  const ids = {
    tercera: await match(`${prefix}-tercera`, tercera, '10:00'),
    juvenil: await match(`${prefix}-juvenil`, juvenil, '12:00'),
    honor: await match(`${prefix}-honor`, f.seriesId, '15:30'),
  }
  return { key: `${saturday}_${f.rivalTeamId}`, ids }
}

const suggested = async (key: string) => (await publicationContent('jornada', key, null, null))?.caption ?? ''
const when = (date: string, time: string) => ({ date, time })

beforeAll(async () => {
  await ensureTestUsers()
  await cleanSport(admin)
  f = await createSportFixture(admin)
  const created = await admin<{ id: string; slug: string }[]>`
    insert into series (name, slug, short_name, kind, sort_order) values
      ('Tercera', 'prog-tercera', 'Tercera', 'adulta', 1), ('Juvenil', 'prog-juvenil', 'Juvenil', 'juvenil', 2)
    returning id, slug`
  tercera = created.find((row) => row.slug === 'prog-tercera')?.id ?? ''
  juvenil = created.find((row) => row.slug === 'prog-juvenil')?.id ?? ''
})

beforeEach(async () => {
  await admin`delete from social_publications`
  await admin`delete from matches`
  await setFacebook(enabled)
  doubles.sendMail.mockReset()
  doubles.sendMail.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await admin`delete from social_publications`
  await cleanSport(admin)
  await admin`delete from media_assets where storage_key like 'fb-prog-%'`
  await setFacebook(null)
  await admin`delete from audit_log where entity_type = 'social_publication'`
  await admin.end()
  await sql.end()
  vi.unstubAllEnvs()
})

describe('programar una jornada', () => {
  it('el tick la publica a su hora una sola vez, con el texto armado al publicar', async () => {
    const { key } = await jornada('p-una-vez')
    await actAs('admin')
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, {
        message: await suggested(key),
        ...when(friday, '10:00'),
      }),
    ).toMatchObject({ ok: true })
    const programmed = await only()
    // El texto sugerido no se guarda: se arma al publicar con los datos vigentes.
    expect(programmed).toMatchObject({ kind: 'jornada', status: 'programada', message: null })
    expect(programmed.scheduled_at).toEqual(fri('10:00'))

    const { channel, publishPhoto } = fakeChannel()
    // Antes de la hora no sale.
    await runSocialPublishing(fri('09:55'), channel)
    await runSocialPublishing(fri('09:59'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect((await only()).status).toBe('programada')

    // A la hora: dos ticks a la vez y uno después; una sola publicación.
    await Promise.all([
      runSocialPublishing(fri('10:02'), channel),
      runSocialPublishing(fri('10:02'), channel),
    ])
    await runSocialPublishing(fri('10:07'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string; filename: string }]
    expect(input.filename).toMatch(/^jornada-/)
    expect(input.caption).toContain('desde las 10:00 h')
    expect(input.caption).toContain('Series: Tercera · Juvenil · Honor')
    expect(await only()).toMatchObject({ status: 'publicado', message: input.caption })
  })

  it('un texto escrito a mano sale tal cual', async () => {
    const { key } = await jornada('p-texto')
    await actAs('admin')
    await actions.programarJornadaEnFacebook(key, `${juvenil},${f.seriesId}`, null, {
      message: '  Vamos Cachorros  ',
      ...when(friday, '18:00'),
    })
    expect(await only()).toMatchObject({ status: 'programada', message: 'Vamos Cachorros' })
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('18:01'), channel)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string }]
    expect(input.caption).toBe('Vamos Cachorros')
  })

  it('valida la hora: futura y antes del primer partido', async () => {
    const { key } = await jornada('p-hora')
    await actAs('admin')
    const message = 'Jornada'
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, { message, ...when(saturday, '10:00') }),
    ).toMatchObject({ ok: false, fieldErrors: { time: [expect.stringContaining('anterior al inicio')] } })
    // Con solo Juvenil y Honor, el primer partido es a las 12:00.
    expect(
      await actions.programarJornadaEnFacebook(key, `${juvenil},${f.seriesId}`, null, {
        message,
        ...when(saturday, '11:00'),
      }),
    ).toMatchObject({ ok: true })
    await admin`delete from social_publications`
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, { message, ...when('2020-01-01', '10:00') }),
    ).toMatchObject({ ok: false, fieldErrors: { time: [expect.stringContaining('5 minutos')] } })
    expect(await rows()).toEqual([])
  })

  it('exige permiso para programar, cambiar la fecha y cancelar', async () => {
    const { key } = await jornada('p-permiso')
    await actAs('nadie')
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') }),
    ).toMatchObject({ ok: false })
    await actAs('admin')
    await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') })
    const { id } = await only()
    await actAs('nadie')
    expect(await actions.cambiarFechaProgramada(id, when(friday, '11:00'))).toMatchObject({ ok: false })
    expect(await actions.cancelarProgramada(id)).toMatchObject({ ok: false })
    expect((await only()).scheduled_at).toEqual(fri('10:00'))
  })
})

describe('cambiar fecha y cancelar', () => {
  it('cambia la fecha si sigue siendo válida', async () => {
    const { key } = await jornada('c-fecha')
    await actAs('admin')
    await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') })
    const { id } = await only()
    expect(await actions.cambiarFechaProgramada(id, when(saturday, '09:00'))).toMatchObject({ ok: true })
    expect((await only()).scheduled_at).toEqual(sat('09:00'))
    expect(await actions.cambiarFechaProgramada(id, when(saturday, '10:30'))).toMatchObject({
      ok: false,
      fieldErrors: { time: [expect.stringContaining('anterior al inicio')] },
    })
    expect((await only()).scheduled_at).toEqual(sat('09:00'))
  })

  it('cancelar la borra y deja volver a programarla o publicarla', async () => {
    const { key } = await jornada('c-cancelar')
    await actAs('admin')
    await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') })
    const { id } = await only()
    // Mientras está programada no se publica ni se programa otra vez.
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '11:00') }),
    ).toEqual({
      ok: false,
      message: 'Esta jornada ya está programada en Facebook: cámbiale la fecha o cancélala.',
    })
    expect(await actions.publicarJornadaEnFacebook(key, null, null, { message: 'x' })).toMatchObject({
      ok: false,
      message: expect.stringContaining('ya está programada'),
    })
    expect(await actions.cancelarProgramada(id)).toEqual({ ok: true, data: { id } })
    expect(await rows()).toEqual([])
    expect(await actions.cancelarProgramada(id)).toMatchObject({ ok: false })
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '11:00') }),
    ).toMatchObject({ ok: true })
    const [audit] = await admin<{ count: number }[]>`
      select count(*)::int as count from audit_log where action = 'social.schedule.cancel'`
    expect(audit?.count).toBeGreaterThan(0)
  })
})

describe('seguros', () => {
  async function programmed(prefix: string, message?: string) {
    const created = await jornada(prefix)
    await actAs('admin')
    await actions.programarJornadaEnFacebook(created.key, null, null, {
      message: message ?? (await suggested(created.key)),
      ...when(friday, '10:00'),
    })
    return created
  }

  it('postergar un partido la descarta con el motivo y avisa una sola vez por correo', async () => {
    const { ids } = await programmed('s-postergar')
    await admin`update matches set status = 'postergado' where id = ${ids.juvenil}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('08:00'), channel)
    await runSocialPublishing(fri('08:05'), channel)
    await runSocialPublishing(fri('10:02'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await only()).toMatchObject({
      status: 'descartado',
      last_error: 'Se postergó un partido de la jornada.',
    })
    expect(doubles.sendMail).toHaveBeenCalledTimes(1)
    const [mail] = doubles.sendMail.mock.calls[0] ?? []
    expect(mail?.to).toContain('acciones-admin@cachorros.test')
    expect(mail?.subject).toBe('No se publicará en Facebook: jornada')
    expect(mail?.text).toContain('Motivo: Se postergó un partido de la jornada.')
    expect(mail?.text).toContain(`http://localhost:3000/admin/partidos/jornadas/${saturday}_${f.rivalTeamId}`)
    expect((await only()).discard_notified_at).not.toBeNull()
    // El panel lo avisa con el motivo y el enlace para volver a programarla.
    expect(await recentlyDiscardedScheduled(fri('10:02'))).toMatchObject([
      {
        reason: 'Se postergó un partido de la jornada.',
        href: `/admin/partidos/jornadas/${saturday}_${f.rivalTeamId}`,
      },
    ])
  })

  it('si el correo falla, se reintenta en el tick siguiente', async () => {
    const { ids } = await programmed('s-correo')
    await admin`update matches set status = 'cancelado' where id = ${ids.honor}`
    doubles.sendMail.mockRejectedValueOnce(new Error('SMTP caído'))
    const { channel } = fakeChannel()
    await runSocialPublishing(fri('08:00'), channel)
    expect(await only()).toMatchObject({
      status: 'descartado',
      discard_notified_at: null,
      discard_notify_attempts: 1,
    })
    await runSocialPublishing(fri('08:05'), channel)
    await runSocialPublishing(fri('08:10'), channel)
    expect(doubles.sendMail).toHaveBeenCalledTimes(2)
    expect(await only()).toMatchObject({ discard_notify_attempts: 2 })
    expect((await only()).discard_notified_at).not.toBeNull()
  })

  it('cambia la hora el mismo día con el texto sugerido: sale con la hora nueva', async () => {
    const { ids } = await programmed('s-hora')
    await admin`update matches set kickoff_at = ${sat('11:00')} where id = ${ids.tercera}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('10:01'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    const [input] = publishPhoto.mock.calls[0] as unknown as [{ caption: string }]
    expect(input.caption).toContain('desde las 11:00 h')
    expect(doubles.sendMail).not.toHaveBeenCalled()
  })

  it('cambia la hora y el texto se escribió a mano: descartada', async () => {
    const { ids } = await programmed('s-hora-texto', 'Texto propio con las 10:00')
    await admin`update matches set kickoff_at = ${sat('11:00')} where id = ${ids.tercera}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('10:01'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect((await only()).last_error).toContain('el texto se había escrito a mano')
  })

  it('cambia el día: descartada', async () => {
    const { ids } = await programmed('s-dia')
    await admin`update matches set kickoff_at = ${santiagoWallTime(addDays(saturday, 1), '12:00')} where id = ${ids.juvenil}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('10:01'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect((await only()).last_error).toBe('Cambió el día de un partido de la jornada.')
  })

  it('una serie eliminada: descartada', async () => {
    const { ids } = await programmed('s-eliminada')
    await admin`delete from matches where id = ${ids.juvenil}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('10:01'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect((await only()).last_error).toBe('Se eliminó un partido de la jornada.')
  })

  it('una foto marcada con menores después de programar: sale con la de respaldo', async () => {
    const insert = async (key: string) => {
      const [row] = await admin<{ id: string }[]>`
        insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors)
        values ('imagen', ${`fb-prog-${key}`}, 'image/jpeg', 10, 'Foto de prueba', false)
        returning id`
      return row?.id ?? ''
    }
    const chosen = await insert('elegida')
    const fallback = await insert('respaldo')
    await setFacebook({ ...enabled, photos: [fallback, null, null] })
    const { key } = await jornada('s-foto')
    await actAs('admin')
    expect(
      await actions.programarJornadaEnFacebook(key, null, `${chosen},,`, {
        message: 'x',
        ...when(friday, '10:00'),
      }),
    ).toMatchObject({ ok: true })
    await admin`update media_assets set contains_minors = true, minors_consent_confirmed_at = now() where id = ${chosen}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('10:01'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    expect(await only()).toMatchObject({ status: 'publicado', photo_ids: [fallback, null, null] })
  })
})

describe('descartes a mano', () => {
  it('«Descartar» o «Cancelar» desde el panel no avisan por correo; solo los seguros', async () => {
    const { key } = await jornada('d-mano')
    await actAs('admin')
    await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') })
    const { id } = await only()
    // Una programada que falló al publicarse queda «Con error»; una persona la descarta.
    await admin`update social_publications set status = 'error', last_error = 'Facebook pidió esperar.',
      attempts = 1, next_attempt_at = ${fri('11:00')} where id = ${id}`
    expect(await actions.descartarPublicacion(id)).toEqual({ ok: true, data: { id } })
    const discarded = await only()
    expect(discarded.status).toBe('descartado')
    expect(discarded.discard_notified_at).not.toBeNull()
    const { channel } = fakeChannel()
    await runSocialPublishing(fri('11:05'), channel)
    await runSocialPublishing(fri('11:10'), channel)
    expect(doubles.sendMail).not.toHaveBeenCalled()
    // Tampoco aparece en el aviso del panel de «programadas que no saldrán».
    expect(await recentlyDiscardedScheduled()).toEqual([])

    // Cancelar borra la fila: tampoco hay nada que avisar.
    await admin`delete from social_publications`
    await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') })
    expect(await actions.cancelarProgramada((await only()).id)).toMatchObject({ ok: true })
    await runSocialPublishing(fri('09:00'), channel)
    expect(doubles.sendMail).not.toHaveBeenCalled()
  })
})

describe('con Facebook apagado', () => {
  it('se puede programar, no sale y al reactivarlo antes del partido sale', async () => {
    const { key } = await jornada('a-reactivar')
    await setFacebook({ ...enabled, enabled: false })
    await actAs('admin')
    expect(
      await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') }),
    ).toMatchObject({ ok: true })
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('10:01'), channel)
    await runSocialPublishing(fri('20:00'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect((await only()).status).toBe('programada')

    await setFacebook(enabled)
    await runSocialPublishing(sat('08:00'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)
    expect((await only()).status).toBe('publicado')
  })

  it('si sigue apagado al empezar el partido, se descarta y nunca sale tarde', async () => {
    const { key } = await jornada('a-tarde')
    await setFacebook({ ...enabled, enabled: false })
    await actAs('admin')
    await actions.programarJornadaEnFacebook(key, null, null, { message: 'x', ...when(friday, '10:00') })
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(sat('10:01'), channel)
    expect(await only()).toMatchObject({ status: 'descartado', last_error: STARTED_WHILE_DISABLED })
    expect(doubles.sendMail).toHaveBeenCalledTimes(1)

    await setFacebook(enabled)
    await runSocialPublishing(sat('10:06'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
  })
})

describe('programar la previa de un partido', () => {
  it('se programa, sale a su hora y el resultado no se programa', async () => {
    const id = await match('m-previa', f.seriesId, '15:30')
    await actAs('admin')
    expect(
      await actions.programarEnFacebook(id, null, { message: 'Previa', ...when(saturday, '09:00') }),
    ).toMatchObject({ ok: true })
    expect(await only()).toMatchObject({ kind: 'proximo', status: 'programada', message: 'Previa' })
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(sat('09:03'), channel)
    expect(publishPhoto).toHaveBeenCalledTimes(1)

    const finished = await createMatch(admin, f, 'm-resultado', 'finalizado')
    expect(
      await actions.programarEnFacebook(finished, null, { message: 'x', ...when(saturday, '09:00') }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('Solo se programa la previa') })
  })

  it('cambiar el rival la descarta', async () => {
    const id = await match('m-rival', f.seriesId, '15:30')
    await actAs('admin')
    await actions.programarEnFacebook(id, null, { message: 'Previa', ...when(saturday, '09:00') })
    const [other] = await admin<{ id: string }[]>`
      insert into teams (name, short_name, slug) values ('Otro rival', 'Otro', 'prog-otro-rival') returning id`
    await admin`update matches set away_team_id = ${other?.id ?? ''} where id = ${id}`
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(sat('09:03'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect((await only()).last_error).toBe('Cambió el rival del partido.')
    await admin`delete from matches`
    await admin`delete from teams where slug = 'prog-otro-rival'`
  })
})

describe('programación semanal', () => {
  it('viene apagada: con Facebook activo no sale la grilla del fin de semana', async () => {
    await jornada('w-apagada')
    const { channel, publishPhoto } = fakeChannel()
    await runSocialPublishing(fri('12:02'), channel)
    expect(publishPhoto).not.toHaveBeenCalled()
    expect(await rows()).toEqual([])
  })
})
