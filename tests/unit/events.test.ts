import { describe, expect, it } from 'vitest'
import { eventCta, eventMapUrl, eventsListHref, parsePage } from '@/features/events/lib/public'
import { eventSchema } from '@/features/events/schemas'
import { eventJsonLd } from '@/features/seo/lib/json-ld'

const base = {
  title: 'Bingo familiar',
  type: 'bingo',
  startDate: '2026-11-14',
  startTime: '16:00',
  endDate: '',
  endTime: '',
  locationText: '',
  venueId: '',
  posterMediaId: '',
  description: null,
  priceText: '',
  ctaUrl: '',
  status: 'programado',
  isPublished: true,
}

describe('esquema de eventos', () => {
  it('sin término, deja las fechas de término en null', () => {
    expect(eventSchema.parse(base)).toMatchObject({ endDate: null, endTime: null, ctaUrl: null })
  })

  it('el término no puede ser anterior al inicio, el mismo día u otro', () => {
    const sameDay = eventSchema.safeParse({ ...base, endTime: '15:00' })
    expect(sameDay.error?.issues[0]).toMatchObject({
      path: ['endTime'],
      message: 'El término no puede ser anterior al inicio.',
    })
    const otherDay = eventSchema.safeParse({ ...base, endDate: '2026-11-13', endTime: '20:00' })
    expect(otherDay.error?.issues[0]?.path).toEqual(['endDate'])
    expect(eventSchema.safeParse({ ...base, endDate: '2026-11-15', endTime: '10:00' }).success).toBe(true)
  })

  it('un día de término pide también la hora', () => {
    const result = eventSchema.safeParse({ ...base, endDate: '2026-11-15' })
    expect(result.error?.issues[0]?.path).toEqual(['endTime'])
  })
})

describe('botón de acción del evento', () => {
  it('usa el enlace propio si es una dirección real', () => {
    expect(eventCta({ title: 'Rifa', ctaUrl: 'https://rifa.example/compra' }, '+56912345678')).toEqual({
      href: 'https://rifa.example/compra',
      label: 'Más información',
      external: true,
    })
  })

  it('si no, WhatsApp del club con el nombre del evento; sin WhatsApp, nada', () => {
    const cta = eventCta({ title: 'Bingo & completada', ctaUrl: '[COMPLETAR: enlace]' }, '+56912345678')
    expect(cta?.label).toBe('Consultar por WhatsApp')
    expect(new URL(cta?.href ?? '').searchParams.get('text')).toBe(
      '¡Hola! Quiero información sobre «Bingo & completada».',
    )
    expect(eventCta({ title: 'Bingo', ctaUrl: null }, null)).toBeNull()
  })
})

describe('mapa del lugar', () => {
  it('con coordenadas de la cancha, las usa; si no, busca el texto; un marcador no es un lugar', () => {
    expect(eventMapUrl({ locationText: 'Cancha', geoLat: -34.99, geoLng: -71.38 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=-34.99,-71.38',
    )
    expect(eventMapUrl({ locationText: 'Sede social, Sagrada Familia', geoLat: null, geoLng: null })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Sede%20social%2C%20Sagrada%20Familia',
    )
    expect(eventMapUrl({ locationText: '[COMPLETAR: lugar]', geoLat: null, geoLng: null })).toBeNull()
    expect(eventMapUrl({ locationText: null, geoLat: null, geoLng: null })).toBeNull()
  })
})

describe('paginación de eventos pasados', () => {
  it('la página es un entero desde 1', () => {
    expect(parsePage('3')).toBe(3)
    for (const value of [undefined, '', '0', '-2', '1.5', 'dos']) expect(parsePage(value)).toBe(1)
    expect(parsePage(['2', '5'])).toBe(2)
    expect(eventsListHref(1)).toBe('/eventos')
    expect(eventsListHref(2)).toBe('/eventos?pagina=2')
  })
})

describe('JSON-LD Event', () => {
  const event = {
    slug: 'bingo',
    title: 'Bingo',
    status: 'programado' as const,
    startsAt: '2026-11-14T19:00:00.000Z',
    endsAt: null,
    description: null,
    image: '/media/afiche.webp',
    locationText: '[COMPLETAR: lugar del bingo]',
    venue: null,
    priceText: null,
  }

  it('no publica marcadores y usa direcciones absolutas', () => {
    const data = eventJsonLd(event, { clubName: 'Club' }, 'https://club.example')
    expect(data).toMatchObject({
      '@type': 'Event',
      url: 'https://club.example/eventos/bingo',
      image: 'https://club.example/media/afiche.webp',
      eventStatus: 'https://schema.org/EventScheduled',
    })
    expect(data).not.toHaveProperty('location')
    expect(data).not.toHaveProperty('endDate')
  })

  it('un evento cancelado lo dice', () => {
    expect(
      eventJsonLd({ ...event, status: 'cancelado' }, { clubName: 'Club' }, 'https://club.example')
        .eventStatus,
    ).toBe('https://schema.org/EventCancelled')
  })
})
