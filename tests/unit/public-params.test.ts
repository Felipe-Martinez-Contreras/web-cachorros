import { describe, expect, it } from 'vitest'
import { resolveSportsParams, sportsQuery } from '@/features/matches/lib/public-params'

const nav = {
  series: [
    { id: 's1', slug: 'honor', name: 'Honor' },
    { id: 's2', slug: 'senior-35', name: 'Senior 35' },
  ],
  seasons: [
    { id: 't2', name: 'Temporada 2026', year: 2026, isCurrent: true },
    { id: 't1', name: 'Temporada 2025', year: 2025, isCurrent: false },
  ],
  featuredSeriesSlug: 'senior-35',
}

describe('resolveSportsParams', () => {
  it('sin parámetros usa la serie destacada y la temporada actual', () => {
    const { series, season } = resolveSportsParams(nav, {})
    expect(series?.slug).toBe('senior-35')
    expect(season?.year).toBe(2026)
  })

  it('respeta la serie y la temporada de la URL', () => {
    const { series, season } = resolveSportsParams(nav, { serie: 'honor', temporada: '2025' })
    expect(series?.id).toBe('s1')
    expect(season?.id).toBe('t1')
  })

  it('ante valores que no existen o repetidos vuelve a los valores por defecto', () => {
    const { series, season } = resolveSportsParams(nav, { serie: 'no-existe', temporada: 'abc' })
    expect(series?.slug).toBe('senior-35')
    expect(season?.year).toBe(2026)
    expect(resolveSportsParams(nav, { serie: ['honor', 'otra'], temporada: ['2025'] })).toMatchObject({
      series: { slug: 'honor' },
      season: { year: 2025 },
    })
  })

  it('sin serie destacada ni temporada actual toma las primeras; sin datos devuelve null', () => {
    const plain = {
      series: nav.series,
      seasons: nav.seasons.map((season) => ({ ...season, isCurrent: false })),
      featuredSeriesSlug: null,
    }
    expect(resolveSportsParams(plain, {})).toMatchObject({
      series: { slug: 'honor' },
      season: { year: 2026 },
    })
    expect(resolveSportsParams({ series: [], seasons: [], featuredSeriesSlug: null }, {})).toEqual({
      series: null,
      season: null,
    })
  })
})

describe('sportsQuery', () => {
  it('omite la temporada actual y conserva las anteriores', () => {
    expect(sportsQuery('honor', nav.seasons[0] ?? null)).toBe('?serie=honor')
    expect(sportsQuery('honor', nav.seasons[1] ?? null)).toBe('?serie=honor&temporada=2025')
    expect(sportsQuery(null, nav.seasons[1] ?? null)).toBe('?temporada=2025')
    expect(sportsQuery(null, nav.seasons[0] ?? null)).toBe('')
    expect(sportsQuery(null, null)).toBe('')
  })
})
