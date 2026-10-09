import type { Metadata } from 'next'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/feedback'
import { getSettingsAdmin } from '@/features/settings/admin-queries'
import { SETTINGS_SECTION_KEYS, SETTINGS_SECTIONS } from '@/features/settings/sections'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Configuración' }

export default async function SettingsPage() {
  await requirePanelUser('settings:write')
  const settings = await getSettingsAdmin()

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Los datos del club que usa todo el sitio. Cada cambio se ve en la siguiente carga."
      />
      {settings === null ? (
        <Alert variant="warning" title="Falta la configuración inicial">
          Todavía no hay datos del club cargados. Avisa a soporte para que revise la instalación.
        </Alert>
      ) : (
        <ResourceList label="Secciones de Configuración">
          {SETTINGS_SECTION_KEYS.map((key) => {
            const values = Object.values(settings.forms[key])
            return (
              <ResourceRow
                key={key}
                title={SETTINGS_SECTIONS[key].label}
                href={`/admin/configuracion/${key}`}
                subtitle={SETTINGS_SECTIONS[key].description}
                badges={
                  <>
                    {values.every((value) => value === '') && <Badge variant="accent">Sin datos</Badge>}
                    {/* El seed deja marcadores `[COMPLETAR: …]` donde falta el dato real del club. */}
                    {values.some((value) => value.includes('[COMPLETAR')) && (
                      <Badge variant="soft">Falta completar</Badge>
                    )}
                  </>
                }
              />
            )
          })}
        </ResourceList>
      )}
    </>
  )
}
