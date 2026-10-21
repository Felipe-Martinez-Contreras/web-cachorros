import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { Breadcrumbs } from '@/components/site/page-shell'
import { ShareBar } from '@/components/site/share-bar'
import { EmptyState } from '@/components/ui/feedback'
import { AlbumLightbox } from '@/features/gallery/components/album-lightbox'
import { getAlbumDetail, resolveAlbumRedirect } from '@/features/gallery/queries'
import { pageMetadata, siteBaseUrl } from '@/features/seo/metadata'
import { formatLongDate, fromIsoDate } from '@/lib/format'

type Props = { params: Promise<{ slug: string }> }

async function loadAlbum(slug: string) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const album = await getAlbumDetail(slug)
  if (album) return album
  // Segunda barrera (el 404 y el 301 reales los responde el proxy, ADR 0008).
  const current = await resolveAlbumRedirect(slug)
  if (current) permanentRedirect(`/galeria/${current}`)
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const album = await loadAlbum((await params).slug)
  return pageMetadata({
    title: album.title,
    description: `${album.photos.length} fotos del Club Deportivo Los Cachorros.`,
    path: `/galeria/${album.slug}`,
    image: album.cover ?? album.photos[0]?.image ?? null,
  })
}

export default async function AlbumPage({ params }: Props) {
  const album = await loadAlbum((await params).slug)

  return (
    <div className="container-site grid grid-cols-1 gap-6 py-6 md:py-10">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Inicio' },
          { href: '/galeria', label: 'Galería' },
          { label: album.title },
        ]}
      />
      <header className="grid gap-2">
        <h1 className="text-h1">{album.title}</h1>
        <p className="text-(--muted)">
          {album.takenOn && (
            <time dateTime={album.takenOn}>{formatLongDate(fromIsoDate(album.takenOn))} · </time>
          )}
          {album.photos.length === 1 ? '1 foto' : `${album.photos.length} fotos`}
        </p>
        {(album.match || album.event) && (
          <p>
            {album.match && (
              <Link href={`/partidos/${album.match.slug}`} className="text-(--link) underline">
                Ver el partido: {album.match.label}
              </Link>
            )}
            {album.event && (
              <Link href={`/eventos/${album.event.slug}`} className="text-(--link) underline">
                Ver el evento: {album.event.title}
              </Link>
            )}
          </p>
        )}
      </header>
      {album.photos.length === 0 ? (
        <EmptyState title="Este álbum todavía no tiene fotos">Vuelve pronto.</EmptyState>
      ) : (
        <AlbumLightbox title={album.title} photos={album.photos} />
      )}
      <div className="border-t border-(--border) pt-6">
        <ShareBar url={`${siteBaseUrl()}/galeria/${album.slug}`} title={album.title} />
      </div>
    </div>
  )
}
