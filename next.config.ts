import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  poweredByHeader: false,
  // Sin optimizador de imágenes en runtime (especificación 2.7): las variantes se generan al subir.
  images: { unoptimized: true },
  serverExternalPackages: ['pino', 'postgres', 'sharp'],
  experimental: {
    // El CSS (≈ 9 KB comprimido) viaja dentro del HTML: se ahorra una petición que bloqueaba el primer
    // pintado ≈ 0,7 s en una red 4G lenta (medido en la Fase 1; ver docs/fases/fase-1.md).
    inlineCss: true,
  },
}

export default nextConfig
