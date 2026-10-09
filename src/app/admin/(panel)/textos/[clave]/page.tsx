import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { buttonVariants } from '@/components/ui/button'
import { guardarTextoDePagina } from '@/features/pages/actions'
import { isPageBlockKey } from '@/features/pages/blocks'
import { PageBlockForm } from '@/features/pages/components/forms'
import { getPageBlockAdmin } from '@/features/pages/queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Editar texto' }

export default async function EditPageBlockPage({ params }: { params: Promise<{ clave: string }> }) {
  await requirePanelUser('pages:write')
  const { clave: key } = await params
  if (!isPageBlockKey(key)) notFound()
  const block = await getPageBlockAdmin(key)

  return (
    <>
      <PageHeader
        title={block.label}
        description={block.where}
        back={{ href: '/admin/textos', label: 'Textos de páginas' }}
        action={
          block.href && (
            <a href={block.href} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Ver en el sitio
            </a>
          )
        }
      />
      <PageBlockForm
        action={guardarTextoDePagina.bind(null, key)}
        defaults={{ title: block.title ?? '', body: block.body }}
      />
    </>
  )
}
