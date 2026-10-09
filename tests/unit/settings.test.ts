import { describe, expect, it } from 'vitest'
import { groupHomeMatches, homeMatchWindow } from '@/features/matches/lib/home-window'
import {
  contactSettingsSchema,
  heroSettingsSchema,
  locationSettingsSchema,
  socialSettingsSchema,
  supportSettingsSchema,
} from '@/features/settings/schemas'
import { isSettingsSection, SETTINGS_SECTION_KEYS } from '@/features/settings/sections'
import { isContentMarker } from '@/lib/markers'
import { toE164 } from '@/lib/phone'

describe('toE164', () => {
  it('acepta lo que escribe una persona y lo deja en E.164', () => {
    expect(toE164('+56 9 1234 5678')).toBe('+56912345678')
    expect(toE164('9 1234 5678')).toBe('+56912345678')
    expect(toE164('(56) 9-1234-5678')).toBe('+56912345678')
    expect(toE164('75 2 123456')).toBe('+56752123456')
    expect(toE164('+1 (212) 555-0100')).toBe('+12125550100')
  })

  it('rechaza lo que no es un teléfono', () => {
    for (const value of [
      '',
      '12345',
      'llámame',
      '+56 9 1234',
      '9 1234 5678 ext 2',
      '+0123456789',
      '00 56 9',
    ]) {
      expect(toE164(value)).toBeNull()
    }
  })
})

describe('isContentMarker', () => {
  it('reconoce los tres marcadores de contenido pendiente', () => {
    expect(isContentMarker('[COMPLETAR: RUT del club]')).toBe(true)
    expect(isContentMarker(' [DECIDIR: algo. Default: sí] ')).toBe(true)
    expect(isContentMarker('[VERIFICAR: norma]')).toBe(true)
    expect(isContentMarker('Dato real [COMPLETAR: resto]')).toBe(false)
    expect(isContentMarker('[OTRO: x]')).toBe(false)
    expect(isContentMarker(null)).toBe(false)
  })
})

describe('esquemas de Configuración', () => {
  it('contacto: normaliza teléfonos y separa las listas de correos', () => {
    const parsed = contactSettingsSchema.parse({
      whatsapp: '9 8765 4321',
      phone: '',
      publicEmail: 'Contacto@Club.CL',
      notifySocios: 'a@club.cl, B@club.cl\n a@club.cl',
      notifyAuspicios: '',
      notifyContacto: 'c@club.cl;d@club.cl',
    })
    expect(parsed).toEqual({
      whatsapp: '+56987654321',
      phone: null,
      publicEmail: 'contacto@club.cl',
      notifySocios: ['a@club.cl', 'b@club.cl'],
      notifyAuspicios: [],
      notifyContacto: ['c@club.cl', 'd@club.cl'],
    })
  })

  it('contacto: explica el teléfono o el correo que está mal', () => {
    const result = contactSettingsSchema.safeParse({
      whatsapp: '12345',
      phone: '',
      publicEmail: 'no-es-correo',
      notifySocios: 'bien@club.cl, mal@',
      notifyAuspicios: 'a@a.cl b@a.cl c@a.cl d@a.cl e@a.cl f@a.cl',
      notifyContacto: '',
    })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
    )
    expect(messages).toEqual({
      whatsapp: 'Escribe el teléfono con su código: +56 9 1234 5678.',
      publicEmail: 'Escribe un correo válido.',
      notifySocios: '«mal@» no es un correo válido.',
      notifyAuspicios: 'Usa como máximo 5 correos.',
    })
  })

  it('redes: solo direcciones https', () => {
    const empty = { instagram: '', facebook: '', tiktok: '', youtube: '', x: '' }
    expect(
      socialSettingsSchema.parse({ ...empty, instagram: 'https://www.instagram.com/club' }),
    ).toMatchObject({
      instagram: 'https://www.instagram.com/club',
      facebook: null,
    })
    for (const value of ['instagram.com/club', 'http://instagram.com/club', 'javascript:alert(1)']) {
      expect(socialSettingsSchema.safeParse({ ...empty, instagram: value }).success).toBe(false)
    }
  })

  it('ubicación: acepta coordenadas o un enlace de mapa, no un enlace corto', () => {
    const base = { address: '', commune: '', region: '' }
    expect(locationSettingsSchema.safeParse({ ...base, location: '-35.01, -71.45' }).success).toBe(true)
    expect(locationSettingsSchema.safeParse({ ...base, location: '' }).success).toBe(true)
    expect(
      locationSettingsSchema.safeParse({ ...base, location: 'https://maps.app.goo.gl/abc' }).success,
    ).toBe(false)
  })

  it('aportes: la cuenta va completa o vacía, con RUT válido; los marcadores pendientes se conservan', () => {
    const empty = {
      holder: '',
      rut: '',
      bank: '',
      accountType: '',
      accountNumber: '',
      email: '',
      donationUrl: '',
    }
    expect(supportSettingsSchema.parse(empty)).toMatchObject({ holder: null, rut: null })

    const partial = supportSettingsSchema.safeParse({ ...empty, holder: 'Club', rut: '11.111.111-1' })
    expect(partial.error?.issues.map((issue) => issue.path[0])).toEqual([
      'bank',
      'accountType',
      'accountNumber',
    ])

    const full = { ...empty, holder: 'Club', bank: 'Banco', accountType: 'Vista', accountNumber: '123' }
    expect(supportSettingsSchema.parse({ ...full, rut: '111111111' }).rut).toBe('11.111.111-1')
    expect(supportSettingsSchema.safeParse({ ...full, rut: '11.111.111-2' }).error?.issues[0]?.message).toBe(
      'Ese RUT no es válido. Revisa el dígito verificador.',
    )
    expect(supportSettingsSchema.parse({ ...full, rut: '[COMPLETAR: RUT del club]' }).rut).toBe(
      '[COMPLETAR: RUT del club]',
    )
  })

  it('portada: el botón necesita texto y destino, y el destino debe ser seguro', () => {
    const base = { title: '', subtitle: '', ctaLabel: '', ctaHref: '', mediaId: '', mobileMediaId: '' }
    expect(heroSettingsSchema.safeParse(base).success).toBe(true)
    expect(
      heroSettingsSchema.safeParse({ ...base, ctaLabel: 'Hazte socio', ctaHref: '/socios' }).success,
    ).toBe(true)
    expect(heroSettingsSchema.safeParse({ ...base, ctaLabel: 'Hazte socio' }).error?.issues[0]?.path).toEqual(
      ['ctaHref'],
    )
    for (const ctaHref of ['//evil.test', 'javascript:alert(1)', 'http://sin-https.test', 'socios']) {
      expect(heroSettingsSchema.safeParse({ ...base, ctaLabel: 'Ir', ctaHref }).success).toBe(false)
    }
  })

  it('solo existen las secciones registradas', () => {
    expect(SETTINGS_SECTION_KEYS).toHaveLength(8)
    expect(isSettingsSection('aportes')).toBe(true)
    expect(isSettingsSection('toString')).toBe(false)
  })
})

