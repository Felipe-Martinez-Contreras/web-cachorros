import 'server-only'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { loadSiteOrFallback } from '@/components/site/site-frame'
import { env } from '@/lib/env'
import type { ImageDTO } from '@/lib/images/dto'
import { ogImageOf } from './lib/og-image'

const DEFAULT_DESCRIPTION = 'Club Deportivo Los Cachorros de Sagrada Familia. Desde 1934.'

/** URL pública del sitio, sin barra final. Se lee en runtime: la misma build sirve en cualquier dominio. */
export function siteBaseUrl(): string {
  return (env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

/**
 * Metadatos del layout raíz (especificación 11): `metadataBase` desde `SITE_URL`, plantilla de título con
 * el nombre del club y `noindex` en todo lo que no sea producción. Si la base falla usa valores de respaldo.
 */
export async function rootMetadata(): Promise<Metadata> {
  await connection()
  const site = await loadSiteOrFallback()
  const description = site.seoDescription ?? DEFAULT_DESCRIPTION
  const image = ogImageOf(site.seoImage)
  return {
    metadataBase: new URL(siteBaseUrl()),
    title: { default: site.clubName, template: `%s | ${site.clubName}` },
    description,
    openGraph: {
      type: 'website',
      siteName: site.clubName,
      locale: 'es_CL',
      title: site.clubName,
      description,
      url: '/',
      images: image ? [image] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary' },
    // Staging y desarrollo nunca se indexan.
    ...(env.SITE_ENV === 'production' ? null : { robots: { index: false, follow: false } }),
  }
}

type PageMetadataInput = {
  /** Sin título, la página usa el nombre del club (portada). */
  title?: string
  description?: string | null
  /** Ruta canónica de la página (`/partidos`). */
  path: string
  image?: ImageDTO | null
  article?: { publishedTime: string; modifiedTime?: string; section?: string | null }
}

/**
 * Metadatos de una página pública: canonical, Open Graph y Twitter. Las direcciones van relativas y
 * `metadataBase` las vuelve absolutas con el dominio de esta instalación.
 */
export async function pageMetadata(input: PageMetadataInput): Promise<Metadata> {
  await connection()
  const site = await loadSiteOrFallback()
  const description = input.description ?? site.seoDescription ?? DEFAULT_DESCRIPTION
  const image = ogImageOf(input.image ?? site.seoImage)
  const images = image ? [image] : undefined
  const title = input.title ?? site.clubName
  return {
    ...(input.title ? { title: input.title } : null),
    description,
    alternates: { canonical: input.path },
    openGraph: {
      siteName: site.clubName,
      locale: 'es_CL',
      title,
      description,
      url: input.path,
      images,
      ...(input.article
        ? {
            type: 'article',
            publishedTime: input.article.publishedTime,
            modifiedTime: input.article.modifiedTime,
            section: input.article.section ?? undefined,
          }
        : { type: 'website' }),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images },
  }
}
