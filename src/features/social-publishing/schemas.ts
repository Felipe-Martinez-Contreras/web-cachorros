import * as z from 'zod'
import { MAX_CAPTION } from './lib/caption'

/** Texto revisado de una publicación manual (el mismo esquema en el formulario y en la acción). */
export const manualPublishSchema = z.object({
  message: z
    .string({ error: 'Escribe el texto de la publicación.' })
    .trim()
    .min(1, 'Escribe el texto de la publicación.')
    .max(MAX_CAPTION, `El texto puede tener hasta ${MAX_CAPTION} caracteres.`),
})
