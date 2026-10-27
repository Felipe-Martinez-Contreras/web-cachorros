import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { cambiarEstiloEscudo } from '@/features/teams/actions'
import { CrestStylePicker } from '@/features/teams/components/crest-style-picker'
import { listTeamsAdmin } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { crestCardStyleLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Escudos en las tarjetas' }

const STYLES = Object.keys(crestCardStyleLabels) as (keyof typeof crestCardStyleLabels)[]

/**
 * Todos los equipos (el club primero) con su escudo tal como sale en las tarjetas para redes, que son negras,
 * y sus tres variantes para elegir ahí mismo. El sitio no cambia: sigue mostrando los escudos a color.
 */
export default async function CrestCardsPage() {
  await requirePanelUser('sport:write')
  const rows = await listTeamsAdmin()

  return (
    <>
      <PageHeader
        title="Escudos en las tarjetas"
        description="Así se ven los escudos sobre el fondo negro de las tarjetas para Facebook e Instagram. Si los colores de uno no combinan o se pierden, elige blanco o grises: se guarda al tocarlo. El sitio los sigue mostrando a color."
        back={{ href: '/admin/rivales', label: 'Rivales' }}
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid content-start gap-3 rounded-lg border border-neutral-300 bg-paper p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold">{row.name}</h2>
              {row.isOwnClub && <Badge variant="dark">Club propio</Badge>}
            </div>
            {row.crest ? (
              <CrestStylePicker
                team={row.name}
                current={row.cardCrestStyle}
                action={cambiarEstiloEscudo.bind(null, row.id)}
                previews={
                  Object.fromEntries(
                    STYLES.map((style) => [
                      style,
                      `/api/admin/escudos/${row.id}/${style}?v=${row.crest?.id}`,
                    ]),
                  ) as Record<(typeof STYLES)[number], string>
                }
              />
            ) : (
              <p className="text-sm text-neutral-600">
                Sin escudo: en las tarjetas van sus iniciales en un círculo blanco. Súbelo desde{' '}
                <Link href={`/admin/rivales/${row.id}`} className="underline">
                  su ficha
                </Link>
                .
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
