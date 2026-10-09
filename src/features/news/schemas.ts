import {
  checkbox,
  labeledEnum,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredDate,
  requiredText,
  requiredTime,
} from '@/lib/form-schemas'
import { newsTypeLabels } from '@/lib/labels'
import { richTextField } from '@/lib/rich-text/schema'
import { z } from '@/lib/zod'

export const newsSchema = z
  .object({
    title: requiredText('Escribe el título.', 140),
    type: labeledEnum(newsTypeLabels, 'Elige el tipo de noticia.'),
    categoryId: optionalUuid(),
    excerpt: optionalText(300),
    body: richTextField(),
    coverMediaId: optionalUuid(),
    seriesIds: z.array(z.uuid({ error: 'Elige una serie de la lista.' })).max(20),
    matchId: optionalUuid(),
    albumId: optionalUuid(),
    isFeatured: checkbox(),
    isPinned: checkbox(),
    slug: optionalText(80),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    ogMediaId: optionalUuid(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'cronica' && !value.matchId) {
      ctx.addIssue({ code: 'custom', path: ['matchId'], message: 'Una crónica necesita su partido.' })
    }
    if (value.type === 'galeria' && !value.albumId) {
      ctx.addIssue({ code: 'custom', path: ['albumId'], message: 'Una galería necesita su álbum de fotos.' })
    }
  })
export type NewsFormValues = z.input<typeof newsSchema>

/** Día y hora de pared en Santiago en que se publica una noticia programada. */
export const scheduleNewsSchema = z.object({
  date: requiredDate('Elige el día de publicación.'),
  time: requiredTime('Elige la hora de publicación.'),
})
export type ScheduleNewsValues = z.input<typeof scheduleNewsSchema>

export const newsCategorySchema = z.object({
  name: requiredText('Escribe el nombre de la categoría.', 40),
  sortOrder: optionalInt(0, 999, 'Escribe un número entre 0 y 999.'),
})
export type NewsCategoryFormValues = z.input<typeof newsCategorySchema>
