import { WifiOff } from 'lucide-react'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false, follow: false },
}

/**
 * Respaldo del service worker cuando una página no carga por falta de señal (especificación 6.16). El SW
 * la guarda al instalarse; no tiene datos que puedan quedar viejos.
 */
export default function OfflinePage() {
  return (
    <section className="container-site grid justify-items-start gap-4 py-16 md:py-24">
      <WifiOff aria-hidden="true" className="size-12 text-(--muted)" />
      <h1 className="text-h1 uppercase">Sin conexión</h1>
      <p className="max-w-prose text-lg">
        No pudimos cargar esta página: parece que no tienes señal. Cuando vuelva la conexión, inténtalo de
        nuevo.
      </p>
      {/* Un enlace (no un botón): funciona sin JavaScript y vuelve a pedir la portada a la red. */}
      <a href="/" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        Volver a intentar
      </a>
    </section>
  )
}
