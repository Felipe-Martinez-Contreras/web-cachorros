import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarDocumento, eliminarDocumento } from '@/features/club/actions'
import { getDocumentAdmin } from '@/features/club/admin-queries'
import { DocumentForm } from '@/features/club/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar documento' }

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('club:write')
  const { id } = await params
  const document = isUuid(id) ? await getDocumentAdmin(id) : null
  if (!document) notFound()

  return (
    <>
      <PageHeader title={document.title} back={{ href: '/admin/club/documentos', label: 'Documentos' }} />
      <DocumentForm
        action={actualizarDocumento.bind(null, document.id)}
        file={document.file}
        defaults={{
          title: document.title,
          category: document.category,
          periodLabel: document.periodLabel ?? '',
          documentDate: document.documentDate ?? '',
          fileMediaId: document.file.id,
          description: document.description ?? '',
          isPublished: document.isPublished,
        }}
      />
      <DeleteSection
        what={`el documento ${document.title}`}
        description="Se borra también su PDF. Para retirarlo un tiempo, mejor déjalo como borrador."
        action={eliminarDocumento.bind(null, document.id)}
        redirectTo="/admin/club/documentos"
        buttonLabel="Eliminar documento"
        successMessage="Documento eliminado."
      />
    </>
  )
}
