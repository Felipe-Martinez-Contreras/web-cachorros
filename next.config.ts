import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  poweredByHeader: false,
  // Sin optimizador de imágenes en runtime (especificación 2.7): las variantes se generan al subir.
  images: { unoptimized: true },
  serverExternalPackages: ['pino', 'postgres', 'sharp'],
}

export default nextConfig
