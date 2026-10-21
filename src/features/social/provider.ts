import 'server-only'
import type { SocialPostDTO } from './dto'
import { getSocialPosts } from './queries'

/**
 * Origen del feed de redes (especificación 2.9). En v1 solo existe `manual`: publicaciones curadas desde
 * el panel. `instagram_api` queda como interfaz para la integración automática descrita en
 * `docs/integraciones/instagram.md`; se implementa cuando el club tenga los requisitos de Meta.
 */
export type SocialFeedSource = 'manual' | 'instagram_api'

export interface SocialFeedProvider {
  readonly source: SocialFeedSource
  /** Publicaciones para la portada, en su orden, ya como DTO público. */
  latest(limit: number): Promise<SocialPostDTO[]>
}

export const manualFeed: SocialFeedProvider = {
  source: 'manual',
  latest: (limit) => getSocialPosts(limit),
}

/** El proveedor vigente. Cambiarlo es agregar otra implementación aquí; las páginas no cambian. */
export function socialFeed(): SocialFeedProvider {
  return manualFeed
}
