import type { RichTextDoc, RichTextNode } from '@/db/schema/_columns'
import { isUuid } from '@/lib/form-schemas'
import { parseEmbedUrl } from './embed'

// Texto enriquecido (especificación 6.1 y 8.1): el editor entrega un documento ProseMirror y aquí se
// reconstruye solo con los nodos, marcas y atributos de la lista blanca. Lógica pura: la usan el
// formulario del panel, la Server Action y el render público.

export type RichTextResult = { ok: true; doc: RichTextDoc } | { ok: false; message: string }

const MAX_NODES = 4000
const MAX_DEPTH = 12
const MAX_TEXT_LENGTH = 60_000
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const MEDIA_SRC = /^\/media\/[\w\-./]+$/

const NOT_ALLOWED = 'El texto tiene contenido que no se puede publicar. Quita ese bloque y vuelve a guardar.'
const TOO_LONG = 'El texto es demasiado largo. Divídelo en más de una publicación.'

class Invalid extends Error {}

type Counter = { nodes: number; text: number }

/** Enlace seguro: solo `http`, `https`, `mailto` y `tel`. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const href = value.trim()
  try {
    return LINK_PROTOCOLS.has(new URL(href).protocol) ? href : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function children(node: Record<string, unknown>): unknown[] {
  return Array.isArray(node.content) ? node.content : []
}

function count(counter: Counter): void {
  counter.nodes += 1
  if (counter.nodes > MAX_NODES) throw new Invalid(TOO_LONG)
}

function cleanMarks(marks: unknown): RichTextNode['marks'] {
  if (!Array.isArray(marks)) return undefined
  const out: NonNullable<RichTextNode['marks']> = []
  for (const mark of marks) {
    if (!isRecord(mark)) continue
    if (mark.type === 'bold' || mark.type === 'italic') out.push({ type: mark.type })
    if (mark.type === 'link') {
      // Un enlace con un protocolo no permitido se quita; el texto se conserva.
      const href = safeHref(isRecord(mark.attrs) ? mark.attrs.href : null)
      if (href) out.push({ type: 'link', attrs: { href } })
    }
  }
  return out.length > 0 ? out : undefined
}

function cleanInline(nodes: unknown[], counter: Counter): RichTextNode[] {
  const out: RichTextNode[] = []
  for (const node of nodes) {
    if (!isRecord(node)) throw new Invalid(NOT_ALLOWED)
    count(counter)
    if (node.type === 'hardBreak') {
      out.push({ type: 'hardBreak' })
    } else if (node.type === 'text' && typeof node.text === 'string') {
      if (node.text.length === 0) continue
      counter.text += node.text.length
      if (counter.text > MAX_TEXT_LENGTH) throw new Invalid(TOO_LONG)
      const marks = cleanMarks(node.marks)
      out.push(marks ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text })
    } else {
      throw new Invalid(NOT_ALLOWED)
    }
  }
  return out
}

const TOP_LEVEL = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'horizontalRule',
  'image',
  'embed',
])
const INSIDE_QUOTE = new Set(['paragraph', 'bulletList', 'orderedList'])
const INSIDE_ITEM = new Set(['paragraph', 'bulletList', 'orderedList'])

function cleanBlocks(
  nodes: unknown[],
  allowed: Set<string>,
  counter: Counter,
  depth: number,
): RichTextNode[] {
  if (depth > MAX_DEPTH) throw new Invalid(NOT_ALLOWED)
  const out: RichTextNode[] = []
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.type !== 'string' || !allowed.has(node.type)) {
      throw new Invalid(NOT_ALLOWED)
    }
    count(counter)
    const attrs = isRecord(node.attrs) ? node.attrs : {}
    switch (node.type) {
      case 'paragraph': {
        const content = cleanInline(children(node), counter)
        out.push(content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' })
        break
      }
      case 'heading': {
        const level = Number(attrs.level)
        if (level !== 2 && level !== 3 && level !== 4) throw new Invalid(NOT_ALLOWED)
        out.push({ type: 'heading', attrs: { level }, content: cleanInline(children(node), counter) })
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const items: RichTextNode[] = []
        for (const item of children(node)) {
          if (!isRecord(item) || item.type !== 'listItem') throw new Invalid(NOT_ALLOWED)
          count(counter)
          items.push({
            type: 'listItem',
            content: cleanBlocks(children(item), INSIDE_ITEM, counter, depth + 1),
          })
        }
        if (items.length > 0) out.push({ type: node.type, content: items })
        break
      }
      case 'blockquote':
        out.push({
          type: 'blockquote',
          content: cleanBlocks(children(node), INSIDE_QUOTE, counter, depth + 1),
        })
        break
      case 'horizontalRule':
        out.push({ type: 'horizontalRule' })
        break
      case 'image': {
        // Solo imágenes de la biblioteca: el sitio las dibuja desde su id, nunca desde una URL externa.
        if (!isUuid(attrs.mediaId)) throw new Invalid(NOT_ALLOWED)
        const src = typeof attrs.src === 'string' && MEDIA_SRC.test(attrs.src) ? attrs.src : ''
        out.push({ type: 'image', attrs: { mediaId: attrs.mediaId, src } })
        break
      }
      case 'embed': {
        const embed = parseEmbedUrl(attrs.url)
        if (!embed)
          throw new Invalid('Uno de los videos o publicaciones incrustados tiene un enlace que no sirve.')
        out.push({ type: 'embed', attrs: { provider: embed.provider, url: embed.url } })
        break
      }
    }
  }
  return out
}

/** Valida un documento del editor y lo devuelve reducido a la lista blanca. */
export function sanitizeRichText(input: unknown): RichTextResult {
  if (!isRecord(input) || input.type !== 'doc') return { ok: false, message: NOT_ALLOWED }
  try {
    const content = cleanBlocks(children(input), TOP_LEVEL, { nodes: 0, text: 0 }, 0)
    return { ok: true, doc: { type: 'doc', content } }
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, message: error.message }
    throw error
  }
}

