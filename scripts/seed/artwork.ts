// Imágenes de ejemplo generadas por el seed. Todas pasan después por el mismo pipeline de medios que
// las fotos reales (`src/lib/images/process.ts`). El texto se dibuja con la fuente Archivo incluida en el
// repositorio, para que se vea igual en Windows, en CI y dentro de la imagen Docker (que no trae fuentes).
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const INK = '#0b0b0c'
const PAPER = '#ffffff'
const ACCENT = '#f27604'

const FONT_DIRS = ['src/assets/fonts/og', 'scripts/assets/fonts', 'assets/fonts']
// La coma separa la familia del estilo: sin ella, Pango busca la familia «Archivo» y elige la fuente normal.
const DISPLAY = { file: 'ArchivoCondensed-ExtraBold.ttf', name: 'Archivo Condensed, Ultra-Bold' }
const TEXT = { file: 'Archivo-SemiBold.ttf', name: 'Archivo, Semi-Bold' }

function fontFile(file: string): string {
  for (const dir of FONT_DIRS) {
    const candidate = path.resolve(dir, file)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`No se encontró la fuente ${file} (se buscó en ${FONT_DIRS.join(', ')}).`)
}

function escapeMarkup(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

type Label = {
  text: string
  color: string
  /** Caja máxima: el texto se ajusta para caber en ella. */
  width: number
  height: number
  font?: typeof DISPLAY
  align?: 'left' | 'centre'
}

async function label({ text, color, width, height, font = DISPLAY, align = 'centre' }: Label) {
  const image = await sharp({
    text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font: font.name,
      fontfile: fontFile(font.file),
      width,
      height,
      align,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { input: image.data, width: image.info.width, height: image.info.height }
}

type Placed = { input: Buffer; left: number; top: number }

async function centred(spec: Label, box: { x: number; y: number; width: number; height: number }) {
  const image = await label({ ...spec, width: box.width, height: box.height })
  return {
    input: image.input,
    left: Math.round(box.x + (box.width - image.width) / 2),
    top: Math.round(box.y + (box.height - image.height) / 2),
  } satisfies Placed
}

async function anchored(spec: Label, left: number, top: number): Promise<Placed> {
  const image = await label({ ...spec, align: 'left' })
  return { input: image.input, left, top }
}

function render(svg: string, layers: Placed[]) {
  return sharp(Buffer.from(svg)).composite(layers)
}

// ── Escudos de rivales ────────────────────────────────────────────────────────────────────────────

const SHIELD = 'M256 28 L452 84 V250 C452 368 372 446 256 488 C140 446 60 368 60 250 V84 Z'

const CREST_PATTERNS = [
  (b: string) => `<rect x="256" y="0" width="256" height="512" fill="${b}"/>`,
  (b: string) => `<path d="M0 330 L512 110 V230 L0 450 Z" fill="${b}"/>`,
  (b: string) => `<rect x="0" y="0" width="512" height="170" fill="${b}"/>`,
  (b: string) =>
    `<rect x="120" y="0" width="68" height="512" fill="${b}"/><rect x="324" y="0" width="68" height="512" fill="${b}"/>`,
  (b: string) => `<path d="M0 512 L256 300 L512 512 Z" fill="${b}"/>`,
  (_b: string) => '',
] as const

export const CREST_COLORS = [
  ['#14532d', '#f5f5f4'],
  ['#1e3a8a', '#facc15'],
  ['#991b1b', '#f5f5f4'],
  ['#0f766e', '#0f172a'],
  ['#6b21a8', '#f5f5f4'],
  ['#075985', '#f5f5f4'],
  ['#a16207', '#1c1917'],
  ['#9f1239', '#1e293b'],
  ['#166534', '#facc15'],
  ['#1e293b', '#dc2626'],
  ['#0e7490', '#f5f5f4'],
] as const

/** Escudo ficticio a partir de las iniciales del club (PNG con transparencia, 512×512). */
export async function crestArtwork(initials: string, index: number): Promise<Buffer> {
  const [primary, secondary] = CREST_COLORS[index % CREST_COLORS.length] ?? CREST_COLORS[0]
  const pattern = CREST_PATTERNS[index % CREST_PATTERNS.length] ?? CREST_PATTERNS[0]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><clipPath id="s"><path d="${SHIELD}"/></clipPath></defs>
    <path d="${SHIELD}" fill="${primary}"/>
    <g clip-path="url(#s)">${pattern(secondary)}</g>
    <rect x="96" y="176" width="320" height="150" rx="10" fill="${INK}" clip-path="url(#s)"/>
    <path d="${SHIELD}" fill="none" stroke="${INK}" stroke-width="14"/>
  </svg>`
  const text = await centred(
    { text: initials, color: PAPER, width: 280, height: 110 },
    { x: 116, y: 196, width: 280, height: 110 },
  )
  return render(svg, [text]).png().toBuffer()
}

/** Logo de auspiciador de ejemplo: solo texto, monocromo, con transparencia (900×360). */
export async function wordmarkArtwork(name: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="360" viewBox="0 0 900 360">
    <rect x="10" y="10" width="880" height="340" rx="24" fill="none" stroke="${INK}" stroke-width="10"/>
  </svg>`
  const title = await centred(
    { text: name.toUpperCase(), color: INK, width: 780, height: 170 },
    { x: 60, y: 50, width: 780, height: 190 },
  )
  const note = await centred(
    { text: 'AUSPICIADOR DE EJEMPLO', color: INK, width: 520, height: 44, font: TEXT },
    { x: 190, y: 260, width: 520, height: 50 },
  )
  return render(svg, [title, note]).png().toBuffer()
}

// ── Fotos de ejemplo ──────────────────────────────────────────────────────────────────────────────

type Tone = 'dark' | 'light' | 'accent'

const TONES: Record<Tone, { from: string; to: string; line: string; text: string }> = {
  dark: { from: '#1a1a1a', to: INK, line: '#ffffff', text: PAPER },
  light: { from: '#f7f7f7', to: '#bdbdbd', line: INK, text: INK },
  accent: { from: '#2b2b2b', to: INK, line: ACCENT, text: PAPER },
}

function pitchLines(width: number, height: number, variant: number, color: string): string {
  const stroke = `fill="none" stroke="${color}" stroke-opacity="0.22" stroke-width="${Math.max(4, Math.round(width / 260))}"`
  const r = Math.round(Math.min(width, height) * 0.24)
  switch (variant % 4) {
    case 0:
      return `<line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" ${stroke}/>
        <circle cx="${width / 2}" cy="${height / 2}" r="${r}" ${stroke}/>`
    case 1:
      return `<rect x="${-width * 0.05}" y="${height * 0.18}" width="${width * 0.42}" height="${height * 0.64}" ${stroke}/>
        <rect x="${-width * 0.05}" y="${height * 0.34}" width="${width * 0.18}" height="${height * 0.32}" ${stroke}/>
        <circle cx="${width * 0.37}" cy="${height / 2}" r="${r * 0.7}" ${stroke}/>`
    case 2:
      return `<circle cx="${width}" cy="${height}" r="${r * 1.4}" ${stroke}/>
        <circle cx="${width}" cy="${height}" r="${r * 2.6}" ${stroke}/>
        <line x1="0" y1="${height * 0.78}" x2="${width}" y2="${height * 0.2}" ${stroke}/>`
    default:
      return Array.from({ length: 9 }, (_, i) => {
        const x = Math.round((width / 8) * i)
        return `<line x1="${x}" y1="0" x2="${x - width * 0.18}" y2="${height}" ${stroke}/>`
      }).join('')
  }
}

type PhotoOptions = { width: number; height: number; variant: number; tone?: Tone; caption?: string }

/** Foto de ejemplo: líneas de cancha sobre un degradado, marcada como «Foto de ejemplo». JPEG sin transparencia. */
export async function photoArtwork({ width, height, variant, tone = 'dark', caption }: PhotoOptions) {
  const palette = TONES[tone]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    ${pitchLines(width, height, variant, palette.line)}
  </svg>`
  const margin = Math.round(width * 0.05)
  const layers: Placed[] = [
    await anchored(
      {
        text: 'FOTO DE EJEMPLO',
        color: palette.text,
        width: Math.round(width * 0.3),
        height: Math.round(height * 0.035),
        font: TEXT,
      },
      margin,
      height - margin - Math.round(height * 0.035),
    ),
  ]
  if (caption) {
    layers.push(
      await anchored(
        {
          text: caption.toUpperCase(),
          color: palette.text,
          width: width - margin * 2,
          height: Math.round(height * 0.16),
        },
        margin,
        margin,
      ),
    )
  }
  return render(svg, layers).flatten({ background: palette.to }).jpeg({ quality: 90 }).toBuffer()
}

/** Afiche de ejemplo (4:5). */
export async function posterArtwork(title: string, detail: string, variant: number): Promise<Buffer> {
  const width = 1080
  const height = 1350
  const dark = variant % 2 === 0
  const background = dark ? INK : ACCENT
  const foreground = dark ? PAPER : INK
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${background}"/>
    <rect x="48" y="48" width="${width - 96}" height="${height - 96}" fill="none" stroke="${foreground}" stroke-width="8"/>
    <rect x="96" y="${height - 330}" width="220" height="14" fill="${dark ? ACCENT : INK}"/>
    ${pitchLines(width, height, variant + 2, foreground)}
  </svg>`
  return render(svg, [
    await anchored({ text: title.toUpperCase(), color: foreground, width: 860, height: 520 }, 96, 150),
    await anchored(
      { text: detail, color: foreground, width: 860, height: 110, font: TEXT },
      96,
      height - 290,
    ),
    await anchored(
      { text: 'AFICHE DE EJEMPLO', color: foreground, width: 420, height: 40, font: TEXT },
      96,
      height - 130,
    ),
  ])
    .flatten({ background })
    .jpeg({ quality: 90 })
    .toBuffer()
}

const GARMENTS = {
  camiseta:
    'M330 240 L420 190 Q500 250 580 190 L670 240 L780 360 L700 440 L650 400 V800 H350 V400 L300 440 L220 360 Z',
  poleron:
    'M320 250 L410 200 Q500 300 590 200 L680 250 L800 520 L710 560 L660 440 V810 H340 V440 L290 560 L200 520 Z',
  jockey: 'M260 560 Q270 340 500 340 Q730 340 740 560 L880 600 Q860 650 740 640 H260 Z',
  bufanda: 'M180 420 H820 V560 H740 V760 H660 V560 H340 V760 H260 V560 H180 Z',
} as const

export type Garment = keyof typeof GARMENTS

/** Producto de ejemplo: silueta de la prenda sobre fondo claro (1000×1000). */
export async function productArtwork(garment: Garment, fill: string, name: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
    <rect width="1000" height="1000" fill="#ededed"/>
    <path d="${GARMENTS[garment]}" fill="${fill}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
  </svg>`
  return render(svg, [
    await anchored({ text: name.toUpperCase(), color: INK, width: 880, height: 70 }, 60, 60),
    await anchored({ text: 'PRODUCTO DE EJEMPLO', color: INK, width: 420, height: 36, font: TEXT }, 60, 900),
  ])
    .flatten({ background: '#ededed' })
    .jpeg({ quality: 90 })
    .toBuffer()
}

/** PDF mínimo y válido de una página con unas líneas de texto (documentos de ejemplo). */
export function pdfArtwork(lines: string[]): Buffer {
  const encode = (text: string) =>
    [...text]
      .map((char) => {
        const code = char.charCodeAt(0)
        if (char === '(' || char === ')' || char === '\\') return `\\${char}`
        // WinAnsi (Latin-1) cubre las tildes y la ñ.
        return code > 126 ? `\\${code.toString(8).padStart(3, '0')}` : char
      })
      .join('')
  const text = lines
    .map(
      (line, index) => `BT /F1 ${index === 0 ? 20 : 12} Tf 72 ${760 - index * 28} Td (${encode(line)}) Tj ET`,
    )
    .join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body, 'latin1')
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}
