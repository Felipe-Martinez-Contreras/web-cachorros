import 'server-only'
import type { crestCardStyle } from '@/db/schema/enums'
import { crestScale, measureLogo } from '@/lib/images/crest'

// Escudo para las tarjetas matchday (fondo negro, sin disco blanco). Corre dentro de la cola de sharp
// (`runHeavy`), sobre el PNG de 512 px (contenido en el cuadrado, con margen transparente):
//   - fondo blanco (las esquinas de lo visible lo son): se quita el blanco conectado al borde;
//   - fondo de color (esquinas opacas): se recorta en círculo con un anillo blanco fino, un «disco discreto»;
//   - partes oscuras que se pierden sobre negro: contorno claro y un resplandor gris detrás;
//   - monocromo (`blanco` o `grises`, por equipo en Panel → Rivales): para colores que rompen la paleta.
// El sitio no usa nada de esto: mantiene sus discos.

export type CrestCardStyle = (typeof crestCardStyle.enumValues)[number]
/** Cómo se salvan las partes oscuras: contorno claro con resplandor (por defecto) o solo resplandor. */
export type DarkTreatment = 'contorno' | 'resplandor'

export type CardCrestImage = { src: string; scale: number }

type Rgba = { data: Uint8ClampedArray; width: number; height: number }

/** Casi blanco: lo que se quita de un fondo blanco (con tolerancia para el suavizado del borde). */
const BG_WHITE = 225
/** Lo oscuro que se pierde sobre el negro de la tarjeta. */
const DARK_LUMA = 60
/** Desde qué fracción de lo visible oscuro se agrega el contorno. */
const DARK_SHARE = 0.08
/** Margen alrededor del escudo para el contorno y el resplandor (fracción del lado). */
const PAD = 0.05

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/**
 * Escudo tratado para la tarjeta como *data URI* PNG y su escala en la caja (`crestScale().bare`, con el
 * margen del contorno incluido). `null` si sharp no puede leerlo (la tarjeta usa el escudo tal cual).
 */
export async function cardCrestImage(
  png: Buffer,
  options: {
    style: CrestCardStyle
    dark?: DarkTreatment
  },
): Promise<CardCrestImage | null> {
  const { default: sharp } = await import('sharp')
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const image: Rgba = { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
  const box = visibleBox(image)
  if (!box) return null

  const background = backgroundOf(image, box)
  if (background === 'blanco') removeWhiteBackground(image, box)
  if (options.style === 'blanco') toWhite(image)
  if (options.style === 'grises') toLightGray(image)
  if (background === 'color') circleCrop(image, box)

  const side = Math.max(image.width, image.height)
  const pad = Math.round(side * PAD)
  const padded = withMargin(image, pad)
  const halo =
    options.style === 'color' && background !== 'color' && darkShare(image) > DARK_SHARE
      ? (options.dark ?? 'contorno')
      : null
  const output = halo ? await withHalo(padded, side, halo === 'contorno') : padded

  const out = await sharp(Buffer.from(output.data.buffer), {
    raw: { width: output.width, height: output.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()
  // La escala óptica es la del escudo; el lienzo creció con el margen, así que se agranda en proporción.
  const optical =
    background === 'color'
      ? crestScale(1, 1, { v: 1, coverage: Math.PI / 4, radius: 0.5 }).bare
      : bareScale(image, box, options.style)
  return {
    src: `data:image/png;base64,${out.toString('base64')}`,
    scale: Math.round(optical * (output.width / side) * 1000) / 1000,
  }
}

type Box = { left: number; top: number; right: number; bottom: number }

/**
 * Escala sin disco medida sobre el escudo ya tratado (sin su fondo blanco). Sobre el negro se percibe la
 * tinta: la cobertura por filas de `measureLogo` cuenta como lleno lo que hay entre dos trazos (un león con
 * letras finas alrededor), así que se combina con la de píxeles visibles. El tope de `crestScale` se respeta.
 */
function bareScale(image: Rgba, box: Box, style: CrestCardStyle): number {
  const width = box.right - box.left + 1
  const height = box.bottom - box.top + 1
  const data = new Uint8Array(width * height * 4)
  let ink = 0
  for (let y = 0; y < height; y++) {
    const from = ((box.top + y) * image.width + box.left) * 4
    const row = image.data.subarray(from, from + width * 4)
    data.set(row, y * width * 4)
    for (let x = 0; x < width; x++) if ((row[x * 4 + 3] ?? 0) >= 128) ink++
  }
  const measured = measureLogo({ data, width, height })
  // En blanco sobre negro lo blanco sí se ve: la medida por filas ignora lo casi blanco, aquí no.
  const pixels = ink / (width * height)
  const rows = style === 'color' ? measured.coverage : Math.max(measured.coverage, pixels)
  const coverage = Math.sqrt(rows * Math.min(pixels, rows))
  return crestScale(width, height, { v: 1, coverage, radius: measured.radius }).bare
}

/** Rectángulo de lo visible (el PNG de 512 px trae margen transparente si el escudo no es cuadrado). */
function visibleBox({ data, width, height }: Rgba): Box | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) < 16) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  return right < 0 ? null : { left, top, right, bottom }
}

/** Fondo del escudo según las esquinas de lo visible: transparente, blanco o de color. */
function backgroundOf(image: Rgba, box: Box): 'transparente' | 'blanco' | 'color' {
  const corners = [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
  ] as const
  const pixel = (x: number, y: number) => {
    const i = (y * image.width + x) * 4
    return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0, image.data[i + 3] ?? 0]
  }
  const opaque = corners.map(([x, y]) => pixel(x, y)).filter(([, , , a]) => (a ?? 0) >= 240)
  if (opaque.length < 4) return 'transparente'
  return opaque.every(([r, g, b]) => (r ?? 0) >= BG_WHITE && (g ?? 0) >= BG_WHITE && (b ?? 0) >= BG_WHITE)
    ? 'blanco'
    : 'color'
}

