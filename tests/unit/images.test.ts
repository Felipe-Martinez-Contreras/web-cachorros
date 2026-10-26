import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crestScale, LOGO_PIPELINE_VERSION, measureLogo, trimBackground } from '@/lib/images/crest'
import { mediaUrl, toImageDTO } from '@/lib/images/dto'
import { processImage, variantWidths } from '@/lib/images/process'

let uploadsDir: string

beforeAll(async () => {
  uploadsDir = await mkdtemp(path.join(tmpdir(), 'cachorros-img-'))
})

afterAll(async () => {
  await rm(uploadsDir, { recursive: true, force: true })
})

/** Foto de prueba con EXIF (incluye coordenadas GPS), como la que sale de un celular. */
function photoWithExif(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 112, b: 42 } } })
    .withExif({
      IFD0: { Make: 'Celular de prueba', Copyright: 'Dato privado' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '35/1 0/1 0/1' },
    })
    .jpeg()
    .toBuffer()
}

describe('processImage', () => {
  it('genera el master, las variantes WebP en anchos fijos y el LQIP', async () => {
    const result = await processImage(await photoWithExif(2000, 1000), { uploadsDir })

    expect(result).toMatchObject({ mime: 'image/jpeg', width: 2000, height: 1000 })
    expect(result.variants.master).toBe(`${result.storageKey}/master.jpg`)
    expect(result.variants.webp.map((v) => v.width)).toEqual([320, 480, 768, 1024, 1440, 1920])
    expect(result.variants.webp[0]).toMatchObject({ height: 160, path: `${result.storageKey}/w320.webp` })
    expect(result.variants.png512).toBeUndefined()
    expect(result.lqip).toMatch(/^data:image\/webp;base64,/)
    expect(result.lqip.length).toBeLessThan(600)

    const files = await readdir(path.join(uploadsDir, result.storageKey))
    expect(files.sort()).toEqual(
      ['master.jpg', ...result.variants.webp.map((v) => path.basename(v.path))].sort(),
    )
  })

  it('elimina EXIF y GPS del master y de las variantes', async () => {
    const input = await photoWithExif(800, 600)
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const result = await processImage(input, { uploadsDir })
    for (const file of [result.variants.master, ...result.variants.webp.map((v) => v.path)]) {
      const buffer = await readFile(path.join(uploadsDir, file))
      const metadata = await sharp(buffer).metadata()
      expect(metadata.exif).toBeUndefined()
      expect(buffer.includes('Celular de prueba')).toBe(false)
    }
  })

  it('limita el master a 2560 px de ancho', async () => {
    const result = await processImage(await photoWithExif(4000, 2000), { uploadsDir })
    expect(result).toMatchObject({ width: 2560, height: 1280 })
    expect(result.variants.webp.at(-1)?.width).toBe(1920)
  })

  it('rasteriza los SVG y conserva la transparencia de escudos y logos', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">' +
        '<circle cx="100" cy="120" r="80" fill="#0b0b0c"/></svg>',
    )
    const result = await processImage(svg, { uploadsDir, kind: 'logo', storageKey: 'escudo-de-prueba' })

    expect(result.storageKey).toBe('escudo-de-prueba')
    expect(result.mime).toBe('image/png')
    expect(result.variants.master).toBe('escudo-de-prueba/master.png')
    expect(result.variants.webp.map((v) => v.width).slice(0, 2)).toEqual([96, 192])

    const png512 = await sharp(path.join(uploadsDir, 'escudo-de-prueba', 'png512.png')).metadata()
    expect(png512).toMatchObject({ format: 'png', width: 512, height: 512, hasAlpha: true })
    const corner = await sharp(path.join(uploadsDir, 'escudo-de-prueba', 'w96.webp'))
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer()
    expect(corner[3]).toBe(0)
  })

  it('recorta el margen vacío de un logo, guarda el original y mide lo visible', async () => {
    const shield = (background: string) =>
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">' +
          background +
          '<rect x="400" y="300" width="200" height="400" fill="#8e1b1b"/></svg>',
      )
    for (const [key, background] of [
      ['logo-margen-blanco', '<rect width="1000" height="1000" fill="#fff"/>'],
      ['logo-transparente', ''],
    ] as const) {
      const result = await processImage(shield(background), { uploadsDir, kind: 'logo', storageKey: key })
      expect(result.width / result.height).toBeCloseTo(0.5, 1)
      expect(result.variants.original).toBe(`${key}/original.png`)
      const original = await sharp(path.join(uploadsDir, key, 'original.png')).metadata()
      expect(original.width).toBe(original.height)
      expect(result.variants.logo).toMatchObject({ v: LOGO_PIPELINE_VERSION })
      expect(result.variants.logo?.coverage).toBeGreaterThan(0.95)
      expect(result.variants.logo?.radius).toBeCloseTo(Math.hypot(0.25, 0.5), 1)
    }
  })

  it('no recorta un logo con fondo de color ni una foto', async () => {
    const colored = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#1f4fa3"/>' +
        '<circle cx="300" cy="300" r="100" fill="#fff"/></svg>',
    )
    const logo = await processImage(colored, { uploadsDir, kind: 'logo', storageKey: 'logo-de-color' })
    expect(logo.width).toBe(logo.height)
    expect(logo.variants.logo).toMatchObject({ coverage: 1, radius: Number(Math.SQRT1_2.toFixed(3)) })

    const white = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([{ input: await photoWithExif(100, 100), left: 400, top: 250 }])
      .jpeg()
      .toBuffer()
    const photo = await processImage(white, { uploadsDir })
    expect([photo.width, photo.height]).toEqual([900, 600])
    expect(photo.variants.logo).toBeUndefined()
    expect(photo.variants.original).toBeUndefined()
  })

  it('con la misma clave reemplaza los archivos anteriores (seed idempotente)', async () => {
    await processImage(await photoWithExif(2000, 1000), { uploadsDir, storageKey: 'repetida' })
    await processImage(await photoWithExif(400, 400), { uploadsDir, storageKey: 'repetida' })
    expect((await readdir(path.join(uploadsDir, 'repetida'))).sort()).toEqual([
      'master.jpg',
      'w320.webp',
      'w400.webp',
    ])
  })

  it('rechaza claves que podrían salir de la carpeta de subidas', async () => {
    await expect(
      processImage(await photoWithExif(10, 10), { uploadsDir, storageKey: '../fuera' }),
    ).rejects.toThrow(/no es válida/)
  })

  it('rechaza archivos que no son imágenes', async () => {
    await expect(processImage(Buffer.from('no soy una imagen'), { uploadsDir })).rejects.toThrow()
  })
})

