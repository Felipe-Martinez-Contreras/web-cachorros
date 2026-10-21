import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearAlbum } from '@/features/gallery/actions'
import { eventOptions } from '@/features/gallery/admin-queries'
import { AlbumForm } from '@/features/gallery/components/forms'
import { newsFormOptions } from '@/features/news/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo álbum' }

export default async function NewAlbumPage() {
  await requirePanelUser('gallery:write')
  const [{ matches }, events] = await Promise.all([newsFormOptions(), eventOptions()])
  return (
    <>
      <PageHeader title="Nuevo álbum" back={{ href: '/admin/galeria', label: 'Galería' }} />
      <AlbumForm
        isNew
        action={crearAlbum}
        cover={null}
        matches={matches}
        events={events}
        defaults={{
          title: '',
          takenOn: '',
          coverMediaId: '',
          matchId: '',
          eventId: '',
          isPublished: false,
          containsMinors: false,
          minorsConsent: false,
        }}
      />
    </>
  )
}
