import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { crearRegistroDeHistoria } from '@/features/history/actions'
import { HistoryForm } from '@/features/history/components/forms'
import { EMPTY_HISTORY_DEFAULTS } from '@/features/history/form-defaults'
import { historySeriesOptions } from '@/features/history/queries'
import { HISTORY_SECTIONS, isHistorySection } from '@/features/history/sections'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Agregar a Historia' }

export default async function NewHistoryRecordPage({ params }: { params: Promise<{ seccion: string }> }) {
  await requirePanelUser('history:write')
  const { seccion } = await params
  if (!isHistorySection(seccion)) notFound()
  const section = HISTORY_SECTIONS[seccion]

  return (
    <>
      <PageHeader
        title={section.newLabel}
        back={{ href: `/admin/historia/${seccion}`, label: section.label }}
      />
      <HistoryForm
        action={crearRegistroDeHistoria.bind(null, seccion)}
        form={EMPTY_HISTORY_DEFAULTS[seccion]}
        image={null}
        seriesOptions={seccion === 'titulos' ? await historySeriesOptions() : []}
      />
    </>
  )
}
