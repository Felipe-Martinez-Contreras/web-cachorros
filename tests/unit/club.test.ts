import { describe, expect, it } from 'vitest'
import { documentSchema } from '@/features/club/schemas'
import { isPdf } from '@/features/media/lib/upload-rules'
import { formatFileSize } from '@/lib/format'

describe('firma de un PDF', () => {
  it('reconoce un PDF por sus bytes, no por su nombre', async () => {
    expect(await isPdf(new TextEncoder().encode('%PDF-1.7\n%%EOF\n'))).toBe(true)
    expect(await isPdf(new TextEncoder().encode('<html>no soy un pdf</html>'))).toBe(false)
    expect(await isPdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false)
  })
})

describe('tamaño de un archivo', () => {
  it('en KB bajo 1 MB y en MB con un decimal', () => {
    expect(formatFileSize(200)).toBe('1 KB')
    expect(formatFileSize(850 * 1024)).toBe('850 KB')
    expect(formatFileSize(1.25 * 1024 * 1024)).toBe('1,3 MB')
    expect(formatFileSize(12 * 1024 * 1024)).toBe('12 MB')
  })
})

describe('esquema de documentos', () => {
  it('exige el PDF', () => {
    const result = documentSchema.safeParse({
      title: 'Acta',
      category: 'acta',
      periodLabel: '',
      documentDate: '',
      fileMediaId: '',
      description: '',
      isPublished: true,
    })
    expect(result.error?.issues[0]).toMatchObject({
      path: ['fileMediaId'],
      message: 'Sube el PDF del documento.',
    })
  })
})
