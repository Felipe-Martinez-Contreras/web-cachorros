import {
  checkbox,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
} from '@/lib/form-schemas'
import { z } from '@/lib/zod'
import { toMilestoneDate } from './lib/dates'

const YEAR_MESSAGE = 'Escribe un año entre 1900 y 2100.'
const optionalYear = () => optionalInt(1900, 2100, YEAR_MESSAGE)

export const milestoneSchema = z
  .object({
    title: requiredText('Escribe el título del hito.', 120),
    year: requiredInt(1900, 2100, YEAR_MESSAGE),
    month: optionalInt(1, 12, 'Elige un mes de la lista.'),
    day: optionalInt(1, 31, 'Escribe un día entre 1 y 31.'),
    body: optionalText(2000),
    imageMediaId: optionalUuid(),
    isPlaceholder: checkbox(),
  })
  .superRefine((value, ctx) => {
    if (value.day !== null && value.month === null) {
      ctx.addIssue({ code: 'custom', path: ['month'], message: 'Para indicar el día, elige también el mes.' })
    } else if (toMilestoneDate(value) === null) {
      ctx.addIssue({ code: 'custom', path: ['day'], message: 'Ese día no existe en ese mes.' })
    }
  })
export type MilestoneFormValues = z.input<typeof milestoneSchema>

export const honourSchema = z.object({
  name: requiredText('Escribe el nombre del título.', 120),
  year: optionalYear(),
  seriesId: optionalUuid(),
  competitionName: optionalText(120),
  description: optionalText(1000),
  imageMediaId: optionalUuid(),
})
export type HonourFormValues = z.input<typeof honourSchema>

export const idolSchema = z.object({
  fullName: requiredText('Escribe el nombre.', 120),
  nickname: optionalText(60),
  eraLabel: optionalText(60),
  position: optionalText(60),
  bio: optionalText(2000),
  photoMediaId: optionalUuid(),
})
export type IdolFormValues = z.input<typeof idolSchema>

export const kitSchema = z
  .object({
    description: requiredText('Describe la camiseta.', 300),
    yearFrom: optionalYear(),
    yearTo: optionalYear(),
    imageMediaId: optionalUuid(),
  })
  .superRefine((value, ctx) => {
    if (value.yearFrom !== null && value.yearTo !== null && value.yearTo < value.yearFrom) {
      ctx.addIssue({ code: 'custom', path: ['yearTo'], message: 'No puede ser anterior al año de inicio.' })
    }
  })
export type KitFormValues = z.input<typeof kitSchema>
