import type { NextConfig } from 'next'
import { CSP_HEADER, publicCsp } from './src/lib/csp'

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  poweredByHeader: false,
  // Sin optimizador de imágenes en runtime (especificación 2.7): las variantes se generan al subir.
  images: { unoptimized: true },
  serverExternalPackages: ['pino', 'postgres', 'sharp'],
  // Las tarjetas para redes leen sus fuentes TTF en runtime (trampa 8): deben llegar al output standalone.
  outputFileTracingIncludes: { '/api/share/**': ['./src/assets/fonts/og/*.ttf'] },
  // CSP del sitio público (9.3), obligatoria, fija y compatible con la caché. El panel lleva la suya, con nonce, desde
  // proxy.ts: por eso se excluye aquí. /media (los PDF llevan su propia CSP `sandbox`) y /api (JSON, imágenes y
  // archivos, no páginas) tampoco la llevan.
  async headers() {
    return [
      {
        source: '/((?!admin|media/|api/).*)',
        headers: [{ key: CSP_HEADER, value: publicCsp({ dev: process.env.NODE_ENV === 'development' }) }],
      },
    ]
  },
  experimental: {
    // El CSS (≈ 9 KB comprimido) viaja dentro del HTML: se ahorra una petición que bloqueaba el primer
    // pintado ≈ 0,7 s en una red 4G lenta (medido en la Fase 1; ver docs/fases/fase-1.md).
    inlineCss: true,
  },
}

export default nextConfig
