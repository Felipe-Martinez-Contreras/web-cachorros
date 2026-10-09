import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/** Contenido de la página 404 del club (especificación 3.6); va dentro del marco del sitio. */
export function NotFoundContent() {
  return (
    <section className="grid min-h-[70svh] place-items-center">
      <div className="container-site section-y grid justify-items-center gap-3 text-center">
        <p className="text-score" aria-hidden="true">
          404
        </p>
        <h1 className="text-h2">Este balón se fue fuera de la cancha</h1>
        <p className="max-w-md text-(--muted)">La página que buscas no existe o cambió de lugar.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: 'dark' })}>
            Volver al inicio
          </Link>
          <Link href="/partidos" className={buttonVariants({ variant: 'outline' })}>
            Ver los partidos
          </Link>
        </div>
      </div>
    </section>
  )
}
