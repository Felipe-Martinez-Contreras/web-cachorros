import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { PanelShell } from '@/components/admin/panel-shell'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Panel Los Cachorros' },
  robots: { index: false, follow: false },
}

// El panel bloquea en el servidor a propósito: sin un <Suspense> con esqueleto no hay un «shell»
// prerenderado en el build, y así todos sus scripts llevan el nonce de la CSP de cada petición (9.3).
// Un esqueleto prerenderado saldría con scripts sin nonce.
export const instant = false

/** Verifica la sesión en el servidor en cada carga (el proxy solo redirige de forma optimista). */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  // El layout también envuelve «Mi cuenta»: cada página decide si exige los dos pasos.
  const user = await requirePanelUser('panel:access', { allowWithoutTwoFactor: true })
  return <PanelShell user={user}>{children}</PanelShell>
}
