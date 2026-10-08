import { sql } from 'drizzle-orm'
import { timestamp, uuid } from 'drizzle-orm/pg-core'

/** PK `uuid default uuidv7()` (nativo en PostgreSQL 18; especificación 8.1). */
export const id = () => uuid('id').primaryKey().default(sql`uuidv7()`)

export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() })

/** Documento ProseMirror (Tiptap). Se valida con Zod en su dominio antes de guardarlo. */
export type RichTextDoc = { type: 'doc'; content?: RichTextNode[] }
export type RichTextNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: RichTextNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}
