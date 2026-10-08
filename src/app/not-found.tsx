import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Página no encontrada' }

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="text-center">
        <p className="font-display text-[clamp(3rem,14vw,7rem)] font-black leading-none [font-stretch:62.5%]">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold">Este balón se fue fuera de la cancha</h1>
        <p className="mt-2 text-neutral-600">La página que buscas no existe o cambió de lugar.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-ink px-5 font-semibold text-paper"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