describe('partidos de Inicio del panel', () => {
  // Miércoles 7 de octubre de 2026, 15:00 en Santiago (UTC-3).
  const now = new Date('2026-10-07T18:00:00Z')

  it('la ventana va desde hace una semana hasta el final del domingo', () => {
    const window = homeMatchWindow(now)
    expect(window.from.toISOString()).toBe('2026-09-30T03:00:00.000Z')
    expect(window.today.toISOString()).toBe('2026-10-07T03:00:00.000Z')
    expect(window.tomorrow.toISOString()).toBe('2026-10-08T03:00:00.000Z')
    expect(window.to.toISOString()).toBe('2026-10-12T03:00:00.000Z')
    // Un domingo, la ventana termina esa misma noche.
    expect(homeMatchWindow(new Date('2026-10-11T18:00:00Z')).to.toISOString()).toBe(
      '2026-10-12T03:00:00.000Z',
    )
  })

  it('separa lo que falta cargar, lo de hoy y lo que viene', () => {
    const match = (id: string, kickoffAt: string, status = 'programado') => ({
      id,
      kickoffAt: new Date(kickoffAt),
      status,
    })
    const groups = groupHomeMatches(
      [
        match('sin-resultado', '2026-10-04T19:00:00Z'),
        match('ya-cargado', '2026-10-04T21:00:00Z', 'finalizado'),
        match('cancelado', '2026-10-03T19:00:00Z', 'cancelado'),
        match('hoy-temprano', '2026-10-07T14:00:00Z', 'finalizado'),
        match('hoy-tarde', '2026-10-07T23:00:00Z'),
        match('sabado', '2026-10-10T19:00:00Z'),
      ],
      now,
    )
    expect(groups.pending.map((item) => item.id)).toEqual(['sin-resultado'])
    expect(groups.today.map((item) => item.id)).toEqual(['hoy-temprano', 'hoy-tarde'])
    expect(groups.upcoming.map((item) => item.id)).toEqual(['sabado'])
  })
})
