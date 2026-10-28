import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/admin/resource-list'
import {
  facebookStatus,
  recentlyDiscardedScheduled,
  scheduledPublications,
} from '@/features/social-publishing/admin-queries'
import {
  DiscardedNotice,
  FacebookTabs,
  ScheduledNotice,
} from '@/features/social-publishing/components/facebook-notices'
import { ScheduledRow } from '@/features/social-publishing/components/scheduled-row'
import { requirePanelUser } from '@/lib/auth/session'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Facebook: programadas' }

export default async function FacebookScheduledPage() {
  const user = await requirePanelUser('social:write')
  const [status, scheduled, discarded] = await Promise.all([
    facebookStatus(),
    scheduledPublications(),
    recentlyDiscardedScheduled(),
  ])

  return (
    <>
      <PageHeader
        title="Facebook"
        description="Lo que sale en la página del club. Cada jornada o partido se programa desde su página."
      />
      <FacebookTabs current="/admin/facebook" canConfigure={can(user, 'settings:write')} />
      <div className="grid gap-6">
        <ScheduledNotice notice={status.scheduledNotice} />
        <DiscardedNotice items={discarded} />
        <section aria-labelledby="programadas" className="grid gap-3">
          <h2 id="programadas" className="text-lg font-bold">
            Programadas
          </h2>
          {scheduled.length === 0 ? (
            <p className="text-neutral-600">
              No hay nada programado. Para programar una jornada, ábrela desde{' '}
              <Link href="/admin/partidos" className="font-semibold text-link underline">
                Partidos
              </Link>{' '}
              y usa su sección «Publicar en Facebook».
            </p>
          ) : (
            <ul className="grid gap-4" aria-label="Publicaciones programadas en Facebook">
              {scheduled.map((publication) => (
                <ScheduledRow key={publication.id} publication={publication} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
