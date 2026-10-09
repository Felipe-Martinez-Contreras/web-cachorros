import type { Metadata } from 'next'
import { connection } from 'next/server'
import { NotFoundContent } from '@/components/site/not-found-content'
import { loadSiteOrFallback, SiteFrame } from '@/components/site/site-frame'

export const metadata: Metadata = { title: 'Página no encontrada' }

/**
 * 404 de cualquier dirección que no existe y de las páginas de detalle que el proxy no encuentra
 * (ADR 0008). El estado 404 lo fija el enrutador antes del render, así que la página puede leer los datos
 * del club en runtime y llevar el encabezado y el pie del sitio (especificación 3.6).
 */
export default async function NotFound() {
  await connection()
  const site = await loadSiteOrFallback()
  return (
    <SiteFrame site={site}>
      <NotFoundContent />
    </SiteFrame>
  )
}