describe('variantWidths', () => {
  it('nunca agranda: una imagen pequeña genera una sola variante de su tamaño', () => {
    expect(variantWidths([320, 480, 768], 200)).toEqual([200])
    expect(variantWidths([320, 480, 768], 480)).toEqual([320, 480])
    expect(variantWidths([320, 480, 768], 600)).toEqual([320, 480, 600])
    expect(variantWidths([320, 480, 768], 3000)).toEqual([320, 480, 768])
  })
})

describe('toImageDTO', () => {
  const media = {
    variants: {
      master: 'k/master.jpg',
      webp: [
        { width: 320, height: 160, path: 'k/w320.webp' },
        { width: 768, height: 384, path: 'k/w768.webp' },
      ],
    },
    width: 768,
    height: 384,
    altText: 'Plantel de Honor',
    lqip: 'data:image/webp;base64,AAAA',
    credit: 'Foto: club',
    focalX: 0.5,
    focalY: 0.3,
  }

  it('arma src, srcset y el punto focal', () => {
    expect(toImageDTO(media)).toEqual({
      src: '/media/k/w768.webp',
      srcSet: '/media/k/w320.webp 320w, /media/k/w768.webp 768w',
      width: 768,
      height: 384,
      alt: 'Plantel de Honor',
      lqip: 'data:image/webp;base64,AAAA',
      credit: 'Foto: club',
      focalPoint: '50% 30%',
    })
    expect(mediaUrl('k/master.jpg')).toBe('/media/k/master.jpg')
  })

  it('un escudo o logo (con PNG de 512 px) trae su escala óptica; una foto no', () => {
    const logo = { ...media, variants: { ...media.variants, png512: 'k/png512.png' } }
    expect(toImageDTO(logo)?.crestScale).toEqual(crestScale(768, 384, undefined))
    expect(toImageDTO(media)?.crestScale).toBeUndefined()
  })

  it('devuelve null si no hay imagen procesada', () => {
    expect(toImageDTO(null)).toBeNull()
    expect(toImageDTO({ ...media, variants: null })).toBeNull()
    expect(toImageDTO({ ...media, width: null })).toBeNull()
    expect(
      toImageDTO({ ...media, altText: null, variants: { master: 'k/master.jpg', webp: [] } }),
    ).toMatchObject({ src: '/media/k/master.jpg', srcSet: '', alt: '' })
  })
})

