import { createHash } from 'node:crypto'
import { getTableColumns, type SQL, sql } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { Tx } from '@/db/client'
import type { RichTextDoc } from '@/db/schema'

/**
 * Id determinista a partir de una clave legible (`team:los-litres`). Así el seed es idempotente: volver a
 * correrlo actualiza las mismas filas en vez de duplicarlas.
 */
export function seedId(key: string): string {
  const hex = createHash('sha1').update(`cachorros-seed:${key}`).digest('hex')
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
}

export type Random = {
  /** Número en [0, 1). */
  next: () => number
  /** Entero en [min, max]. */
  int: (min: number, max: number) => number
  pick: <T>(items: readonly T[]) => T
  /** Índice elegido según pesos relativos. */
  weighted: (weights: readonly number[]) => number
  chance: (probability: number) => boolean
  shuffle: <T>(items: readonly T[]) => T[]
}

/** Generador determinista (mulberry32) con semilla fija derivada de un texto. */
export function createRandom(seed: string): Random {
  let state = Number.parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 8), 16)
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: (items) => {
      const item = items[int(0, items.length - 1)]
      if (item === undefined) throw new Error('No hay elementos para elegir.')
      return item
    },
    weighted: (weights) => {
      let roll = next() * weights.reduce((sum, weight) => sum + weight, 0)
      for (let index = 0; index < weights.length; index++) {
        roll -= weights[index] ?? 0
        if (roll < 0) return index
      }
      return weights.length - 1
    },
    chance: (probability) => next() < probability,
    shuffle: (items) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        const a = out[i] as (typeof out)[number]
        out[i] = out[j] as (typeof out)[number]
        out[j] = a
      }
      return out
    },
  }
}

const CHUNK = 500

/** *Upsert* por id: inserta o actualiza todas las columnas (menos `id`, `created_at` y las generadas). */
export async function upsert<T extends PgTable>(tx: Tx, table: T, rows: T['$inferInsert'][]): Promise<void> {
  if (rows.length === 0) return
  const columns = getTableColumns(table) as Record<string, PgColumn>
  const idColumn = columns.id
  if (!idColumn) throw new Error('La tabla no tiene columna id.')
  const set: Record<string, SQL> = {}
  for (const [key, column] of Object.entries(columns)) {
    if (key === 'id' || key === 'createdAt' || column.generated) continue
    set[key] = sql.raw(`excluded."${column.name}"`)
  }
  for (let start = 0; start < rows.length; start += CHUNK) {
    await tx
      .insert(table)
      .values(rows.slice(start, start + CHUNK) as never)
      .onConflictDoUpdate({ target: idColumn, set: set as never })
  }
}

/** Documento de texto enriquecido (ProseMirror) con un párrafo por texto. */
export function richText(...paragraphs: string[]): RichTextDoc {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }
}

export function plainText(...paragraphs: string[]): string {
  return paragraphs.join('\n\n')
}

export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`Seed: falta ${what}.`)
  return value
}
