import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { AlbumCard } from '@/features/gallery/components/album-card'
import { getAlbums } from '@/features/gallery/queries'
import { pageMetadata } from '@/features/seo/metadata'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Galería',
    description: 'Fotos de los partidos y las actividades del Club Deportivo Los Cachorros.',
    path: '/galeria',
  })
}

export default async function GalleryPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const albums = await getAlbums()

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Galería' }]} title="Galería">
        <p className="max-w-2xl text-(--muted)">
          Las fotos de cada partido y actividad. También hay{' '}
          <Link href="/videos" className="text-accent underline">
            videos
          </Link>
          .
        </p>
      </PageHero>
      <div className="container-site py-8 md:py-12">
        {albums.length === 0 ? (
          <EmptyState title="Todavía no hay álbumes">Vuelve después del próximo partido.</EmptyState>
        ) : (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <li key={album.id}>
                <AlbumCard album={album} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