/** Píxeles RGBA de prueba: `paint(x, y)` devuelve el color de cada píxel. */
function pixels(width: number, height: number, paint: (x: number, y: number) => number[]) {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4)
  }
  return { data, width, height }
}

const RED = [142, 27, 27, 255]
const WHITE = [255, 255, 255, 255]
const CLEAR = [0, 0, 0, 0]

describe('trimBackground', () => {
  it('recorta solo fondos transparentes o blancos', () => {
    const inner = (x: number, y: number) => x > 2 && x < 7 && y > 2 && y < 7
    expect(trimBackground(pixels(10, 10, (x, y) => (inner(x, y) ? RED : CLEAR)))).toBe('transparent')
    expect(trimBackground(pixels(10, 10, (x, y) => (inner(x, y) ? RED : WHITE)))).toBe('white')
    expect(trimBackground(pixels(10, 10, (x, y) => (inner(x, y) ? WHITE : RED)))).toBeNull()
  })
})

describe('measureLogo', () => {
  it('un cuadrado opaco cubre todo y llega a la esquina', () => {
    expect(measureLogo(pixels(20, 20, () => RED))).toEqual({
      coverage: 1,
      radius: Number(Math.SQRT1_2.toFixed(3)),
    })
  })

  it('un disco cubre π/4 y llega a la mitad del lado; lo blanco de adentro cuenta en la silueta', () => {
    const disc = pixels(200, 200, (x, y) => {
      const d = Math.hypot(x + 0.5 - 100, y + 0.5 - 100)
      return d <= 100 ? (d < 50 ? WHITE : RED) : CLEAR
    })
    const metrics = measureLogo(disc)
    expect(metrics.coverage).toBeCloseTo(Math.PI / 4, 1)
    expect(metrics.radius).toBeCloseTo(0.5, 1)
  })

  it('un logo blanco sobre transparente se mide por lo opaco', () => {
    const white = pixels(10, 10, (x, y) => (x > 2 && x < 7 && y > 2 && y < 7 ? WHITE : CLEAR))
    expect(measureLogo(white).coverage).toBeCloseTo(0.16, 2)
  })
})

describe('crestScale', () => {
  const square = { v: 1, coverage: 1, radius: Math.SQRT1_2 }

  it('un cuadrado opaco cabe en el disco: su lado queda bajo el 70,7 % del diámetro', () => {
    const scale = crestScale(500, 500, square)
    expect(scale.disc).toBeGreaterThanOrEqual(0.66)
    expect(scale.disc).toBeLessThan(Math.SQRT1_2)
  })

  it('ningún escudo se acerca al borde del disco, ni se sale de su caja', () => {
    for (const aspect of [0.3, 0.5, 0.8, 1, 1.4, 2.5]) {
      for (const coverage of [0.2, 0.5, 0.8, 1]) {
        for (const radius of [0.4, 0.5, 0.6, 0.75]) {
          const scale = crestScale(1000 * aspect, 1000, { v: 1, coverage, radius })
          expect(scale.disc * radius).toBeLessThanOrEqual(0.4805)
          expect(scale.disc).toBeLessThanOrEqual(1)
          expect(scale.bare).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('los altos, los anchos y los redondos se agrandan respecto del cuadrado', () => {
    const base = crestScale(500, 500, square)
    const tall = crestScale(400, 1000, { v: 1, coverage: 0.9, radius: 0.54 })
    const wide = crestScale(1000, 480, { v: 1, coverage: 0.79, radius: 0.5 })
    const round = crestScale(500, 500, { v: 1, coverage: Math.PI / 4, radius: 0.5 })
    for (const scale of [tall, wide, round]) {
      expect(scale.disc).toBeGreaterThan(base.disc)
      expect(scale.bare).toBeGreaterThan(base.bare)
    }
  })

  it('sin medidas (archivo antiguo) supone un rectángulo opaco: nunca se sale del disco', () => {
    expect(crestScale(500, 500, null).disc).toBe(crestScale(500, 500, square).disc)
    const tall = crestScale(300, 900, undefined)
    expect(tall.disc * (Math.hypot(1 / 3, 1) / 2)).toBeLessThanOrEqual(0.4805)
  })
})
