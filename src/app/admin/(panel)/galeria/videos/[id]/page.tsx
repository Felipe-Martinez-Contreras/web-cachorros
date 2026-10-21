import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarVideo, eliminarVideo } from '@/features/gallery/actions'
import { getVideoAdmin } from '@/features/gallery/admin-queries'
import { VideoForm } from '@/features/gallery/components/forms'
import { newsFormOptions } from '@/features/news/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { isContentMarker } from '@/lib/markers'

export const metadata: Metadata = { title: 'Editar video' }

export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('gallery:write')
  const { id } = await params
  const [video, { matches }] = await Promise.all([isUuid(id) ? getVideoAdmin(id) : null, newsFormOptions()])
  if (!video) notFound()

  return (
    <>
      <PageHeader title={video.title} back={{ href: '/admin/galeria/videos', label: 'Videos' }} />
      <VideoForm
        action={actualizarVideo.bind(null, video.id)}
        thumbnail={video.thumbnail}
        matches={matches}
        defaults={{
          title: video.title,
          // Un marcador [COMPLETAR] del seed no es una dirección: el campo queda vacío para pegarla.
          url: isContentMarker(video.url) ? '' : video.url,
          thumbnailMediaId: video.thumbnail?.id ?? '',
          publishedOn: video.publishedOn ?? '',
          matchId: video.matchId ?? '',
          isPublished: video.isPublished,
        }}
      />
      <DeleteSection
        what={`el video ${video.title}`}
        description="Deja de mostrarse en Videos. La miniatura sigue en la biblioteca de medios."
        action={eliminarVideo.bind(null, video.id)}
        redirectTo="/admin/galeria/videos"
        buttonLabel="Eliminar video"
        successMessage="Video eliminado."
      />
    </>
  )
}
