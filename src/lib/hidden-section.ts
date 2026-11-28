import { notFound } from 'next/navigation'
import { isSectionHidden, type SectionKey } from '@/config/secciones'

/**
 * Segunda barrera en la página de una sección oculta (la primera es `proxy.ts`, que responde 404 antes del
 * render). Va después de `connection()`: el build no decide nada de una sección.
 */
export function hideIfHidden(key: SectionKey): void {
  if (isSectionHidden(key)) notFound()
}
