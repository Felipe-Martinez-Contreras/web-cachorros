import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { mediaAssets } from '@/db/schema'
import { processImage } from '@/lib/images/process'
import {
  crestArtwork,
  type Garment,
  pdfArtwork,
  photoArtwork,
  posterArtwork,
  productArtwork,
  wordmarkArtwork,
} from './artwork'
import { CLUB, PRODUCTS, RIVALS, SPONSORS } from './data'
import { seedId } from './util'

type MediaRow = typeof mediaAssets.$inferInsert

const PLACEHOLDER_DIR = 'public/placeholder'
const CREDIT = 'Imagen de ejemplo'

/** Primer archivo que exista en `public/placeholder/` con alguno de esos nombres. */
function findPlaceholder(names: string[]): string | null {
  for (const name of names) {
    const file = path.resolve(PLACEHOLDER_DIR, name)
    if (existsSync(file)) return file
  }
  return null
}

export type SeedMedia = {
  rows: MediaRow[]
  /** Id de cada medio por su clave (`escudo`, `hero`, `rival:<slug>`, `news:<n>`…). */
  id: (key: string) => string
  /** Indica si se usaron los archivos entregados por el club o los genéricos. */
  usedClubFiles: { crest: boolean; hero: boolean }
}

/**
 * Genera y procesa todas las imágenes y documentos de ejemplo. Las claves de almacenamiento son fijas:
 * volver a correr el seed reemplaza los mismos archivos.
 */
export async function buildSeedMedia(uploadsDir: string): Promise<SeedMedia> {
  const rows: MediaRow[] = []
  const keys = new Set<string>()
  const id = (key: string) => {
    if (!keys.has(key)) throw new Error(`Seed: no existe el medio «${key}».`)
    return seedId(`media:${key}`)
  }
  const storageKeyOf = (key: string) => `seed-${key.replace(/[^a-z0-9]+/g, '-')}`

  async function image(
    key: string,
    kind: 'photo' | 'logo',
    altText: string,
    input: Buffer,
    extra: Partial<MediaRow> = {},
  ) {
    const processed = await processImage(input, { uploadsDir, kind, storageKey: storageKeyOf(key) })
    keys.add(key)
    rows.push({
      id: seedId(`media:${key}`),
      kind: 'imagen',
      originalFilename: `${key.replace(/[^a-z0-9]+/g, '-')}.${kind === 'logo' ? 'png' : 'jpg'}`,
      altText,
      credit: CREDIT,
      ...processed,
      ...extra,
    })
  }

  async function pdf(key: string, lines: string[]) {
    const storageKey = storageKeyOf(key)
    const dir = path.join(uploadsDir, storageKey)
    const content = pdfArtwork(lines)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'documento.pdf'), content)
    keys.add(key)
    rows.push({
      id: seedId(`media:${key}`),
      kind: 'documento',
      storageKey,
      originalFilename: `${storageKey}.pdf`,
      mime: 'application/pdf',
      bytes: content.byteLength,
    })
  }

  // Escudo y hero: los archivos del club si están en public/placeholder/; si no, los genéricos.
  const clubCrest = findPlaceholder(['escudo.svg', 'escudo.png', 'escudo.webp', 'escudo.jpg'])
  const crestFile = clubCrest ?? findPlaceholder(['escudo-generico.svg'])
  if (!crestFile) throw new Error(`Falta ${PLACEHOLDER_DIR}/escudo-generico.svg.`)
  await image('escudo', 'logo', `Escudo del ${CLUB.name}`, await readFile(crestFile), {
    credit: clubCrest ? null : CREDIT,
  })

  const clubHero = findPlaceholder(['hero.jpg', 'hero.jpeg', 'hero.png', 'hero.webp'])
  await image(
    'hero',
    'photo',
    clubHero ? `Foto principal del ${CLUB.name}` : 'Imagen de ejemplo: líneas de una cancha de fútbol',
    clubHero
      ? await readFile(clubHero)
      : await photoArtwork({ width: 2400, height: 1500, variant: 0, tone: 'accent', label: false }),
    { credit: clubHero ? null : CREDIT, focalY: 0.4 },
  )
  const mobileHero = findPlaceholder([
    'hero-movil.jpg',
    'hero-movil.jpeg',
    'hero-movil.png',
    'hero-movil.webp',
  ])
  if (mobileHero) {
    await image('hero-movil', 'photo', `Foto principal del ${CLUB.name}`, await readFile(mobileHero), {
      credit: null,
    })
  }

  for (const [index, rival] of RIVALS.entries()) {
    await image(
      `rival:${rival.slug}`,
      'logo',
      `Escudo de ${rival.name}`,
      await crestArtwork(rival.initials, index),
    )
  }

  for (const sponsor of SPONSORS) {
    await image(
      `sponsor:${sponsor.slug}`,
      'logo',
      `Logo de ${sponsor.name}`,
      await wordmarkArtwork(sponsor.mark),
    )
  }

  const tones = ['dark', 'light', 'accent'] as const
  for (let n = 0; n < 6; n++) {
    await image(
      `news:${n}`,
      'photo',
      'Imagen de ejemplo de una noticia del club',
      await photoArtwork({ width: 1920, height: 1080, variant: n, tone: tones[n % 3] }),
    )
    await image(
      `social:${n}`,
      'photo',
      'Imagen de ejemplo de una publicación en redes sociales',
      await photoArtwork({ width: 1080, height: 1080, variant: n + 1, tone: tones[(n + 1) % 3] }),
    )
  }

  for (let album = 0; album < 3; album++) {
    for (let item = 0; item < 4; item++) {
      await image(
        `album:${album}:${item}`,
        'photo',
        `Imagen de ejemplo ${item + 1} del álbum`,
        await photoArtwork({
          width: 1600,
          height: 1067,
          variant: album + item,
          tone: tones[(album + item) % 3],
        }),
      )
    }
  }

  const posters = [
    ['aniversario', 'Aniversario del club', '1 de abril'],
    ['completada', 'Gran completada', 'A beneficio de las series'],
    ['bingo', 'Bingo familiar', 'Premios y sorpresas'],
  ] as const
  for (const [index, [key, title, detail]] of posters.entries()) {
    await image(
      `event:${key}`,
      'photo',
      `Afiche de ejemplo: ${title}`,
      await posterArtwork(title, detail, index),
    )
  }

  for (const product of PRODUCTS) {
    await image(
      `product:${product.slug}`,
      'photo',
      `Imagen de ejemplo: ${product.name}`,
      await productArtwork(product.garment as Garment, product.fill, product.name),
    )
  }

  await pdf('doc:estatutos', [
    'Estatutos del club (documento de ejemplo)',
    '[COMPLETAR: reemplazar por los estatutos vigentes del club]',
  ])
  await pdf('doc:acta', [
    'Acta de asamblea (documento de ejemplo)',
    '[COMPLETAR: reemplazar por un acta real aprobada por la directiva]',
  ])
  await pdf('doc:balance', [
    'Balance anual (documento de ejemplo)',
    '[COMPLETAR: reemplazar por el balance real del club]',
  ])

  return { rows, id, usedClubFiles: { crest: clubCrest !== null, hero: clubHero !== null } }
}
