import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { loadSiteOrFallback } from '@/components/site/site-frame'

/**
 * Manifest de la PWA (especificación 6.16), generado en runtime: el nombre viene de Configuración y nada
 * depende del build (3.7). Los íconos se generan desde el escudo con `pnpm pwa:icons`.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection()
  const site = await loadSiteOrFallback()
  return {
    name: site.clubName,
    short_name: site.shortName,
    description: `Resultados, noticias y comunidad del ${site.clubName}.`,
    lang: 'es-CL',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Tokens de marca (src/styles/tokens.css): negro base y blanco base.
    theme_color: '#0b0b0c',
    background_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Partidos', url: '/partidos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Noticias', url: '/noticias', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Tienda', url: '/tienda', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
