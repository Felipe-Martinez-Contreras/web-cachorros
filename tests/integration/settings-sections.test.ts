import { desc, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { db, sql } = await import('@/db/client')
const { auditLog, siteSettings } = await import('@/db/schema')
const { guardarConfiguracion } = await import('@/features/settings/actions')
const { getSettingsAdmin } = await import('@/features/settings/admin-queries')
const { getSite } = await import('@/features/settings/queries')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
type Row = typeof siteSettings.$inferSelect
let original: Row | undefined

const read = async () => {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1))
  if (!row) throw new Error('Falta la fila de configuración.')
  return row
}

async function saved(section: string, input: unknown) {
  const result = await guardarConfiguracion(section, input)
  expect(result, result.ok ? '' : result.message).toEqual({ ok: true, data: { id: '1' } })
}

beforeAll(async () => {
  await ensureTestUsers()
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1))
  original = row
  if (!row) {
    await db
      .insert(siteSettings)
      .values({ id: 1, clubName: 'Club de prueba', shortName: 'Prueba', foundedOn: '1934-04-01' })
  }
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  // La configuración vuelve a como estaba: otras pruebas leen esta fila.
  if (original) {
    const { id: _id, createdAt: _createdAt, ...values } = original
    await db.update(siteSettings).set(values).where(eq(siteSettings.id, 1))
  }
  await admin`delete from media_assets where storage_key like 'config-test-%'`
  await admin.end()
  await sql.end()
})

