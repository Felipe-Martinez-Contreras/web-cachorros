import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearDocumento } from '@/features/club/actions'
import { DocumentForm } from '@/features/club/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo documento' }

export default async function NewDocumentPage() {
  await requirePanelUser('club:write')
  return (
    <>
      <PageHeader title="Nuevo documento" back={{ href: '/admin/club/documentos', label: 'Documentos' }} />
      <DocumentForm
        action={crearDocumento}
        file={null}
        defaults={{
          title: '',
          category: 'acta',
          periodLabel: '',
          documentDate: '',
          fileMediaId: '',
          description: '',
          isPublished: true,
        }}
      />
    </>
  )
}
