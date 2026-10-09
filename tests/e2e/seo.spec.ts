import { type APIRequestContext, expect, test } from '@playwright/test'
import { adminSql } from './db'
import { SECOND_SITE } from './second-site'

// La misma build corre dos veces (ver playwright.config.ts): el sitio de pruebas (desarrollo) y una segunda
// instancia con otro `SITE_URL` y `SITE_ENV=production`. Nada del dominio queda fijo en el build (3.7).

type Seed = {
  matchSlug: string
  juvenileMatchSlug: string
  adultSlug: string
  juveniles: { slug: string; fullName: string }[]
}
let seed: Seed

test.beforeAll(async () => {
  const sql = adminSql()
  const match = (series: string) => sql<{ slug: string }[]>`
    select m.slug from matches m join series s on s.id = m.series_id
    where s.slug = ${series} and m.club_side <> 'ninguno' and m.status = 'finalizado'
    order by m.kickoff_at desc limit 1`
  const [[honor], [juvenil], [adult], juveniles] = await Promise.all([
    match('honor'),
    match('juvenil'),
    sql<{ slug: string }[]>`
      select p.slug from players p join squad_registrations r on r.player_id = p.id
      join series s on s.id = r.series_id and s.slug = 'honor' and not s.contains_minors
      where p.is_active and not exists (
        select 1 from squad_registrations o join series os on os.id = o.series_id
        where o.player_id = p.id and os.contains_minors)
      order by p.slug limit 1`,
    sql<{ slug: string; first_name: string; last_name: string }[]>`
      select distinct p.slug, p.first_name, p.last_name from players p
      join squad_registrations r on r.player_id = p.id
      join series s on s.id = r.series_id and s.contains_minors`,
  ])
  await sql.end()
  seed = {
    matchSlug: honor?.slug ?? '',
    juvenileMatchSlug: juvenil?.slug ?? '',
    adultSlug: adult?.slug ?? '',
    juveniles: juveniles.map((row) => ({ slug: row.slug, fullName: `${row.first_name} ${row.last_name}` })),
  }
  expect(
    seed.matchSlug && seed.juvenileMatchSlug && seed.adultSlug,
    'el seed trae partidos y jugadores',
  ).toBeTruthy()
  expect(seed.juveniles.length).toBeGreaterThan(5)
})

const attr = (html: string, pattern: RegExp) => pattern.exec(html)?.[1]?.replace(/&amp;/g, '&') ?? null
const canonical = (html: string) => attr(html, /<link rel="canonical" href="([^"]+)"/)
const ogUrl = (html: string) => attr(html, /<meta property="og:url" content="([^"]+)"/)
const robotsMeta = (html: string) => attr(html, /<meta name="robots" content="([^"]+)"/)

function jsonLd(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1] ?? '') as Record<string, unknown>,
  )
}

async function html(request: APIRequestContext, url: string): Promise<string> {
  const response = await request.get(url)
  expect(response.status(), `${url} responde 200`).toBe(200)
  return response.text()
}

test('canonical y og:url salen de SITE_URL en runtime: la misma build sirve dos dominios', async ({
  request,
  baseURL,
}) => {
  const paths = [
    '/',
    '/noticias',
    '/noticias/cronica-honor',
    '/partidos',
    `/partidos/${seed.matchSlug}`,
    '/partidos/posiciones',
    '/plantel/honor',
    `/jugadores/${seed.adultSlug}`,
    '/historia',
    '/historia/titulos',
  ]
  for (const base of [baseURL ?? '', SECOND_SITE.url]) {
    for (const path of paths) {
      const page = await html(request, `${base}${path}`)
      const expected = path === '/' ? base : `${base}${path}`
      expect(canonical(page), `canonical de ${base}${path}`).toBe(expected)
      expect(ogUrl(page), `og:url de ${base}${path}`).toBe(expected)
    }
  }
  // Los filtros no crean direcciones canónicas nuevas.
  expect(canonical(await html(request, `${SECOND_SITE.url}/partidos?serie=segunda`))).toBe(
    `${SECOND_SITE.url}/partidos`,
  )
})

test('solo producción se deja indexar: robots.txt y la etiqueta robots dependen de SITE_ENV', async ({
  request,
  baseURL,
}) => {
  const staging = await (await request.get(`${baseURL}/robots.txt`)).text()
  expect(staging).toMatch(/User-Agent: \*\s+Disallow: \/\s*$/i)
  expect(staging).not.toMatch(/Sitemap:/i)
  expect(robotsMeta(await html(request, `${baseURL}/`))).toBe('noindex, nofollow')
  expect(robotsMeta(await html(request, `${baseURL}/noticias/cronica-honor`))).toBe('noindex, nofollow')

  const production = await (await request.get(`${SECOND_SITE.url}/robots.txt`)).text()
  expect(production).toMatch(/Allow: \/\s/i)
  expect(production).toMatch(/Disallow: \/admin\s/i)
  expect(production).toMatch(/Disallow: \/api\s/i)
  expect(production).toContain(`Sitemap: ${SECOND_SITE.url}/sitemap.xml`)
  expect(robotsMeta(await html(request, `${SECOND_SITE.url}/`))).toBeNull()
  expect(robotsMeta(await html(request, `${SECOND_SITE.url}/noticias/cronica-honor`))).toBeNull()
  // Las secciones que siguen en «Próximamente» y el panel no se indexan ni en producción.
  expect(robotsMeta(await html(request, `${SECOND_SITE.url}/tienda`))).toContain('noindex')
  const login = await request.get(`${SECOND_SITE.url}/admin/login`)
  expect(login.headers()['x-robots-tag']).toBe('noindex, nofollow')
})

