import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { loadSite, SiteFrame } from '@/components/site/site-frame'

// El sitio público bloquea en el servidor a propósito (ADR 0007): con esto Next no lo reporta como un
// problema de «navegación instantánea» en desarrollo.
export const instant = false

/**
 * Marco del sitio público. Los datos del club se leen de la BD en runtime (`connection()`: el build no la
 * toca) desde una consulta cacheada por tags. No hay <Suspense> intermedios a propósito: el HTML llega
 * completo y funciona sin JavaScript (el único límite está en el layout raíz).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  await connection()
  const site = await loadSite()
  return <SiteFrame site={site}>{children}</SiteFrame>
}