describe('guardarConfiguracion por sección', () => {
  it('rechaza sin permiso y las secciones que no existen', async () => {
    const before = await read()
    await actAs('prensa')
    expect(await guardarConfiguracion('contacto', {})).toEqual({
      ok: false,
      message: 'No tienes permiso para hacer esto.',
    })
    await actAs('admin')
    expect(await guardarConfiguracion('hasOwnProperty', {})).toEqual({
      ok: false,
      message: 'Esa sección de Configuración no existe.',
    })
    expect(await read()).toEqual(before)
    expect(invalidatedTags()).toEqual([])
  })

  it('contacto: guarda en E.164, llega al sitio y no deja datos de contacto en la auditoría', async () => {
    await saved('contacto', {
      whatsapp: '9 8765 4321',
      phone: '',
      publicEmail: 'Hola@Club.cl',
      notifySocios: 'socios@club.cl, tesorero@club.cl',
      notifyAuspicios: '',
      notifyContacto: 'contacto@club.cl',
    })
    expect(await read()).toMatchObject({
      whatsappE164: '+56987654321',
      phoneE164: null,
      publicEmail: 'hola@club.cl',
      notifyRecipients: {
        socios: ['socios@club.cl', 'tesorero@club.cl'],
        auspicios: [],
        contacto: ['contacto@club.cl'],
      },
    })
    expect(invalidatedTags()).toEqual(['settings'])
    // El DTO público lleva el WhatsApp y el correo, nunca los destinatarios de los avisos.
    const site = await getSite()
    expect(site).toMatchObject({ whatsapp: '+56987654321', email: 'hola@club.cl' })
    expect(JSON.stringify(site)).not.toContain('tesorero@club.cl')

    const [entry] = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(1)
    expect(entry).toMatchObject({ action: 'settings.contacto.update', meta: { section: 'contacto' } })
    expect(JSON.stringify(entry)).not.toMatch(/club\.cl|98765/)

    expect((await getSettingsAdmin())?.forms.contacto).toMatchObject({
      whatsapp: '+56987654321',
      notifySocios: 'socios@club.cl, tesorero@club.cl',
    })
  })

  it('redes: guarda solo las que tienen dirección', async () => {
    await saved('redes', {
      instagram: 'https://www.instagram.com/club',
      facebook: '',
      tiktok: '',
      youtube: 'https://www.youtube.com/@club',
      x: '',
    })
    expect((await read()).socialLinks).toEqual({
      instagram: 'https://www.instagram.com/club',
      youtube: 'https://www.youtube.com/@club',
    })
    expect((await getSite())?.socialLinks.map((link) => link.platform)).toEqual(['instagram', 'youtube'])
  })

  it('ubicación: saca las coordenadas del enlace del mapa y las borra si se quita', async () => {
    const base = { address: 'Camino de prueba s/n', commune: 'Sagrada Familia', region: 'Maule' }
    await saved('ubicacion', { ...base, location: 'https://www.google.com/maps/@-35.0123,-71.4567,17z' })
    expect(await read()).toMatchObject({
      address: 'Camino de prueba s/n',
      geoLat: -35.0123,
      geoLng: -71.4567,
    })
    expect((await getSettingsAdmin())?.forms.ubicacion.location).toBe('-35.0123, -71.4567')
    await saved('ubicacion', { ...base, location: '' })
    expect(await read()).toMatchObject({ geoLat: null, geoLng: null })
  })

  it('aportes: la cuenta completa se guarda con el RUT con formato; vacía queda en null', async () => {
    const account = {
      holder: 'Club de prueba',
      rut: '111111111',
      bank: 'Banco de prueba',
      accountType: 'Cuenta vista',
      accountNumber: '123456',
      email: '',
      donationUrl: 'https://pagos.ejemplo.test/club',
    }
    await saved('aportes', account)
    expect(await read()).toMatchObject({
      donationUrl: 'https://pagos.ejemplo.test/club',
      bankDetails: {
        holder: 'Club de prueba',
        rut: '11.111.111-1',
        bank: 'Banco de prueba',
        accountType: 'Cuenta vista',
        accountNumber: '123456',
      },
    })
    expect(await guardarConfiguracion('aportes', { ...account, rut: '11.111.111-2' })).toMatchObject({
      ok: false,
      fieldErrors: { rut: ['Ese RUT no es válido. Revisa el dígito verificador.'] },
    })
    // Los datos bancarios nunca viajan en el DTO público del layout.
    expect(JSON.stringify(await getSite())).not.toContain('123456')

    await saved('aportes', {
      holder: '',
      rut: '',
      bank: '',
      accountType: '',
      accountNumber: '',
      email: '',
      donationUrl: '',
    })
    expect(await read()).toMatchObject({ bankDetails: null, donationUrl: null })
  })

  it('portada y buscadores: guardan sus textos y no aceptan fotos marcadas con menores', async () => {
    const [minors] = await admin<{ id: string }[]>`
      insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors)
      values ('imagen', 'config-test-menores', 'image/jpeg', 10, 'Foto de prueba', true) returning id`
    const hero = { title: 'Los Cachorros', subtitle: '', ctaLabel: 'Partidos', ctaHref: '/partidos' }
    expect(
      await guardarConfiguracion('portada', { ...hero, mediaId: minors?.id, mobileMediaId: '' }),
    ).toMatchObject({ ok: false, fieldErrors: { mediaId: [expect.stringContaining('menores de edad')] } })
    await saved('portada', { ...hero, mediaId: '', mobileMediaId: '' })
    expect((await read()).hero).toEqual({
      title: 'Los Cachorros',
      ctaLabel: 'Partidos',
      ctaHref: '/partidos',
    })

    expect(await guardarConfiguracion('seo', { description: 'x', ogMediaId: minors?.id })).toMatchObject({
      ok: false,
      fieldErrors: { ogMediaId: [expect.stringContaining('menores de edad')] },
    })
    await saved('seo', { description: 'Sitio de prueba del club.', ogMediaId: '' })
    expect((await read()).seoDefaults).toEqual({ description: 'Sitio de prueba del club.' })
    expect((await getSite())?.seoDescription).toBe('Sitio de prueba del club.')
  })

  it('destacados: una serie que no existe se rechaza con un mensaje claro; vaciar invalida también partidos', async () => {
    expect(
      await guardarConfiguracion('destacados', {
        featuredSeriesId: '0199c2f0-0000-7000-8000-00000000dead',
        shareCardSponsorId: '',
      }),
    ).toEqual({
      ok: false,
      message: 'Uno de los datos elegidos ya no existe. Recarga la página y vuelve a intentarlo.',
    })
    await saved('destacados', { featuredSeriesId: '', shareCardSponsorId: '' })
    expect(await read()).toMatchObject({ featuredSeriesId: null, shareCardSponsorId: null })
    expect(invalidatedTags().slice(-2)).toEqual(['settings', 'matches'])
  })
})
