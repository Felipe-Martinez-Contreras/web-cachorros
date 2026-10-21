import { ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { PageHero } from '@/components/site/page-shell'
import { YoutubeFacade } from '@/components/site/youtube-facade'
import { EmptyState } from '@/components/ui/feedback'
import { getVideos } from '@/features/gallery/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { formatShortDate, fromIsoDate } from '@/lib/format'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Videos',
    description: 'Resúmenes, goles y saludos del Club Deportivo Los Cachorros.',
    path: '/videos',
  })
}

export default async function VideosPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const videos = await getVideos()

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Videos' }]} title="Videos">
        <p className="max-w-2xl text-(--muted)">
          Nada se carga desde YouTube o Facebook hasta que tocas un video.
        </p>
      </PageHero>
      <div className="container-site py-8 md:py-12">
        {videos.length === 0 ? (
          <EmptyState title="Todavía no hay videos">Vuelve pronto.</EmptyState>
        ) : (
          <ul className="grid gap-x-6 gap-y-10 md:grid-cols-2">
            {videos.map((video) => (
              <li key={video.id} className="grid content-start gap-2">
                {video.provider === 'youtube' && video.youtubeId ? (
                  <YoutubeFacade
                    videoId={video.youtubeId}
                    url={video.url}
                    title={video.title}
                    poster={video.thumbnail}
                  />
                ) : (
                  // Facebook: un enlace al video (su reproductor cargaría sus scripts y cookies).
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="theme-dark relative grid aspect-video w-full place-content-center justify-items-center gap-2 overflow-hidden rounded-lg text-center no-underline"
                  >
                    {video.thumbnail && (
                      <ClubImage
                        image={video.thumbnail}
                        alt=""
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="absolute inset-0 size-full object-cover opacity-40"
                      />
                    )}
                    <span className="relative text-lg font-bold text-(--fg)">
                      Ver en Facebook <ExternalLink aria-hidden="true" className="inline size-5" />
                    </span>
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                )}
                <h2 className="text-lg leading-snug font-bold">{video.title}</h2>
                {video.publishedOn && (
                  <p className="text-meta text-(--muted)">
                    <time dateTime={video.publishedOn}>
                      {formatShortDate(fromIsoDate(video.publishedOn))}
                    </time>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
