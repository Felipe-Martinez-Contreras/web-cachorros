import type { ReactNode } from 'react'
import { BottomNav } from '@/components/site/bottom-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { hasUpcomingEvent } from '@/features/events/queries'
import type { SiteDTO } from '@/features/settings/dto'
import { getSite } from '@/features/settings/queries'
import { logger } from '@/lib/logger'
import type { NavState } from './nav'

/** Respaldo si aún no existe la fila de configuración (base recién creada, sin migrar ni sembrar). */
const FALLBACK_SITE: SiteDTO = {
  clubName: 'Club Deportivo Los Cachorros',
  shortName: 'Cachorros',
  foundedYear: 1934,
  foundedOn: '1934-04-01',
  crest: null,
  whatsapp: null,
  phone: null,
  email: null,
  address: null,
  commune: null,
  region: null,
  socialLinks: [],
  hero: { title: null, subtitle: null, ctaLabel: null, ctaHref: null, image: null, mobileImage: null },
  seoDescription: null,
  seoImage: null,
}

/** Datos del club para el marco del sitio. Llamar después de `connection()`: el build no toca la BD. */
export async function loadSite(): Promise<SiteDTO> {
  return (await getSite()) ?? FALLBACK_SITE
}

/** Igual que `loadSite()`, pero si la base falla usa el respaldo: la página 404 nunca debe ser un 500. */
export async function loadSiteOrFallback(): Promise<SiteDTO> {
  try {
    return await loadSite()
  } catch (error) {
    logger.warn({ err: error }, 'no se pudieron leer los datos del club; se usa el marco de respaldo')
    return FALLBACK_SITE
  }
}

/** Lo que el menú necesita de los datos. Si la base falla, el menú sale sin las entradas opcionales. */
export async function loadNavState(): Promise<NavState> {
  try {
    return { hasUpcomingEvent: await hasUpcomingEvent() }
  } catch (error) {
    logger.warn({ err: error }, 'no se pudo leer si hay eventos próximos; el menú sale sin «Eventos»')
    return { hasUpcomingEvent: false }
  }
}

/**
 * Marco del sitio público: enlace de salto, encabezado, contenido, pie y barra inferior. `.site-public` aplica
 * los tokens del sitio (esquinas rectas, escala tipográfica, bordes) sin tocar el panel.
 */
export function SiteFrame({ site, nav, children }: { site: SiteDTO; nav: NavState; children: ReactNode }) {
  return (
    <div className="site-public">
      <a
        href="#contenido"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-paper focus-visible:px-4 focus-visible:py-3 focus-visible:font-semibold focus-visible:text-ink"
      >
        Saltar al contenido
      </a>
      <SiteHeader site={site} nav={nav} />
      <main id="contenido" tabIndex={-1} className="min-h-[70svh] outline-none">
        {children}
      </main>
      <SiteFooter site={site} nav={nav} />
      <BottomNav site={site} nav={nav} />
    </div>
  )
}
