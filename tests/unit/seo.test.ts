import { describe, expect, it } from 'vitest'
import {
  absoluteUrl,
  breadcrumbJsonLd,
  newsArticleJsonLd,
  serializeJsonLd,
  sportsEventJsonLd,
  sportsTeamJsonLd,
  webSiteJsonLd,
} from '@/features/seo/lib/json-ld'
import { ogImageOf } from '@/features/seo/lib/og-image'

const BASE = 'https://club.ejemplo.test'

const site = {
  clubName: 'Club Deportivo Los Cachorros',
  shortName: 'Cachorros',
  foundedOn: '1934-04-01',
  commune: 'Sagrada Familia',
  region: 'Región del Maule',
  logo: '/media/escudo/w512.webp',
  sameAs: ['https://www.instagram.com/club'],
  description: 'Sitio del club.',
}

describe('absoluteUrl', () => {
  it('une la URL del sitio con una ruta, sin barras dobles', () => {
    expect(absoluteUrl(BASE, '/noticias')).toBe(`${BASE}/noticias`)
    expect(absoluteUrl(`${BASE}/`, 'noticias')).toBe(`${BASE}/noticias`)
    expect(absoluteUrl(BASE, 'https://otro.test/a')).toBe('https://otro.test/a')
  })
})

describe('sportsTeamJsonLd', () => {
  it('describe al club con su fundación, ubicación, escudo y redes', () => {
    expect(sportsTeamJsonLd(site, BASE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      '@id': `${BASE}/#club`,
      name: 'Club Deportivo Los Cachorros',
      alternateName: 'Cachorros',
      sport: 'Fútbol',
      url: `${BASE}/`,
      foundingDate: '1934-04-01',
      description: 'Sitio del club.',
      logo: `${BASE}/media/escudo/w512.webp`,
      location: {
        '@type': 'Place',
        name: 'Sagrada Familia',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Sagrada Familia',
          addressRegion: 'Región del Maule',
          addressCountry: 'CL',
        },
      },
      sameAs: ['https://www.instagram.com/club'],
    })
  })

  it('no publica lo que falta ni los marcadores de contenido pendiente', () => {
    const data = sportsTeamJsonLd(
      { ...site, commune: '[COMPLETAR: comuna]', logo: null, sameAs: [], description: null },
      BASE,
    )
    expect(Object.keys(data)).not.toEqual(
      expect.arrayContaining(['location', 'logo', 'sameAs', 'description']),
    )
    expect(JSON.stringify(data)).not.toContain('COMPLETAR')
  })
})

