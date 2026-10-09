import { describe, expect, it } from 'vitest'
import { formatCoordinates, parseCoordinates } from '@/features/teams/lib/parse-coordinates'

describe('parseCoordinates', () => {
  it('lee el par «latitud, longitud» con punto o con coma decimal', () => {
    expect(parseCoordinates('-35.0123, -71.4567')).toEqual({ lat: -35.0123, lng: -71.4567 })
    expect(parseCoordinates('  -35.0123,-71.4567 ')).toEqual({ lat: -35.0123, lng: -71.4567 })
    expect(parseCoordinates('-35,0123; -71,4567')).toEqual({ lat: -35.0123, lng: -71.4567 })
    expect(parseCoordinates('−35.0123, −71.4567')).toEqual({ lat: -35.0123, lng: -71.4567 })
  })

  it('prefiere el marcador del lugar sobre el centro del mapa en un enlace de Google Maps', () => {
    const url =
      'https://www.google.com/maps/place/Estadio/@-35.0100,-71.4000,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-35.0123!4d-71.4567'
    expect(parseCoordinates(url)).toEqual({ lat: -35.0123, lng: -71.4567 })
  })

  it('lee enlaces con @, con ?q= codificado, de «cómo llegar», de Waze y de OpenStreetMap', () => {
    expect(parseCoordinates('https://www.google.com/maps/@-35.0123,-71.4567,17z')).toEqual({
      lat: -35.0123,
      lng: -71.4567,
    })
    expect(parseCoordinates('https://maps.google.com/?q=-35.0123%2C-71.4567')).toEqual({
      lat: -35.0123,
      lng: -71.4567,
    })
    expect(parseCoordinates('https://www.google.com/maps/dir/?api=1&destination=-35.0123,-71.4567')).toEqual({
      lat: -35.0123,
      lng: -71.4567,
    })
    expect(parseCoordinates('https://waze.com/ul?ll=-35.0123,-71.4567&navigate=yes')).toEqual({
      lat: -35.0123,
      lng: -71.4567,
    })
    expect(parseCoordinates('https://www.openstreetmap.org/?mlat=-35.0123&mlon=-71.4567')).toBeNull()
  })

  it('devuelve null si no hay coordenadas o están fuera de rango', () => {
    expect(parseCoordinates('')).toBeNull()
    expect(parseCoordinates('Calle Los Aromos 123')).toBeNull()
    expect(parseCoordinates('https://maps.app.goo.gl/AbCdEf123')).toBeNull()
    expect(parseCoordinates('-95.0, -71.0')).toBeNull()
    expect(parseCoordinates('-35.0, -190.0')).toBeNull()
    expect(parseCoordinates('100% seguro')).toBeNull()
  })
})

describe('formatCoordinates', () => {
  it('vuelve a mostrar lo guardado y deja vacío lo que falta', () => {
    expect(formatCoordinates(-35.0123, -71.4567)).toBe('-35.0123, -71.4567')
    expect(formatCoordinates(null, -71.4567)).toBe('')
    expect(parseCoordinates(formatCoordinates(-35.0123, -71.4567))).toEqual({ lat: -35.0123, lng: -71.4567 })
  })
})