function inlineText(nodes: RichTextNode[] | undefined): string {
  return (nodes ?? []).map((node) => (node.type === 'hardBreak' ? '\n' : (node.text ?? ''))).join('')
}

function blockTexts(nodes: RichTextNode[] | undefined, out: string[]): void {
  for (const node of nodes ?? []) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = inlineText(node.content).trim()
      if (text) out.push(text)
    } else {
      blockTexts(node.content, out)
    }
  }
}

/** Texto plano del documento (un bloque por párrafo), para extractos, RSS y búsqueda. */
export function richTextToPlain(doc: RichTextDoc | null | undefined): string {
  const out: string[] = []
  blockTexts(doc?.content, out)
  return out.join('\n\n')
}

function walk(nodes: RichTextNode[] | undefined, visit: (node: RichTextNode) => void): void {
  for (const node of nodes ?? []) {
    visit(node)
    walk(node.content, visit)
  }
}

/** Ids de las imágenes de la biblioteca que usa el documento. */
export function richTextMediaIds(doc: RichTextDoc | null | undefined): string[] {
  const ids = new Set<string>()
  walk(doc?.content, (node) => {
    if (node.type === 'image' && typeof node.attrs?.mediaId === 'string') ids.add(node.attrs.mediaId)
  })
  return [...ids]
}

/** Un documento sin texto, imágenes ni videos está vacío (el editor siempre deja un párrafo). */
export function isRichTextEmpty(doc: RichTextDoc | null | undefined): boolean {
  let hasContent = false
  walk(doc?.content, (node) => {
    if (node.type === 'image' || node.type === 'embed' || (node.type === 'text' && node.text?.trim())) {
      hasContent = true
    }
  })
  return !hasContent
}

/** Extracto de una línea: corta en una palabra completa y agrega puntos suspensivos. */
export function excerptOf(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, '')}…`
}
