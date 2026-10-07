import type { Metadata } from 'next'
import { ClubIdentityForm } from '@/features/settings/components/club-identity-form'
import { getClubIdentity } from '@/features/settings/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Inicio' }

export default async function AdminHomePage() {
  const user = await requirePanelUser()
  const identity = await getClubIdentity()

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Inicio</h1>

      <section aria-labelledby="club-heading" className="rounded-lg border border-neutral-200 bg-paper p-4">
        <h2 id="club-heading" className="mb-4 text-lg font-bold">
          Datos del club
        </h2>
        {identity && can(user, 'settings:write') ? (
          <ClubIdentityForm initial={identity} />
        ) : (
          <p className="text-neutral-600">
            Todavía no hay datos del club cargados. Avisa a soporte para que revise la instalación.
          </p>
        )}
      </section>

      <section aria-labelledby="system-heading" className="rounded-lg border border-neutral-200 bg-paper p-4">
        <h2 id="system-heading" className="mb-2 text-lg font-bold">
          Estado del sistema
        </h2>
        <p className="text-neutral-600">
          Versión instalada: <span className="font-medium text-ink">{env.APP_VERSION}</span>
        </p>
      </section>
    </div>
  )
}
