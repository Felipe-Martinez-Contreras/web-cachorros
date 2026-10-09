import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createSerialQueue, fitWithin, sniffImageFormat } from '@/features/media/lib/upload-rules'

const pixel = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#f27604' } })

describe('sniffImageFormat', () => {
  it('reconoce JPEG, PNG y WebP por su firma', async () => {
    expect(await sniffImageFormat(await pixel().jpeg().toBuffer())).toBe('jpeg')
    expect(await sniffImageFormat(await pixel().png().toBuffer())).toBe('png')
    expect(await sniffImageFormat(await pixel().webp().toBuffer())).toBe('webp')
  })

  it('reconoce SVG con y sin declaración XML', async () => {
    expect(await sniffImageFormat(Buffer.from('  <svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('svg')
    expect(await sniffImageFormat(Buffer.from('<?xml version="1.0"?>\n<svg></svg>'))).toBe('svg')
  })

  it('rechaza lo que no es una imagen permitida', async () => {
    expect(await sniffImageFormat(Buffer.from('%PDF-1.7\n'))).toBeNull()
    expect(await sniffImageFormat(await pixel().gif().toBuffer())).toBeNull()
    expect(await sniffImageFormat(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull()
    expect(await sniffImageFormat(Buffer.from('<?xml version="1.0"?><nota/>'))).toBeNull()
    expect(await sniffImageFormat(Buffer.alloc(0))).toBeNull()
  })
})

describe('fitWithin', () => {
  it('no agranda ni toca una imagen que ya cabe', () => {
    expect(fitWithin(1600, 1200, 2560)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(2560, 100, 2560)).toEqual({ width: 2560, height: 100 })
  })

  it('reduce una foto de 12 MP conservando la proporción, horizontal o vertical', () => {
    expect(fitWithin(4000, 3000, 2560)).toEqual({ width: 2560, height: 1920 })
    expect(fitWithin(3000, 4000, 2560)).toEqual({ width: 1920, height: 2560 })
  })

  it('nunca deja un lado en cero', () => {
    expect(fitWithin(10000, 1, 2560)).toEqual({ width: 2560, height: 1 })
  })
})

describe('createSerialQueue', () => {
  it('ejecuta de a una tarea, en orden de llegada', async () => {
    const enqueue = createSerialQueue()
    const log: string[] = []
    let running = 0
    let maxRunning = 0
    const task = (name: string, ms: number) => async () => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      log.push(`inicio ${name}`)
      await new Promise((resolve) => setTimeout(resolve, ms))
      log.push(`fin ${name}`)
      running -= 1
      return name
    }
    const results = await Promise.all([enqueue(task('a', 20)), enqueue(task('b', 1)), enqueue(task('c', 5))])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(maxRunning).toBe(1)
    expect(log).toEqual(['inicio a', 'fin a', 'inicio b', 'fin b', 'inicio c', 'fin c'])
  })

  it('sigue con la siguiente aunque una tarea falle', async () => {
    const enqueue = createSerialQueue()
    const failed = enqueue(async () => {
      throw new Error('falló')
    })
    const next = enqueue(async () => 'sigue')
    await expect(failed).rejects.toThrow('falló')
    await expect(next).resolves.toBe('sigue')
  })
})
