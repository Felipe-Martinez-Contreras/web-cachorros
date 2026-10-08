import type { Metadata } from 'next'
import Link from 'next/link'
import { type ReactNode, Suspense } from 'react'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Panel Los Cachorros' },
  robots: { index: false, follow: false },
}

function PanelSkeleton() {
  return (
    <div className="min-h-svh bg-neutral-50">
      <div className="h-[73px] border-b border-neutral-200 bg-paper" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  )
}

/** Verifica la sesión en el servidor en cada carga (el proxy solo redirige de forma optimista). */
async function PanelShell({ children }: { children: ReactNode }) {
  const user = await requirePanelUser()
  return (
    <div className="min-h-svh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="font-display text-lg font-extrabold uppercase [font-stretch:75%]">
            Panel Los Cachorros
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="mb-6 text-sm text-neutral-600">
          Sesión de <span className="font-medium text-ink">{user.name || user.email}</span>
        </p>
        {children}
      </main>
    </div>
  )
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  )
}
