import { optionalText } from '@/lib/form-schemas'
import { richTextField } from '@/lib/rich-text/schema'
import { z } from '@/lib/zod'

export const pageBlockSchema = z.object({
  title: optionalText(120),
  body: richTextField('Escribe el texto.'),
})
export type PageBlockFormValues = z.input<typeof pageBlockSchema>
