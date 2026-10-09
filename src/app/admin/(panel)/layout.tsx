import type { Metadata } from 'next'
import { type ReactNode, Suspense } from 'react'
import { PanelShell } from '@/components/admin/panel-shell'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Panel Los Cachorros' },
  robots: { index: false, follow: false },
}

function PanelSkeleton() {
  return (
    <div className="min-h-svh bg-neutral-50">
      <div className="h-[73px] border-b border-neutral-200 bg-paper" />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  )
}

/** Verifica la sesión en el servidor en cada carga (el proxy solo redirige de forma optimista). */
async function AuthorizedPanel({ children }: { children: ReactNode }) {
  const user = await requirePanelUser()
  return <PanelShell user={user}>{children}</PanelShell>
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AuthorizedPanel>{children}</AuthorizedPanel>
    </Suspense>
  )
}
