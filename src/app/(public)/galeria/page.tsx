import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { AlbumCard } from '@/features/gallery/components/album-card'
import { VideoList } from '@/features/gallery/components/video-list'
import { GALLERY_VIEWS, galleryView, galleryViewHref } from '@/features/gallery/lib/view'
import { getAlbums, getVideos } from '@/features/gallery/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { cn } from '@/lib/cn'

type Props = { searchParams: Promise<{ vista?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const view = galleryView((await searchParams).vista)
  return pageMetadata(
    view === 'videos'
      ? {
          title: 'Videos',
          description: 'Resúmenes, goles y saludos del Club Deportivo Los Cachorros.',
          path: galleryViewHref('videos'),
        }
      : {
          title: 'Galería',
          description: 'Fotos de los partidos y las actividades del Club Deportivo Los Cachorros.',
          path: galleryViewHref('fotos'),
        },
  )
}

/**
 * Pestañas como enlaces: cada vista tiene su dirección, funcionan sin JavaScript y con el teclado (Tab y
 * Enter), y la activa se anuncia con `aria-current`.
 */
function GalleryTabs({ current }: { current: 'fotos' | 'videos' }) {
  return (
    <nav aria-label="Secciones de la galería" className="mt-3">
      <ul className="flex gap-1 border-b border-(--border)">
        {GALLERY_VIEWS.map((tab) => (
          <li key={tab.view}>
            <Link
              href={galleryViewHref(tab.view)}
              aria-current={tab.view === current ? 'page' : undefined}
              className={cn(
                // `tab-link` (globals.css): la línea bajo la pestaña, naranja en la activa.
                'tab-link inline-flex min-h-11 items-center px-4 font-semibold',
                tab.view !== current && 'text-(--muted) hover:text-(--fg)',
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default async function GalleryPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const view = galleryView((await searchParams).vista)

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Galería' }]} title="Galería">
        <p className="max-w-2xl text-(--muted)">
          {view === 'videos'
            ? 'Nada se carga desde YouTube o Facebook hasta que tocas un video.'
            : 'Las fotos de cada partido y actividad.'}
        </p>
        <GalleryTabs current={view} />
      </PageHero>
      <div className="container-site py-8 md:py-12">
        {view === 'videos' ? <VideoList videos={await getVideos()} /> : <Albums />}
      </div>
    </>
  )
}

async function Albums() {
  const albums = await getAlbums()
  if (albums.length === 0) {
    return <EmptyState title="Todavía no hay álbumes">Vuelve después del próximo partido.</EmptyState>
  }
  return (
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {albums.map((album) => (
        <li key={album.id}>
          <AlbumCard album={album} />
        </li>
      ))}
    </ul>
  )
}
