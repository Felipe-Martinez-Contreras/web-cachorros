import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/** Metadatos de una página provisional: con título y fuera de los buscadores. */
export function comingSoonMetadata(title: string): Metadata {
  return { title, robots: { index: false } }
}

/** Página provisional de las secciones que se construyen en las fases siguientes. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="theme-dark grid min-h-[70svh] place-items-center">
      <div className="container-site section-y grid justify-items-center gap-4 text-center">
        <p className="text-eyebrow text-accent">Próximamente</p>
        <h1 className="text-h1">{title}</h1>
        <p className="max-w-[48ch] text-lg text-(--muted)">
          Estamos preparando esta sección del sitio. Mientras tanto, revisa los partidos y las noticias en la
          portada.
        </p>
        <Link href="/" className={buttonVariants({ variant: 'primary' })}>
          Volver al inicio
        </Link>
      </div>
    </section>
  )
}
