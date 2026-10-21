import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearPublicacion } from '@/features/social/actions'
import { SocialPostForm } from '@/features/social/components/social-post-form'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva publicación' }

export default async function NewSocialPostPage() {
  await requirePanelUser('social:write')
  return (
    <>
      <PageHeader title="Nueva publicación" back={{ href: '/admin/redes', label: 'Redes sociales' }} />
      <SocialPostForm
        action={crearPublicacion}
        image={null}
        defaults={{
          permalink: '',
          platform: 'instagram',
          imageMediaId: '',
          excerpt: '',
          postedOn: '',
          sortOrder: 0,
          isPinned: false,
          embedEnabled: false,
          isPublished: true,
        }}
      />
    </>
  )
}
