import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { getClicksReport } from '@/features/sponsors/admin-queries'
import { adjacentMonths, monthLabel, reportMonth } from '@/features/sponsors/lib/month'
import { SPONSORS_TABS } from '@/features/sponsors/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { formatDayMonthNumeric, formatNumber, fromIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Reporte de clics' }

export default async function ClicksReportPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  await requirePanelUser('sponsors:write')
  const month = reportMonth((await searchParams).mes)
  const { previous, next } = adjacentMonths(month)
  const report = await getClicksReport(month)

  return (
    <>
      <PageHeader
        title="Reporte de clics"
        description="Cuántas veces se abrieron los enlaces de cada auspiciador desde el sitio. Son conteos por día, sin datos de las personas."
        action={
          <a
            href={`/api/admin/exportar/clics-auspiciadores?mes=${month}`}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <Download aria-hidden="true" /> Exportar CSV
          </a>
        }
      />
      <SectionTabs
        label="Secciones de Auspiciadores"
        current="/admin/auspiciadores/reporte"
        tabs={SPONSORS_TABS}
      />
      <nav aria-label="Mes del reporte" className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={`?mes=${previous}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <ChevronLeft aria-hidden="true" /> Mes anterior
        </Link>
        <h2 className="px-2 text-lg font-bold">{monthLabel(month)}</h2>
        <Link href={`?mes=${next}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Mes siguiente <ChevronRight aria-hidden="true" />
        </Link>
      </nav>
      {report.sponsors.length === 0 ? (
        <EmptyState title="Sin clics este mes">
          Los clics aparecen aquí apenas alguien abre un enlace.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <p className="text-lg">
            <strong>{formatNumber(report.total)}</strong> clics en total.
          </p>
          {report.sponsors.map((sponsor) => (
            <section key={sponsor.id} aria-labelledby={`clics-${sponsor.id}`} className="grid gap-2">
              <h3 id={`clics-${sponsor.id}`} className="font-bold">
                {sponsor.name}: {formatNumber(sponsor.total)} clics
              </h3>

              <table className="w-full max-w-md text-left">
                <caption className="sr-only">Clics por día de {sponsor.name}</caption>
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th scope="col" className="py-2 pr-6">
                      Día
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Clics
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sponsor.days.map((day) => (
                    <tr key={day.day} className="border-b border-neutral-200">
                      <td className="py-2 pr-6">{formatDayMonthNumeric(fromIsoDate(day.day))}</td>
                      <td className="py-2 text-right tabular-nums">{formatNumber(day.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
