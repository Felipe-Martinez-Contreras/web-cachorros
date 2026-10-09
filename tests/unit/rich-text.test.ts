import { describe, expect, it } from 'vitest'
import {
  excerptOf,
  isRichTextEmpty,
  richTextMediaIds,
  richTextToPlain,
  safeHref,
  sanitizeRichText,
} from '@/lib/rich-text/document'
import { parseEmbedUrl } from '@/lib/rich-text/embed'
import { richTextField } from '@/lib/rich-text/schema'

const MEDIA_ID = '0199c2f0-0000-7000-8000-000000000001'
const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
})
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content })
const doc = (...content: unknown[]) => ({ type: 'doc', content })

function clean(input: unknown) {
  const result = sanitizeRichText(input)
  if (!result.ok) throw new Error(result.message)
  return result.doc
}

describe('sanitizeRichText', () => {
  it('conserva los nodos de la lista blanca', () => {
    const input = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Título')] },
      paragraph(text('Hola '), text('mundo', [{ type: 'bold' }, { type: 'italic' }])),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('Uno'))] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Dos'))] }] },
      { type: 'blockquote', content: [paragraph(text('Cita'))] },
      { type: 'horizontalRule' },
      { type: 'image', attrs: { mediaId: MEDIA_ID, src: '/media/abc/w320.webp' } },
      { type: 'embed', attrs: { url: 'https://youtu.be/dQw4w9WgXcQ' } },
    )
    expect(clean(input).content?.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
      'blockquote',
      'horizontalRule',
      'image',
      'embed',
    ])
  })

  it('quita atributos y marcas que no están permitidos', () => {
    const result = clean(
      doc({
        type: 'paragraph',
        attrs: { style: 'color:red', onclick: 'alert(1)' },
        content: [
          text('x', [
            { type: 'underline' },
            { type: 'link', attrs: { href: 'https://club.cl', target: '_blank', class: 'x' } },
          ]),
        ],
      }),
    )
    expect(result.content?.[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://club.cl' } }] }],
    })
  })

  it('quita los enlaces con protocolos peligrosos y conserva el texto', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '/relativo', '']) {
      const result = clean(doc(paragraph(text('clic', [{ type: 'link', attrs: { href } }]))))
      expect(result.content?.[0]?.content?.[0]).toEqual({ type: 'text', text: 'clic' })
    }
  })

  it('rechaza nodos desconocidos, encabezados fuera de rango e imágenes externas', () => {
    const rejected = [
      doc({ type: 'script', content: [text('x')] }),
      doc({ type: 'codeBlock', content: [text('x')] }),
      doc({ type: 'heading', attrs: { level: 1 }, content: [text('x')] }),
      doc({ type: 'image', attrs: { src: 'https://otro.sitio/foto.jpg' } }),
      doc({ type: 'embed', attrs: { url: 'https://sitio-cualquiera.com/video' } }),
      doc(paragraph({ type: 'image', attrs: { mediaId: MEDIA_ID } })),
      doc({ type: 'listItem', content: [paragraph(text('suelto'))] }),
      { type: 'paragraph' },
      null,
      'texto',
    ]
    for (const input of rejected) expect(sanitizeRichText(input).ok).toBe(false)
  })

  it('descarta la URL de una imagen que no es de la biblioteca', () => {
    const result = clean(doc({ type: 'image', attrs: { mediaId: MEDIA_ID, src: 'https://x.test/a.png' } }))
    expect(result.content?.[0]?.attrs).toEqual({ mediaId: MEDIA_ID, src: '' })
  })

  it('rechaza documentos demasiado profundos o largos', () => {
    let nested: unknown = paragraph(text('fondo'))
    for (let i = 0; i < 20; i++) nested = { type: 'blockquote', content: [nested] }
    expect(sanitizeRichText(doc(nested)).ok).toBe(false)
    expect(sanitizeRichText(doc(paragraph(text('a'.repeat(60_001))))).ok).toBe(false)
  })
})

describe('utilidades de texto enriquecido', () => {
  const sample = clean(
    doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Título')] },
      paragraph(text('Primera línea'), { type: 'hardBreak' }, text('segunda')),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('Punto'))] }] },
      { type: 'image', attrs: { mediaId: MEDIA_ID, src: '' } },
    ),
  )

  it('entrega el texto plano por bloques', () => {
    expect(richTextToPlain(sample)).toBe('Título\n\nPrimera línea\nsegunda\n\nPunto')
    expect(richTextToPlain(null)).toBe('')
  })

  it('lista las imágenes usadas sin repetir', () => {
    expect(richTextMediaIds(sample)).toEqual([MEDIA_ID])
  })

  it('distingue un documento vacío', () => {
    expect(isRichTextEmpty(clean(doc({ type: 'paragraph' })))).toBe(true)
    expect(isRichTextEmpty(clean(doc(paragraph(text('   ')))))).toBe(true)
    expect(isRichTextEmpty(sample)).toBe(false)
    expect(isRichTextEmpty(clean(doc({ type: 'image', attrs: { mediaId: MEDIA_ID } })))).toBe(false)
  })

  it('corta el extracto en una palabra completa', () => {
    expect(excerptOf('Corto.')).toBe('Corto.')
    const long = excerptOf('palabra '.repeat(50), 40)
    expect(long.length).toBeLessThanOrEqual(41)
    expect(long.endsWith('…')).toBe(true)
    expect(long).not.toMatch(/\s…$/)
  })

  it('solo acepta enlaces http, https, mailto y tel', () => {
    expect(safeHref('https://club.cl/a')).toBe('https://club.cl/a')
    expect(safeHref('mailto:club@ejemplo.cl')).toBe('mailto:club@ejemplo.cl')
    expect(safeHref('tel:+56912345678')).toBe('tel:+56912345678')
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref(' JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeHref(null)).toBeNull()
  })
})

describe('parseEmbedUrl', () => {
  it('reconoce los formatos de YouTube y los normaliza', () => {
    const expected = {
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
    }
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(parseEmbedUrl(url)).toEqual(expected)
    }
  })

  it('reconoce Facebook e Instagram', () => {
    expect(parseEmbedUrl('https://www.facebook.com/club/videos/123/')?.provider).toBe('facebook')
    expect(parseEmbedUrl('https://www.instagram.com/p/Cabc123/?igsh=x')).toEqual({
      provider: 'instagram',
      url: 'https://www.instagram.com/p/Cabc123/',
    })
  })

  it('rechaza lo demás', () => {
    for (const url of [
      'https://vimeo.com/123',
      'https://www.youtube.com/watch?v=corto',
      'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'no es una url',
      'https://www.instagram.com/club/',
      42,
    ]) {
      expect(parseEmbedUrl(url)).toBeNull()
    }
  })
})

describe('richTextField', () => {
  it('convierte un documento vacío en null y exige contenido cuando es obligatorio', () => {
    expect(richTextField().parse(doc({ type: 'paragraph' }))).toBeNull()
    expect(richTextField().parse('')).toBeNull()
    const required = richTextField('Escribe el texto.').safeParse(doc({ type: 'paragraph' }))
    expect(required.success).toBe(false)
    expect(required.error?.issues[0]?.message).toBe('Escribe el texto.')
  })

  it('entrega el documento reducido o el motivo del rechazo', () => {
    expect(richTextField().parse(doc(paragraph(text('Hola'))))).toEqual(doc(paragraph(text('Hola'))))
    expect(richTextField().safeParse(doc({ type: 'iframe' })).success).toBe(false)
  })
})
