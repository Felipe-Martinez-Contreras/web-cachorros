import Link from 'next/link'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Alert } from '@/components/ui/feedback'
import type { DiscardedScheduledDTO } from '../admin-queries'

/** Pestañas de la sección Facebook (Ajustes solo con permiso de configuración). */
export function FacebookTabs({ current, canConfigure }: { current: string; canConfigure: boolean }) {
  return (
    <SectionTabs
      label="Secciones de Facebook"
      current={current}
      tabs={[
        { href: '/admin/facebook', label: 'Programadas' },
        { href: '/admin/facebook/publicadas', label: 'Publicadas' },
        ...(canConfigure ? [{ href: '/admin/facebook/ajustes', label: 'Ajustes' }] : []),
      ]}
    />
  )
}

/** «Facebook está desactivado: lo programado no saldrá…» (o el motivo técnico). */
export function ScheduledNotice({ notice }: { notice: string | null }) {
  if (!notice) return null
  return (
    <Alert variant="warning" title="Lo programado no saldrá">
      {notice}
    </Alert>
  )
}

/** Programadas que un seguro descartó hace poco: qué era, el motivo y dónde volver a programarla. */
export function DiscardedNotice({ items }: { items: DiscardedScheduledDTO[] }) {
  if (items.length === 0) return null
  return (
    <Alert
      variant="warning"
      title={
        items.length === 1
          ? 'Una publicación programada no saldrá'
          : 'Publicaciones programadas que no saldrán'
      }
    >
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <span className="font-semibold">{item.subject}.</span> {item.reason}{' '}
            <Link href={item.href} className="font-semibold text-link underline">
              Revisar y volver a programar
            </Link>
          </li>
        ))}
      </ul>
    </Alert>
  )
}
