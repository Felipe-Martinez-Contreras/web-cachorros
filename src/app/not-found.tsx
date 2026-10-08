import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Página no encontrada' }

/**
 * 404 de cualquier dirección que no existe. Es una página estática (responde con estado 404 real) y por
 * eso no lleva el encabezado del sitio, que necesita datos de la BD.
 */
export default function NotFound() {
  return (
    <main className="theme-dark grid min-h-svh place-items-center px-4">
      <div className="grid justify-items-center gap-3 text-center">
        <p className="text-eyebrow text-accent">Club Deportivo Los Cachorros · Desde 1934</p>
        <p className="text-score" aria-hidden="true">
          404
        </p>
        <h1 className="text-h2">Este balón se fue fuera de la cancha</h1>
        <p className="max-w-[48ch] text-(--muted)">La página que buscas no existe o cambió de lugar.</p>
        <Link href="/" className={buttonVariants({ variant: 'primary', className: 'mt-2' })}>
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
