// Datos estructurados (especificación 11). Constructores puros: reciben DTOs públicos y la URL del sitio,
// así que nunca incluyen datos privados (un jugador menor de edad no llega aquí: los DTOs ya lo excluyen).

type JsonLd = Record<string, unknown>

type SiteInput = {
  clubName: string
  shortName: string
  foundedOn: string
  commune: string | null
  region: string | null
  logo: string | null
  sameAs: string[]
  description?: string | null
}

const CONTEXT = 'https://schema.org'

/** URL absoluta de una ruta del sitio; lo que ya es absoluto se devuelve igual. */
export function absoluteUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

/** Quita las claves sin valor: un dato que el club no ha completado no se publica vacío. */
function compact(value: JsonLd): JsonLd {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) =>
        item !== null && item !== undefined && item !== '' && !(Array.isArray(item) && item.length === 0),
    ),
  )
}

/** Los marcadores `[COMPLETAR: …]` del seed no son datos: no se publican como si lo fueran. */
const real = (value: string | null | undefined) => (value && !value.includes('[COMPLETAR') ? value : null)

export function sportsTeamJsonLd(site: SiteInput, baseUrl: string): JsonLd {
  const locality = real(site.commune)
  return compact({
    '@context': CONTEXT,
    '@type': 'SportsTeam',
    '@id': absoluteUrl(baseUrl, '/#club'),
    name: site.clubName,
    alternateName: site.shortName,
    sport: 'Fútbol',
    url: absoluteUrl(baseUrl, '/'),
    foundingDate: site.foundedOn,
    description: real(site.description),
    logo: site.logo ? absoluteUrl(baseUrl, site.logo) : null,
    location: locality
      ? compact({
          '@type': 'Place',
          name: locality,
          address: compact({
            '@type': 'PostalAddress',
            addressLocality: locality,
            addressRegion: real(site.region),
            addressCountry: 'CL',
          }),
        })
      : null,
    sameAs: site.sameAs,
  })
}

export function webSiteJsonLd(site: Pick<SiteInput, 'clubName'>, baseUrl: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': absoluteUrl(baseUrl, '/#sitio'),
    name: site.clubName,
    url: absoluteUrl(baseUrl, '/'),
    inLanguage: 'es-CL',
  }
}

/** Migas de pan. El último elemento es la página actual y puede no tener enlace. */
export function breadcrumbJsonLd(items: { href?: string; label: string }[], baseUrl: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        item: item.href ? absoluteUrl(baseUrl, item.href) : null,
      }),
    ),
  }
}

type NewsInput = {
  slug: string
  title: string
  excerpt: string | null
  publishedAt: string
  updatedAt: string
  image: string | null
  categoryName: string | null
}

export function newsArticleJsonLd(
  news: NewsInput,
  site: Pick<SiteInput, 'clubName' | 'logo'>,
  baseUrl: string,
) {
  const url = absoluteUrl(baseUrl, `/noticias/${news.slug}`)
  const publisher = compact({
    '@type': 'SportsTeam',
    '@id': absoluteUrl(baseUrl, '/#club'),
    name: site.clubName,
    logo: site.logo ? compact({ '@type': 'ImageObject', url: absoluteUrl(baseUrl, site.logo) }) : null,
  })
  return compact({
    '@context': CONTEXT,
    '@type': 'NewsArticle',
    headline: news.title.slice(0, 110),
    description: news.excerpt,
    url,
    mainEntityOfPage: url,
    datePublished: news.publishedAt,
    dateModified: news.updatedAt > news.publishedAt ? news.updatedAt : news.publishedAt,
    image: news.image ? [absoluteUrl(baseUrl, news.image)] : null,
    articleSection: news.categoryName,
    inLanguage: 'es-CL',
    author: publisher,
    publisher,
  })
}

type MatchStatus = 'programado' | 'en_vivo' | 'finalizado' | 'suspendido' | 'postergado' | 'cancelado'

const EVENT_STATUS: Record<MatchStatus, string> = {
  programado: 'EventScheduled',
  en_vivo: 'EventScheduled',
  finalizado: 'EventScheduled',
  // schema.org no tiene «suspendido»: lo más cercano a un partido que no terminó y espera nueva fecha.
  suspendido: 'EventPostponed',
  postergado: 'EventPostponed',
  cancelado: 'EventCancelled',
}

type MatchInput = {
  slug: string
  status: MatchStatus
  /** Instante ISO 8601 (con zona horaria). */
  kickoffAt: string
  seriesName: string
  competitionName: string
  home: { name: string }
  away: { name: string }
  venue: { name: string; address?: string | null } | null
}

export function sportsEventJsonLd(match: MatchInput, baseUrl: string): JsonLd {
  const team = (name: string) => ({ '@type': 'SportsTeam', name })
  return compact({
    '@context': CONTEXT,
    '@type': 'SportsEvent',
    name: `${match.home.name} vs ${match.away.name} · ${match.seriesName}`,
    description: `${match.seriesName} · ${match.competitionName}`,
    sport: 'Fútbol',
    url: absoluteUrl(baseUrl, `/partidos/${match.slug}`),
    startDate: match.kickoffAt,
    eventStatus: `${CONTEXT}/${EVENT_STATUS[match.status]}`,
    eventAttendanceMode: `${CONTEXT}/OfflineEventAttendanceMode`,
    homeTeam: team(match.home.name),
    awayTeam: team(match.away.name),
    competitor: [team(match.home.name), team(match.away.name)],
    location: match.venue
      ? compact({
          '@type': 'Place',
          name: match.venue.name,
          address: real(match.venue.address),
        })
      : null,
  })
}

/**
 * JSON listo para ir dentro de `<script type="application/ld+json">`: los caracteres que podrían cerrar la
 * etiqueta o abrir una entidad (y los separadores de línea Unicode) van como escapes, que para JSON son el
 * mismo carácter.
 */
export function serializeJsonLd(data: unknown): string {
  const BACKSLASH = String.fromCharCode(92)
  let out = ''
  for (const char of JSON.stringify(data)) {
    const code = char.charCodeAt(0)
    const unsafe = char === '<' || char === '>' || char === '&' || code === 0x2028 || code === 0x2029
    out += unsafe ? `${BACKSLASH}u${code.toString(16).padStart(4, '0')}` : char
  }
  return out
}
