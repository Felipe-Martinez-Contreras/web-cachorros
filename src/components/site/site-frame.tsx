import type { ReactNode } from 'react'
import { BottomNav } from '@/components/site/bottom-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import type { SiteDTO } from '@/features/settings/dto'
import { getSite } from '@/features/settings/queries'
import { logger } from '@/lib/logger'

/** Respaldo si aún no existe la fila de configuración (base recién creada, sin migrar ni sembrar). */
const FALLBACK_SITE: SiteDTO = {
  clubName: 'Club Deportivo Los Cachorros',
  shortName: 'Cachorros',
  foundedYear: 1934,
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

/** Marco del sitio público: enlace de salto, encabezado, contenido, pie y barra inferior. */
export function SiteFrame({ site, children }: { site: SiteDTO; children: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-paper focus-visible:px-4 focus-visible:py-3 focus-visible:font-semibold focus-visible:text-ink"
      >
        Saltar al contenido
      </a>
      <SiteHeader site={site} />
      <main id="contenido" tabIndex={-1} className="min-h-[70svh] outline-none">
        {children}
      </main>
      <SiteFooter site={site} />
      <BottomNav site={site} />
    </>
  )
}
