import { describe, expect, it } from 'vitest'
import { paginationRange } from '@/components/ui/pagination'
import { hasScore, type MatchDTO, scoreText } from '@/features/matches/dto'
import { cn } from '@/lib/cn'
import { directionsUrls, safeExternalUrl, whatsappUrl } from '@/lib/links'

describe('paginación', () => {
  it('muestra la primera, la última y las vecinas de la actual, con saltos', () => {
    expect(paginationRange(1, 1)).toEqual([1])
    expect(paginationRange(1, 3)).toEqual([1, 2, 3])
    expect(paginationRange(4, 12)).toEqual([1, null, 3, 4, 5, null, 12])
    expect(paginationRange(1, 12)).toEqual([1, 2, null, 12])
    expect(paginationRange(12, 12)).toEqual([1, null, 11, 12])
  })
})

describe('enlaces', () => {
  it('arma el enlace de WhatsApp con el número sin + ni espacios y el mensaje codificado', () => {
    expect(whatsappUrl('+56 9 1234 5678')).toBe('https://wa.me/56912345678')
    expect(whatsappUrl('+56912345678', '¡Hola! Quiero un pedido: 2 × $18.000 & envío')).toBe(
      'https://wa.me/56912345678?text=%C2%A1Hola!%20Quiero%20un%20pedido%3A%202%20%C3%97%20%2418.000%20%26%20env%C3%ADo',
    )
  })

  it('arma los enlaces de navegación a una ubicación', () => {
    expect(directionsUrls(-35, -71.38)).toEqual({
      google: 'https://www.google.com/maps/dir/?api=1&destination=-35,-71.38',
      waze: 'https://waze.com/ul?ll=-35,-71.38&navigate=yes',
      apple: 'https://maps.apple.com/?daddr=-35,-71.38',
    })
  })

  it('solo enlaza a direcciones web reales, nunca a marcadores ni a otros esquemas', () => {
    expect(safeExternalUrl('https://instagram.com/p/abc')).toBe('https://instagram.com/p/abc')
    expect(safeExternalUrl('[COMPLETAR: URL de la publicación]')).toBeNull()
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
  })
})

describe('utilidades de interfaz', () => {
  it('cn resuelve conflictos de clases de Tailwind', () => {
    expect(cn('px-2 py-1', false, 'px-4')).toBe('py-1 px-4')
  })

  it('describe el marcador para lectores de pantalla', () => {
    const team = (shortName: string) => ({ name: shortName, shortName, crest: null, isOwnClub: false })
    const match = {
      home: team('Cachorros'),
      away: team('Los Litres'),
      homeScore: 1,
      awayScore: 0,
    } as MatchDTO
    expect(scoreText(match)).toBe('Cachorros 1, Los Litres 0')
    expect(hasScore({ ...match, status: 'en_vivo' })).toBe(true)
    expect(hasScore({ ...match, status: 'finalizado' })).toBe(true)
    expect(hasScore({ ...match, status: 'programado' })).toBe(false)
  })
})
