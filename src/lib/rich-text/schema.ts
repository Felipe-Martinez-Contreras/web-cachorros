import type { RichTextDoc } from '@/db/schema/_columns'
import { z } from '@/lib/zod'
import { isRichTextEmpty, sanitizeRichText } from './document'

/**
 * Campo de texto enriquecido para los esquemas del panel: valida el documento del editor contra la lista
 * blanca y lo entrega reducido. Vacío → `null`, o un error si se pasa `requiredMessage`.
 */
export function richTextField(requiredMessage?: string) {
  return z.unknown().transform((value, ctx): RichTextDoc | null => {
    const empty = () => {
      if (requiredMessage) ctx.addIssue({ code: 'custom', message: requiredMessage })
      return null
    }
    if (value === null || value === undefined || value === '') return empty()
    const result = sanitizeRichText(value)
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.message })
      return null
    }
    return isRichTextEmpty(result.doc) ? empty() : result.doc
  })
}
