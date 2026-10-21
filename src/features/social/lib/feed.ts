import { parseEmbedUrl } from '@/lib/rich-text/embed'

// Feed curado de redes (especificación 2.9): de qué red es un enlace y cómo se incrusta detrás de una
// fachada. Lógica pura, sin servidor.

export type FeedPlatform = 'instagram' | 'facebook' | 'tiktok'

export const FEED_PLATFORM_LABELS: Record<FeedPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

export type DetectedPost = {
  platform: FeedPlatform
  /** Dirección normalizada (siempre `https`). */
  url: string
  /** Instagram y Facebook tienen un embed oficial en iframe; TikTok, no en v1 (solo enlace). */
  embeddable: boolean
}

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'])

/** Reconoce el enlace de una publicación de Instagram, Facebook o TikTok; `null` si es de otro lugar. */
export function detectSocialPost(raw: unknown): DetectedPost | null {
  const embed = parseEmbedUrl(raw)
  if (embed?.provider === 'instagram' || embed?.provider === 'facebook') {
    return { platform: embed.provider, url: embed.url, embeddable: true }
  }
  if (typeof raw !== 'string') return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if ((url.protocol === 'https:' || url.protocol === 'http:') && TIKTOK_HOSTS.has(url.hostname)) {
    if (url.pathname.length <= 1) return null
    return { platform: 'tiktok', url: `https://${url.hostname}${url.pathname}`, embeddable: false }
  }
  return null
}

/**
 * Dirección del iframe del embed oficial, que se carga solo al tocar «Ver aquí». `null` si la red no lo
 * permite o el enlace no es válido.
 */
export function embedFrameUrl(permalink: string): string | null {
  const post = detectSocialPost(permalink)
  if (!post?.embeddable) return null
  if (post.platform === 'instagram') {
    const path = new URL(post.url).pathname.replace(/\/+$/, '')
    return `https://www.instagram.com${path}/embed/`
  }
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(post.url)}&show_text=true&width=500`
}
