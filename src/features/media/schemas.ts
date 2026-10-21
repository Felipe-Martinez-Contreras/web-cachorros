import { checkbox, optionalText, requiredText } from '@/lib/form-schemas'
import { z } from '@/lib/zod'

const altText = requiredText('Describe la imagen: es el texto que escuchan quienes no pueden verla.', 300)

/** Campos de texto que acompañan al archivo en `POST /api/admin/media`. */
export const uploadMediaSchema = z.object({
  altText,
  credit: optionalText(120),
  kind: z.enum(['photo', 'logo'], { error: 'Indica si es una foto o un escudo.' }).default('photo'),
})

/** Campos que acompañan a un PDF (`kind=document`): el nombre visible lo pone el documento, no el archivo. */
export const uploadDocumentSchema = z.object({
  altText: optionalText(300),
})

const focal = z.coerce.number({ error: 'Elige el punto focal.' }).min(0).max(1)

export const updateMediaSchema = z
  .object({
    altText,
    credit: optionalText(120),
    focalX: focal,
    focalY: focal,
    containsMinors: checkbox(),
    minorsConsent: checkbox(),
  })
  .refine((value) => !value.containsMinors || value.minorsConsent, {
    path: ['minorsConsent'],
    message: 'Confirma que el club tiene la autorización del apoderado antes de marcarla.',
  })

export type UpdateMediaInput = z.input<typeof updateMediaSchema>
