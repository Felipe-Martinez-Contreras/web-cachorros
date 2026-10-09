import { describe, expect, it } from 'vitest'
import { newsListHref, resolveNewsParams } from '@/features/news/lib/public-params'

const filters = {
  categories: [
    { slug: 'primer-equipo', name: 'Primer equipo' },
    { slug: 'formativas', name: 'Formativas' },
  ],
  series: [{ slug: 'honor', name: 'Honor' }],
}

describe('resolveNewsParams', () => {
  it('sin parámetros no filtra y muestra la primera página', () => {
    expect(resolveNewsParams(filters, {})).toEqual({ category: null, series: null, page: 1 })
  })

  it('combina categoría, serie y página', () => {
    expect(resolveNewsParams(filters, { categoria: 'formativas', serie: 'honor', pagina: '3' })).toEqual({
      category: filters.categories[1],
      series: filters.series[0],
      page: 3,
    })
  })

  it('ignora valores que no existen y páginas que no son un entero positivo', () => {
    for (const pagina of ['0', '-2', '1.5', 'abc', '', '99999999']) {
      expect(resolveNewsParams(filters, { categoria: 'no-existe', serie: 'otra', pagina })).toEqual({
        category: null,
        series: null,
        page: 1,
      })
    }
  })

  it('con un parámetro repetido usa el primero', () => {
    expect(
      resolveNewsParams(filters, { categoria: ['formativas', 'primer-equipo'], pagina: ['2', '9'] }),
    ).toEqual({ category: filters.categories[1], series: null, page: 2 })
  })
})

describe('newsListHref', () => {
  it('conserva los filtros y omite la página 1', () => {
    expect(newsListHref({})).toBe('/noticias')
    expect(newsListHref({ category: 'formativas' })).toBe('/noticias?categoria=formativas')
    expect(newsListHref({ category: 'formativas', series: 'honor' }, 2)).toBe(
      '/noticias?categoria=formativas&serie=honor&pagina=2',
    )
    expect(newsListHref({ series: null }, 4)).toBe('/noticias?pagina=4')
  })
})
