export type EmbedProvider = 'youtube' | 'facebook' | 'instagram'

export type Embed = {
  provider: EmbedProvider
  /** Dirección normalizada de la publicación original (siempre `https`). */
  url: string
  /** Solo YouTube: id del video, para cargar el reproductor al hacer clic. */
  videoId?: string
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])
const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch'])
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com'])
const YOUTUBE_ID = /^[\w-]{11}$/

function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] ?? null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const [, kind, id] = url.pathname.split('/')
  return kind === 'shorts' || kind === 'embed' || kind === 'live' ? (id ?? null) : null
}

/**
 * Reconoce el enlace de un video o publicación que se puede incrustar en una noticia (especificación 6.1):
 * YouTube, Facebook e Instagram. Cualquier otra dirección devuelve `null`.
 */
export function parseEmbedUrl(raw: unknown): Embed | null {
  if (typeof raw !== 'string') return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const id = youtubeId(url)
    if (!id || !YOUTUBE_ID.test(id)) return null
    return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, videoId: id }
  }
  if (FACEBOOK_HOSTS.has(url.hostname) && url.pathname.length > 1) {
    return { provider: 'facebook', url: `https://${url.hostname}${url.pathname}${url.search}` }
  }
  if (INSTAGRAM_HOSTS.has(url.hostname) && /^\/(p|reel|tv)\/[\w-]+/.test(url.pathname)) {
    return { provider: 'instagram', url: `https://www.instagram.com${url.pathname}` }
  }
  return null
}
