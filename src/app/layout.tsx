import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import { type ReactNode, Suspense } from 'react'
import { rootMetadata } from '@/features/seo/metadata'
import '@/styles/globals.css'

// Una sola familia variable (peso y ancho), autoalojada por next/font (especificación 4.3).
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
})

// Nada que dependa del dominio o de la base se resuelve en el build (especificación 3.7).
export function generateMetadata(): Promise<Metadata> {
  return rootMetadata()
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0c',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // El <Suspense> envuelve el documento completo: las páginas con datos (que se leen en runtime, nunca
    // en el build) se entregan como HTML terminado, sin esqueletos que después reemplace un script. Así
    // el sitio público muestra su contenido con JavaScript deshabilitado (especificación 3.3).
    <Suspense fallback={null}>
      <html lang="es-CL" className={archivo.variable}>
        <body className="min-h-svh antialiased">{children}</body>
      </html>
    </Suspense>
  )
}
