import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarRegistroDeHistoria, eliminarRegistroDeHistoria } from '@/features/history/actions'
import { HistoryForm } from '@/features/history/components/forms'
import { getHistoryAdmin, historySeriesOptions } from '@/features/history/queries'
import { HISTORY_SECTIONS, isHistorySection } from '@/features/history/sections'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar Historia' }

type Props = { params: Promise<{ seccion: string; id: string }> }

export default async function EditHistoryRecordPage({ params }: Props) {
  await requirePanelUser('history:write')
  const { seccion, id } = await params
  if (!isHistorySection(seccion)) notFound()
  const record = isUuid(id) ? await getHistoryAdmin(seccion, id) : null
  if (!record) notFound()
  const section = HISTORY_SECTIONS[seccion]
  const list = `/admin/historia/${seccion}`

  return (
    <>
      <PageHeader title={`Editar ${section.one}`} back={{ href: list, label: section.label }} />
      <HistoryForm
        action={actualizarRegistroDeHistoria.bind(null, seccion, id)}
        form={record}
        image={record.image}
        seriesOptions={seccion === 'titulos' ? await historySeriesOptions() : []}
      />
      <DeleteSection
        what={`«${record.name}»`}
        description="Deja de verse en la página de Historia. Su foto sigue en la biblioteca de medios."
        action={eliminarRegistroDeHistoria.bind(null, seccion, id)}
        redirectTo={list}
        buttonLabel={`Eliminar ${section.one}`}
        successMessage="Eliminado."
      />
    </>
  )
}