/** Quita el blanco conectado al borde de lo visible (relleno desde el contorno): lo de adentro se conserva. */
function removeWhiteBackground(image: Rgba, box: Box): void {
  const { data, width } = image
  const seen = new Uint8Array(width * image.height)
  const stack: number[] = []
  const isWhite = (p: number) =>
    (data[p * 4] ?? 0) >= BG_WHITE && (data[p * 4 + 1] ?? 0) >= BG_WHITE && (data[p * 4 + 2] ?? 0) >= BG_WHITE
  const push = (x: number, y: number) => {
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) return
    const p = y * width + x
    if (seen[p] || !isWhite(p)) return
    seen[p] = 1
    stack.push(p)
  }
  for (let x = box.left; x <= box.right; x++) {
    push(x, box.top)
    push(x, box.bottom)
  }
  for (let y = box.top; y <= box.bottom; y++) {
    push(box.left, y)
    push(box.right, y)
  }
  while (stack.length > 0) {
    const p = stack.pop() as number
    data[p * 4 + 3] = 0
    const x = p % width
    const y = (p - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
}

/**
 * Monocromo blanco, como un sello: lo claro y lo medio en blanco pleno y lo oscuro (letras, contornos)
 * calado, casi transparente. Así el dibujo se sigue leyendo sobre el negro.
 */
function toWhite({ data }: Rgba): void {
  for (let i = 0; i < data.length; i += 4) {
    const light = luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) / 255
    const solid = Math.min(1, Math.max(0, (light - 0.18) / 0.2))
    data[i + 3] = Math.round((data[i + 3] ?? 0) * (0.12 + 0.88 * solid))
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
  }
}

/** Monocromo en grises aclarados: lo más oscuro queda gris medio, así nada se pierde sobre el negro. */
function toLightGray({ data }: Rgba): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(96 + luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) * 0.62)
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }
}

/** Escudo de fondo de color: círculo inscrito en lo visible, con un anillo blanco fino al 35 %. */
function circleCrop(image: Rgba, box: Box): void {
  const { data, width, height } = image
  const cx = (box.left + box.right + 1) / 2
  const cy = (box.top + box.bottom + 1) / 2
  const radius = Math.min(box.right - box.left + 1, box.bottom - box.top + 1) / 2
  const ring = Math.max(2, radius * 0.035)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      // Borde suavizado de un píxel.
      const inside = Math.min(1, Math.max(0, radius - distance))
      data[i + 3] = Math.round((data[i + 3] ?? 0) * inside)
      const onRing = Math.min(1, Math.max(0, ring - (radius - distance))) * inside * 0.35
      if (onRing > 0) {
        for (let c = 0; c < 3; c++) data[i + c] = Math.round((data[i + c] ?? 0) * (1 - onRing) + 255 * onRing)
      }
    }
  }
}

