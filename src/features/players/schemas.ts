import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
  requiredUuid,
} from '@/lib/form-schemas'
import { playerPositionLabels, positionDetailLabels, registrationStatusLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

const SHIRT_MESSAGE = 'El número de camiseta va entre 1 y 99.'

const playerFields = {
  firstName: requiredText('Escribe el nombre.', 60),
  lastName: requiredText('Escribe el apellido.', 60),
  nickname: optionalText(40),
  birthDate: optionalDate('Escribe una fecha de nacimiento válida.').refine(
    (value) => value === null || (value >= '1920-01-01' && value <= new Date().toISOString().slice(0, 10)),
    'La fecha de nacimiento no puede ser futura.',
  ),
  primaryPosition: labeledEnum(playerPositionLabels, 'Elige la posición.'),
  positionDetail: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    labeledEnum(positionDetailLabels, 'Elige una posición de la lista.').nullable(),
  ),
  photoMediaId: optionalUuid(),
  isActive: checkbox(),
  imageConsent: checkbox(),
}

export const playerSchema = z.object(playerFields)
export type PlayerFormValues = z.input<typeof playerSchema>

/** Al crear se puede inscribir de inmediato en una serie de la temporada actual. */
export const newPlayerSchema = z.object({
  ...playerFields,
  seriesId: optionalUuid(),
  shirtNumber: optionalInt(1, 99, SHIRT_MESSAGE),
})
export type NewPlayerFormValues = z.input<typeof newPlayerSchema>

export const registrationSchema = z.object({
  seasonId: requiredUuid('Elige la temporada.'),
  seriesId: requiredUuid('Elige la serie.'),
  shirtNumber: optionalInt(1, 99, SHIRT_MESSAGE),
  isCaptain: checkbox(),
  status: labeledEnum(registrationStatusLabels, 'Elige el estado.'),
})
export type RegistrationFormValues = z.input<typeof registrationSchema>

const STAT_MESSAGE = 'Escribe un número entre 0 y 999.'

export const adjustmentSchema = z
  .object({
    seasonId: requiredUuid('Elige la temporada.'),
    seriesId: requiredUuid('Elige la serie.'),
    appearances: requiredInt(0, 999, STAT_MESSAGE),
    goals: requiredInt(0, 999, STAT_MESSAGE),
    yellowCards: requiredInt(0, 999, STAT_MESSAGE),
    redCards: requiredInt(0, 999, STAT_MESSAGE),
    note: optionalText(200),
  })
  .refine((value) => value.appearances + value.goals + value.yellowCards + value.redCards > 0, {
    path: ['appearances'],
    message: 'Escribe al menos un dato para sumar.',
  })
export type AdjustmentFormValues = z.input<typeof adjustmentSchema>
