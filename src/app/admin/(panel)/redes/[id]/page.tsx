import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarPublicacion, eliminarPublicacion } from '@/features/social/actions'
import { getSocialPostAdmin } from '@/features/social/admin-queries'
import { SocialPostForm } from '@/features/social/components/social-post-form'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { socialPlatformLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Editar publicación' }

export default async function EditSocialPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('social:write')
  const { id } = await params
  const row = isUuid(id) ? await getSocialPostAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title={`Publicación en ${socialPlatformLabels[row.platform]}`}
        back={{ href: '/admin/redes', label: 'Redes sociales' }}
      />
      <SocialPostForm
        action={actualizarPublicacion.bind(null, row.id)}
        image={row.image}
        defaults={{
          permalink: row.permalink,
          platform: row.platform === 'facebook' || row.platform === 'tiktok' ? row.platform : 'instagram',
          imageMediaId: row.image?.id ?? '',
          excerpt: row.excerpt ?? '',
          postedOn: row.postedOn ?? '',
          sortOrder: row.sortOrder,
          isPinned: row.isPinned,
          embedEnabled: row.embedEnabled,
          isPublished: row.isPublished,
        }}
      />
      <DeleteSection
        what="esta publicación"
        description="Se quita del sitio. La publicación original en la red no cambia."
        action={eliminarPublicacion.bind(null, row.id)}
        redirectTo="/admin/redes"
        buttonLabel="Eliminar publicación"
        successMessage="Publicación eliminada."
      />
    </>
  )
}
