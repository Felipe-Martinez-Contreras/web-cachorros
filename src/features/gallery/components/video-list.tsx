import { ExternalLink } from 'lucide-react'
import { ClubImage } from '@/components/site/club-image'
import { YoutubeFacade } from '@/components/site/youtube-facade'
import { EmptyState } from '@/components/ui/feedback'
import { formatShortDate, fromIsoDate } from '@/lib/format'
import type { VideoDTO } from '../dto'

/**
 * Videos del club (pestaña «Videos» de `/galeria`, antes `/videos`). Nada de terceros se carga antes del
 * clic: YouTube va detrás de su fachada y Facebook es un enlace.
 */
export function VideoList({ videos }: { videos: VideoDTO[] }) {
  if (videos.length === 0) return <EmptyState title="Todavía no hay videos">Vuelve pronto.</EmptyState>
  return (
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
              <time dateTime={video.publishedOn}>{formatShortDate(fromIsoDate(video.publishedOn))}</time>
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
