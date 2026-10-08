import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { BottomNav } from '@/components/site/bottom-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import type { SiteDTO } from '@/features/settings/dto'
import { getSite } from '@/features/settings/queries'

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

/**
 * Marco del sitio público. Los datos del club se leen de la BD en runtime (`connection()`: el build no la
 * toca) desde una consulta cacheada por tags. No hay <Suspense> intermedios a propósito: el HTML llega
 * completo y funciona sin JavaScript (el único límite está en el layout raíz).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  await connection()
  const site = (await getSite()) ?? FALLBACK_SITE
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