describe('webSiteJsonLd y breadcrumbJsonLd', () => {
  it('describen el sitio y las migas con direcciones absolutas', () => {
    expect(webSiteJsonLd(site, BASE)).toMatchObject({
      '@type': 'WebSite',
      url: `${BASE}/`,
      inLanguage: 'es-CL',
    })
    expect(
      breadcrumbJsonLd(
        [{ href: '/', label: 'Inicio' }, { href: '/noticias', label: 'Noticias' }, { label: 'Título' }],
        BASE,
      ),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${BASE}/noticias` },
        { '@type': 'ListItem', position: 3, name: 'Título' },
      ],
    })
  })
})

describe('newsArticleJsonLd', () => {
  const news = {
    slug: 'cronica-honor',
    title: 'Honor se impuso 2-1',
    excerpt: 'Resumen.',
    publishedAt: '2026-10-04T23:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    image: '/media/noticia/w1440.webp',
    categoryName: 'Primer equipo',
  }

  it('lleva titular, fechas, imagen absoluta y al club como editor', () => {
    expect(newsArticleJsonLd(news, site, BASE)).toMatchObject({
      '@type': 'NewsArticle',
      headline: 'Honor se impuso 2-1',
      url: `${BASE}/noticias/cronica-honor`,
      mainEntityOfPage: `${BASE}/noticias/cronica-honor`,
      datePublished: '2026-10-04T23:00:00.000Z',
      dateModified: '2026-10-05T10:00:00.000Z',
      image: [`${BASE}/media/noticia/w1440.webp`],
      articleSection: 'Primer equipo',
      publisher: { '@type': 'SportsTeam', name: 'Club Deportivo Los Cachorros' },
    })
  })

  it('la fecha de modificación nunca es anterior a la de publicación y el titular se acota', () => {
    const data = newsArticleJsonLd(
      { ...news, updatedAt: '2026-10-01T00:00:00.000Z', title: 'x'.repeat(200), image: null, excerpt: null },
      site,
      BASE,
    )
    expect(data.dateModified).toBe(news.publishedAt)
    expect(String(data.headline)).toHaveLength(110)
    expect(Object.keys(data)).not.toEqual(expect.arrayContaining(['image', 'description']))
  })
})

describe('sportsEventJsonLd', () => {
  const match = {
    slug: 'honor-fecha-8',
    status: 'programado' as const,
    kickoffAt: '2026-10-10T19:00:00.000Z',
    seriesName: 'Honor',
    competitionName: 'Campeonato Oficial',
    home: { name: 'Club Deportivo Los Cachorros' },
    away: { name: 'Deportivo Los Litres' },
    venue: { name: 'Cancha del club', address: '[COMPLETAR: dirección de la cancha]' },
  }

  it('incluye los equipos, la fecha con zona horaria y la cancha', () => {
    expect(sportsEventJsonLd(match, BASE)).toMatchObject({
      '@type': 'SportsEvent',
      name: 'Club Deportivo Los Cachorros vs Deportivo Los Litres · Honor',
      url: `${BASE}/partidos/honor-fecha-8`,
      startDate: '2026-10-10T19:00:00.000Z',
      eventStatus: 'https://schema.org/EventScheduled',
      homeTeam: { '@type': 'SportsTeam', name: 'Club Deportivo Los Cachorros' },
      awayTeam: { '@type': 'SportsTeam', name: 'Deportivo Los Litres' },
      // La dirección pendiente no se publica.
      location: { '@type': 'Place', name: 'Cancha del club' },
    })
  })

  it('traduce el estado del partido al de schema.org', () => {
    const status = (value: typeof match.status | 'postergado' | 'cancelado' | 'suspendido' | 'finalizado') =>
      sportsEventJsonLd({ ...match, status: value, venue: null }, BASE).eventStatus
    expect(status('postergado')).toBe('https://schema.org/EventPostponed')
    expect(status('suspendido')).toBe('https://schema.org/EventPostponed')
    expect(status('cancelado')).toBe('https://schema.org/EventCancelled')
    expect(status('finalizado')).toBe('https://schema.org/EventScheduled')
    expect(sportsEventJsonLd({ ...match, venue: null }, BASE)).not.toHaveProperty('location')
  })
})

describe('serializeJsonLd', () => {
  it('no deja cerrar la etiqueta script ni abrir entidades, y sigue siendo el mismo JSON', () => {
    const data = { name: 'Honor & Segunda </script><script>alert(1)</script>', note: 'a > b' }
    const text = serializeJsonLd(data)
    expect(text).not.toMatch(/[<>&]/)
    expect(text).toContain('\\u003c/script\\u003e')
    expect(JSON.parse(text)).toEqual(data)
  })
})

describe('ogImageOf', () => {
  const image = {
    src: '/media/foto/w1920.webp',
    srcSet:
      '/media/foto/w320.webp 320w, /media/foto/w768.webp 768w, /media/foto/w1440.webp 1440w, /media/foto/w1920.webp 1920w',
    width: 1920,
    height: 1280,
    alt: 'Foto del partido',
  }

  it('elige la variante más pequeña que alcanza 1200 px y calcula su alto', () => {
    expect(ogImageOf(image)).toEqual({
      url: '/media/foto/w1440.webp',
      width: 1440,
      height: 960,
      alt: 'Foto del partido',
    })
  })

  it('con una imagen pequeña usa la mayor variante; sin variantes, la imagen tal cual', () => {
    expect(
      ogImageOf({ ...image, srcSet: '/media/foto/w320.webp 320w, /media/foto/w768.webp 768w' })?.url,
    ).toBe('/media/foto/w768.webp')
    expect(ogImageOf({ ...image, srcSet: '' })).toEqual({
      url: '/media/foto/w1920.webp',
      width: 1920,
      height: 1280,
      alt: 'Foto del partido',
    })
    expect(ogImageOf(null)).toBeNull()
  })
})
