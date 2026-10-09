import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { getNewsPreview } from '@/features/news/admin-queries'
import { NewsArticle } from '@/features/news/components/news-article'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Vista previa' }

export default async function NewsPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('news:write')
  const { id } = await params
  const news = isUuid(id) ? await getNewsPreview(id) : null
  if (!news) notFound()

  return (
    <>
      <PageHeader title="Vista previa" back={{ href: `/admin/noticias/${id}`, label: 'Volver a editar' }} />
      <Alert className="mb-4">
        Así se verá la noticia en el sitio, con lo último que guardaste.
        {news.publishedAt === null && ' Todavía no está publicada.'}
      </Alert>
      {/* Mismo componente y mismos colores que la página pública. */}
      <div className="theme-light overflow-hidden rounded-lg border border-neutral-200">
        <NewsArticle news={news} />
      </div>
    </>
  )
}
