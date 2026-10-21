// `pnpm pwa:icons [archivo]`: genera los íconos de la PWA (especificación 6.16) desde el escudo del club y
// los deja en public/icons/ (se commitean). Por defecto usa public/placeholder/escudo.svg (o escudo.png).
// Vuelve a correrlo si el club entrega un escudo nuevo.
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

// Blanco, como el disco de `.crest`: las letras negras del escudo no se leen sobre fondo oscuro.
const PAPER = '#ffffff'
const OUT_DIR = path.resolve('public', 'icons')

function source(): string {
  const given = process.argv[2]
  if (given) return path.resolve(given)
  for (const name of ['escudo.svg', 'escudo.png']) {
    const candidate = path.resolve('public', 'placeholder', name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    'No se encontró el escudo: pasa la ruta del archivo o deja escudo.svg en public/placeholder.',
  )
}

/** El escudo centrado en un lienzo cuadrado, ocupando `scale` del lado, sobre `background`. */
async function icon(input: string, size: number, scale: number, background: string | null, file: string) {
  const inner = Math.round(size * scale)
  const crest = await sharp(input, { density: 300, limitInputPixels: false })
    .resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: crest, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, file))
  console.log(`  ${file} (${size} × ${size})`)
}

async function main() {
  const input = source()
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`Íconos de la PWA desde ${path.relative(process.cwd(), input)}:`)
  // «any»: el escudo con transparencia, casi a borde.
  await icon(input, 192, 0.92, null, 'icon-192.png')
  await icon(input, 512, 0.92, null, 'icon-512.png')
  // «maskable»: Android recorta hasta un círculo del 80 %; el escudo queda dentro de la zona segura.
  await icon(input, 512, 0.62, PAPER, 'icon-maskable-512.png')
  // iOS rellena la transparencia con negro y redondea las esquinas: fondo blanco y margen.
  await icon(input, 180, 0.78, PAPER, 'apple-touch-icon.png')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
