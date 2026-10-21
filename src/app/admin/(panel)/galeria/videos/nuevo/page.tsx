import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearVideo } from '@/features/gallery/actions'
import { VideoForm } from '@/features/gallery/components/forms'
import { newsFormOptions } from '@/features/news/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo video' }

export default async function NewVideoPage() {
  await requirePanelUser('gallery:write')
  const { matches } = await newsFormOptions()
  return (
    <>
      <PageHeader title="Nuevo video" back={{ href: '/admin/galeria/videos', label: 'Videos' }} />
      <VideoForm
        action={crearVideo}
        thumbnail={null}
        matches={matches}
        defaults={{
          title: '',
          url: '',
          thumbnailMediaId: '',
          publishedOn: '',
          matchId: '',
          isPublished: true,
        }}
      />
    </>
  )
}
