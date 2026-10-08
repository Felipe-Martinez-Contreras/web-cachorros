'use client' // Cliente: los límites de error de Next deben ser componentes de cliente.

import { Button, buttonVariants } from '@/components/ui/button'

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="grid min-h-[70svh] place-items-center">
      <div className="container-site section-y grid justify-items-center gap-3 text-center">
        <p className="text-eyebrow text-(--link)">Tarjeta amarilla para el sitio</p>
        <h1 className="text-h2">No pudimos cargar esta página</h1>
        <p className="max-w-[48ch] text-(--muted)">
          Fue un problema nuestro, no tuyo. Inténtalo de nuevo en unos segundos.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button variant="dark" onClick={reset}>
            Reintentar
          </Button>
          {/* Enlace normal: una recarga completa también sirve si falló la navegación del cliente. */}
          <a href="/" className={buttonVariants({ variant: 'outline' })}>
            Volver al inicio
          </a>
        </div>
      </div>
    </section>
  )
}