test('el sitemap es válido, usa el dominio de cada instancia y no lista a ningún menor', async ({
  request,
  baseURL,
}) => {
  for (const base of [baseURL ?? '', SECOND_SITE.url]) {
    const response = await request.get(`${base}/sitemap.xml`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')
    const xml = await response.text()
    expect(xml).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/,
    )
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')
    expect(locs.length).toBeGreaterThan(50)
    expect(
      locs.every((loc) => loc === base || loc.startsWith(`${base}/`)),
      `todo empieza con ${base}`,
    ).toBe(true)
    expect(new Set(locs).size).toBe(locs.length)
    for (const path of [
      '/noticias',
      '/noticias/cronica-honor',
      `/partidos/${seed.matchSlug}`,
      '/plantel/honor',
      '/plantel/juvenil',
      `/jugadores/${seed.adultSlug}`,
      '/historia',
    ]) {
      expect(locs, `${path} está en el sitemap`).toContain(`${base}${path}`)
    }
    expect(locs.some((loc) => /\/(admin|api)(\/|$)/.test(loc))).toBe(false)
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T[^<]+<\/lastmod>/)

    // Menores de edad (por serie, también los que además juegan en una serie adulta): sin ficha en el sitemap.
    for (const juvenile of seed.juveniles) {
      expect(locs, `${juvenile.slug} no debe aparecer`).not.toContain(`${base}/jugadores/${juvenile.slug}`)
    }
  }
})

test('JSON-LD válido: club, sitio, migas, noticia y partido, con direcciones absolutas', async ({
  request,
}) => {
  const base = SECOND_SITE.url

  const home = jsonLd(await html(request, `${base}/`))
  const team = home.find((item) => item['@type'] === 'SportsTeam')
  expect(team).toMatchObject({
    '@context': 'https://schema.org',
    name: 'Club Deportivo Los Cachorros',
    sport: 'Fútbol',
    foundingDate: '1934-04-01',
    url: `${base}/`,
    location: { '@type': 'Place', name: 'Sagrada Familia' },
  })
  expect(String(team?.logo)).toMatch(new RegExp(`^${base}/media/`))
  expect(home.find((item) => item['@type'] === 'WebSite')).toMatchObject({
    url: `${base}/`,
    inLanguage: 'es-CL',
  })
  // Lo que el club aún no completa no se publica como dato.
  expect(JSON.stringify(home)).not.toContain('COMPLETAR')

  const newsPage = await html(request, `${base}/noticias/cronica-honor`)
  const news = jsonLd(newsPage)
  const article = news.find((item) => item['@type'] === 'NewsArticle')
  expect(article).toMatchObject({
    url: `${base}/noticias/cronica-honor`,
    mainEntityOfPage: `${base}/noticias/cronica-honor`,
    inLanguage: 'es-CL',
    publisher: { '@type': 'SportsTeam', name: 'Club Deportivo Los Cachorros' },
  })
  expect(String(article?.headline)).toContain('Honor se impuso')
  expect(String(article?.datePublished)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  const [articleImage] = (article?.image ?? []) as string[]
  expect(articleImage).toMatch(new RegExp(`^${base}/media/`))
  const crumbs = news.find((item) => item['@type'] === 'BreadcrumbList') as
    | { itemListElement: { position: number; name: string; item?: string }[] }
    | undefined
  expect(crumbs?.itemListElement.map((item) => item.position)).toEqual([1, 2, 3])
  expect(crumbs?.itemListElement[1]).toMatchObject({ name: 'Noticias', item: `${base}/noticias` })
  // Open Graph de artículo, con imagen absoluta.
  expect(attr(newsPage, /<meta property="og:type" content="([^"]+)"/)).toBe('article')
  expect(attr(newsPage, /<meta property="og:image" content="([^"]+)"/)).toMatch(new RegExp(`^${base}/media/`))
  expect(attr(newsPage, /<meta property="og:site_name" content="([^"]+)"/)).toBe(
    'Club Deportivo Los Cachorros',
  )

  const match = jsonLd(await html(request, `${base}/partidos/${seed.matchSlug}`))
  const event = match.find((item) => item['@type'] === 'SportsEvent')
  expect(event).toMatchObject({
    url: `${base}/partidos/${seed.matchSlug}`,
    sport: 'Fútbol',
    eventStatus: 'https://schema.org/EventScheduled',
    homeTeam: { '@type': 'SportsTeam' },
    awayTeam: { '@type': 'SportsTeam' },
  })
  // Fecha con zona horaria explícita.
  expect(String(event?.startDate)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/)
})

test('ningún JSON-LD lleva el nombre completo de un menor de edad', async ({ request }) => {
  const base = SECOND_SITE.url
  for (const path of [
    '/plantel/juvenil',
    `/partidos/${seed.juvenileMatchSlug}`,
    '/partidos/goleadores?serie=juvenil',
    '/plantel/honor',
  ]) {
    const data = JSON.stringify(jsonLd(await html(request, `${base}${path}`)))
    for (const juvenile of seed.juveniles) {
      expect(data, `${path} no nombra a ${juvenile.slug}`).not.toContain(juvenile.fullName)
    }
  }
})
