import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearNoticia } from '@/features/news/actions'
import { newsFormOptions } from '@/features/news/admin-queries'
import { NewsForm } from '@/features/news/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva noticia' }

export default async function NewNewsPage() {
  await requirePanelUser('news:write')
  const options = await newsFormOptions()

  return (
    <>
      <PageHeader
        title="Nueva noticia"
        description="Se guarda como borrador: nadie la ve hasta que la publiques."
        back={{ href: '/admin/noticias', label: 'Noticias' }}
      />
      <NewsForm
        mode="create"
        action={crearNoticia}
        options={options}
        cover={null}
        og={null}
        defaults={{
          title: '',
          type: 'noticia',
          categoryId: '',
          excerpt: '',
          body: null,
          coverMediaId: '',
          seriesIds: [],
          matchId: '',
          albumId: '',
          isFeatured: false,
          isPinned: false,
          slug: '',
          seoTitle: '',
          seoDescription: '',
          ogMediaId: '',
        }}
      />
    </>
  )
}
