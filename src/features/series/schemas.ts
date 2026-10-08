import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalText,
  requiredInt,
  requiredText,
  requiredUuid,
} from '@/lib/form-schemas'
import { competitionKindLabels, seriesKindLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

export const seriesSchema = z.object({
  name: requiredText('Escribe el nombre de la serie.', 60),
  shortName: requiredText('Escribe el nombre corto.', 20),
  kind: labeledEnum(seriesKindLabels, 'Elige el tipo de serie.'),
  halfLengthMinutes: requiredInt(5, 60, 'Cada tiempo dura entre 5 y 60 minutos.'),
  containsMinors: checkbox(),
  isActive: checkbox(),
  description: optionalText(500),
})
export type SeriesFormValues = z.input<typeof seriesSchema>

export const seasonSchema = z
  .object({
    name: requiredText('Escribe el nombre de la temporada.', 60),
    year: requiredInt(1934, 2100, 'Escribe el año de la temporada (por ejemplo, 2026).'),
    startsOn: optionalDate(),
    endsOn: optionalDate(),
    isCurrent: checkbox(),
  })
  .refine((value) => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn, {
    path: ['endsOn'],
    message: 'El término no puede ser anterior al inicio.',
  })
export type SeasonFormValues = z.input<typeof seasonSchema>

export const copySquadSchema = z.object({
  fromSeasonId: requiredUuid('Elige la temporada desde la que quieres copiar.'),
})

export const competitionSchema = z.object({
  seasonId: requiredUuid('Elige la temporada.'),
  name: requiredText('Escribe el nombre de la competencia.', 120),
  kind: labeledEnum(competitionKindLabels, 'Elige el tipo de competencia.'),
  organizer: optionalText(120),
  pointsWin: requiredInt(0, 10, 'Los puntos por triunfo van entre 0 y 10.'),
  pointsDraw: requiredInt(0, 10, 'Los puntos por empate van entre 0 y 10.'),
})
export type CompetitionFormValues = z.input<typeof competitionSchema>
