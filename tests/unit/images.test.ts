import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

  it('devuelve null si no hay imagen procesada', () => {
    expect(toImageDTO(null)).toBeNull()
    expect(toImageDTO({ ...media, variants: null })).toBeNull()
    expect(toImageDTO({ ...media, width: null })).toBeNull()
    expect(
      toImageDTO({ ...media, altText: null, variants: { master: 'k/master.jpg', webp: [] } }),
    ).toMatchObject({ src: '/media/k/master.jpg', srcSet: '', alt: '' })
  })
})
