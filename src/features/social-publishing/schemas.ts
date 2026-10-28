import * as z from 'zod'
import { requiredDate, requiredTime } from '@/lib/form-schemas'
import { MAX_CAPTION } from './lib/caption'

/** Texto revisado de una publicación manual (el mismo esquema en el formulario y en la acción). */
export const manualPublishSchema = z.object({
  message: z
    .string({ error: 'Escribe el texto de la publicación.' })
    .trim()
    .min(1, 'Escribe el texto de la publicación.')
    .max(MAX_CAPTION, `El texto puede tener hasta ${MAX_CAPTION} caracteres.`),
})

/** Fecha y hora de una publicación programada, en hora de Chile (el mismo esquema en el panel y en la acción). */
export const scheduleTimeSchema = z.object({
  date: requiredDate('Elige el día.'),
  time: requiredTime('Escribe la hora, por ejemplo 10:00.'),
})

/** Programar una publicación: el texto revisado y cuándo sale. */
export const schedulePublishSchema = manualPublishSchema.extend(scheduleTimeSchema.shape)

/** «Publicar ahora» o «Programar»: el formulario de la jornada y del partido. */
export const PUBLISH_WHEN = ['ahora', 'programar'] as const

/**
 * Formulario de la jornada y del partido: el texto, cuándo y, si se programa, la fecha y la hora. La acción
 * vuelve a validar con `manualPublishSchema` o con `schedulePublishSchema`.
 */
export const publishOrScheduleSchema = manualPublishSchema
  .extend({
    when: z.enum(PUBLISH_WHEN, { error: 'Elige cuándo se publica.' }),
    date: z.string().optional(),
    time: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.when !== 'programar') return
    const parsed = scheduleTimeSchema.safeParse(value)
    if (parsed.success) return
    for (const issue of parsed.error.issues) {
      context.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  })
