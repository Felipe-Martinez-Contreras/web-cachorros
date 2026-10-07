import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Panel Los Cachorros' },
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-neutral-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-paper p-6">
        <p className="font-display text-sm font-extrabold uppercase tracking-wide text-neutral-600 [font-stretch:75%]">
          Club Deportivo Los Cachorros
        </p>
        {children}
      </div>
    </main>
  )
}