/** Fracción de lo visible que es oscuro (se perdería sobre el negro). */
function darkShare({ data }: Rgba): number {
  let visible = 0
  let dark = 0
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 128) continue
    visible++
    if (luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) < DARK_LUMA) dark++
  }
  return visible === 0 ? 0 : dark / visible
}

function withMargin(image: Rgba, pad: number): Rgba {
  const width = image.width + pad * 2
  const height = image.height + pad * 2
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < image.height; y++) {
    const from = y * image.width * 4
    data.set(image.data.subarray(from, from + image.width * 4), ((y + pad) * width + pad) * 4)
  }
  return { data, width, height }
}

/**
 * Contorno claro (la silueta engrosada, en blanco al 70 %) y resplandor gris suave detrás; con
 * `outline = false`, solo el resplandor. El escudo va encima, sin cambios.
 */
async function withHalo(image: Rgba, side: number, outline: boolean): Promise<Rgba> {
  const { default: sharp } = await import('sharp')
  const { width, height, data } = image
  const alpha = Buffer.alloc(width * height)
  for (let p = 0; p < width * height; p++) alpha[p] = data[p * 4 + 3] ?? 0
  const blurred = async (sigma: number) =>
    sharp(alpha, { raw: { width, height, channels: 1 } })
      .blur(sigma)
      // sharp devuelve 3 canales aunque entre 1: se toma uno solo.
      .extractChannel(0)
      .raw()
      .toBuffer()
  const [near, far] = await Promise.all([blurred(side * 0.008), blurred(side * 0.03)])
  const out = new Uint8ClampedArray(data.length)
  for (let p = 0; p < width * height; p++) {
    // Resplandor: gris claro muy tenue. Contorno: lo que la silueta engrosada cubre, en blanco.
    const glow = ((far[p] ?? 0) / 255) * 0.3
    const ring = outline ? Math.min(1, ((near[p] ?? 0) / 255) * 4) * 0.7 : 0
    const backAlpha = ring + glow * (1 - ring)
    const backColor = backAlpha === 0 ? 0 : (255 * ring + 200 * glow * (1 - ring)) / backAlpha
    // El escudo encima (src-over).
    const i = p * 4
    const a = (data[i + 3] ?? 0) / 255
    const outAlpha = a + backAlpha * (1 - a)
    out[i + 3] = Math.round(outAlpha * 255)
    for (let c = 0; c < 3; c++) {
      out[i + c] =
        outAlpha === 0 ? 0 : Math.round(((data[i + c] ?? 0) * a + backColor * backAlpha * (1 - a)) / outAlpha)
    }
  }
  return { data: out, width, height }
}

/** Lado de la vista previa de «Escudos en las tarjetas» y de la caja del escudo dentro de ella. */
const PREVIEW_SIDE = 240
const PREVIEW_BOX = 176

/**
 * Vista previa del panel (Rivales → Escudos en las tarjetas): el escudo tratado con ese estilo, en su tamaño
 * óptico, sobre el gris oscuro del fondo del matchday. PNG; `null` si no se pudo tratar.
 */
export async function crestPreviewTile(png: Buffer, style: CrestCardStyle): Promise<Buffer | null> {
  const image = await cardCrestImage(png, { style })
  if (!image) return null
  const { default: sharp } = await import('sharp')
  const inner = Math.round(PREVIEW_BOX * Math.min(image.scale, 1.15))
  const crest = await sharp(Buffer.from(image.src.split(',')[1] ?? '', 'base64'))
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({
    create: { width: PREVIEW_SIDE, height: PREVIEW_SIDE, channels: 3, background: { r: 20, g: 20, b: 20 } },
  })
    .composite([{ input: crest, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}
