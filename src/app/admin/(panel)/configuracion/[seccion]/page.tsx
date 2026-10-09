import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { guardarConfiguracion } from '@/features/settings/actions'
import { getSettingsAdmin } from '@/features/settings/admin-queries'
import { SettingsForm } from '@/features/settings/components/forms'
import { isSettingsSection, SETTINGS_SECTIONS } from '@/features/settings/sections'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Configuración' }

export default async function SettingsSectionPage({ params }: { params: Promise<{ seccion: string }> }) {
  await requirePanelUser('settings:write')
  const { seccion } = await params
  if (!isSettingsSection(seccion)) notFound()
  const settings = await getSettingsAdmin()
  if (!settings) notFound()
  const section = SETTINGS_SECTIONS[seccion]

  return (
    <>
      <PageHeader
        title={section.label}
        description={
          seccion === 'club'
            ? `${section.description} La fecha de fundación (${settings.foundedOn}) es fija.`
            : section.description
        }
        back={{ href: '/admin/configuracion', label: 'Configuración' }}
      />
      <SettingsForm
        section={seccion}
        action={guardarConfiguracion.bind(null, seccion)}
        defaults={settings.forms[seccion]}
        options={settings.options}
        previews={settings.previews}
      />
    </>
  )
}
