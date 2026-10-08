import {
  labeledEnum,
  optionalDate,
  optionalInt,
  optionalText,
  requiredInt,
  requiredUuid,
} from '@/lib/form-schemas'
import { standingsModeLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

const COUNT_MESSAGE = 'Escribe un número entre 0 y 999.'

const header = {
  mode: labeledEnum(standingsModeLabels, 'Elige cómo se arma la tabla.'),
  asOf: optionalDate('Escribe una fecha válida.'),
  sourceNote: optionalText(160),
}

export const newStandingsSchema = z.object({
  competitionId: requiredUuid('Elige la competencia.'),
  seriesId: requiredUuid('Elige la serie.'),
  groupLabel: z.preprocess((value) => (typeof value === 'string' ? value.trim() : ''), z.string().max(40)),
  ...header,
})
export type NewStandingsFormValues = z.input<typeof newStandingsSchema>

export const standingsRowSchema = z.object({
  teamId: requiredUuid('Elige el equipo.'),
  won: requiredInt(0, 999, COUNT_MESSAGE),
  drawn: requiredInt(0, 999, COUNT_MESSAGE),
  lost: requiredInt(0, 999, COUNT_MESSAGE),
  goalsFor: requiredInt(0, 999, COUNT_MESSAGE),
  goalsAgainst: requiredInt(0, 999, COUNT_MESSAGE),
  pointsAdjustment: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? 0 : value),
    z.coerce.number().int().min(-99, 'El ajuste va entre -99 y 99.').max(99, 'El ajuste va entre -99 y 99.'),
  ),
  position: optionalInt(1, 60, 'La posición va entre 1 y 60.'),
  note: optionalText(120),
})

export const standingsSchema = z
  .object({
    ...header,
    rows: z.array(standingsRowSchema).max(60),
  })
  .refine((value) => new Set(value.rows.map((row) => row.teamId)).size === value.rows.length, {
    path: ['rows'],
    message: 'Un equipo aparece dos veces en la tabla.',
  })
export type StandingsFormValues = z.input<typeof standingsSchema>
