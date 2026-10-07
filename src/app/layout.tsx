import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import type { ReactNode } from 'react'
import '@/styles/globals.css'

// Una sola familia variable (peso y ancho), autoalojada por next/font (especificación 4.3).
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
})

export const metadata: Metadata = {
  title: {
    default: 'Club Deportivo Los Cachorros',
    template: '%s | Club Deportivo Los Cachorros',
  },
  description: 'Club Deportivo Los Cachorros de Sagrada Familia. Desde 1934.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0c',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL" className={archivo.variable}>
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  )
}
