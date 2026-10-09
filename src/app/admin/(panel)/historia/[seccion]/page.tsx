import { ArrowDown, ArrowUp, Landmark } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { moverRegistroDeHistoria } from '@/features/history/actions'
import { listHistoryAdmin } from '@/features/history/queries'
import { HISTORY_SECTION_KEYS, HISTORY_SECTIONS, isHistorySection } from '@/features/history/sections'
import { requirePanelUser } from '@/lib/auth/session'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Historia' }

export default async function HistorySectionPage({ params }: { params: Promise<{ seccion: string }> }) {
  await requirePanelUser('history:write')
  const { seccion } = await params
  if (!isHistorySection(seccion)) notFound()
  const section = HISTORY_SECTIONS[seccion]
  const rows = await listHistoryAdmin(seccion)

  return (
    <>
      <PageHeader
        title="Historia"
        description={section.description}
        action={<NewLink href={`/admin/historia/${seccion}/nuevo`}>{section.newLabel}</NewLink>}
      />
      <nav aria-label="Secciones de Historia" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {HISTORY_SECTION_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={`/admin/historia/${key}`}
                aria-current={key === seccion ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center rounded-md border border-neutral-300 px-4 font-medium',
                  key === seccion && 'border-ink bg-ink text-paper',
                )}
              >
                {HISTORY_SECTIONS[key].label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon={<Landmark aria-hidden="true" />} title={`Todavía no hay nada en ${section.label}`}>
          {section.empty}
        </EmptyState>
      ) : (
        <ResourceList label={section.label}>
          {rows.map((row, index) => (
            <ResourceRow
              key={row.id}
              title={row.title}
              href={`/admin/historia/${seccion}/${row.id}`}
              subtitle={row.subtitle}
              badges={row.isPlaceholder && <Badge variant="soft">Por confirmar</Badge>}
              media={
                row.thumb?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.thumb.thumb} alt="" className="size-14 rounded-md object-cover" />
                ) : undefined
              }
              actions={
                section.sortable && (
                  <>
                    <ActionButton
                      action={moverRegistroDeHistoria.bind(null, seccion, row.id, 'subir')}
                      size="icon"
                      disabled={index === 0}
                      aria-label={`Subir ${row.title}`}
                    >
                      <ArrowUp aria-hidden="true" />
                    </ActionButton>
                    <ActionButton
                      action={moverRegistroDeHistoria.bind(null, seccion, row.id, 'bajar')}
                      size="icon"
                      disabled={index === rows.length - 1}
                      aria-label={`Bajar ${row.title}`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </ActionButton>
                  </>
                )
              }
            />
          ))}
        </ResourceList>
      )}
      <p className="mt-6">
        <a href={section.publicHref} className="inline-flex min-h-12 items-center underline">
          Ver {section.label.toLowerCase()} en el sitio
        </a>
      </p>
    </>
  )
}
