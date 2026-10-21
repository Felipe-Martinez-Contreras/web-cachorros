import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalText,
  optionalTime,
  optionalUrl,
  optionalUuid,
  requiredDate,
  requiredText,
  requiredTime,
} from '@/lib/form-schemas'
import { eventStatusLabels, eventTypeLabels } from '@/lib/labels'
import { richTextField } from '@/lib/rich-text/schema'
import { z } from '@/lib/zod'

/**
 * Evento del club (especificación 6.11). Las fechas y horas son de pared en Santiago, como las escribe la
 * directiva; la acción las convierte a instantes. El término es opcional: sin fecha, es el mismo día.
 */
export const eventSchema = z
  .object({
    title: requiredText('Escribe el nombre del evento.', 120),
    type: labeledEnum(eventTypeLabels, 'Elige un tipo de la lista.'),
    startDate: requiredDate('Elige el día del evento.'),
    startTime: requiredTime('Escribe la hora de inicio.'),
    endDate: optionalDate('Escribe una fecha de término válida.'),
    endTime: optionalTime('Escribe una hora de término válida.'),
    locationText: optionalText(200),
    venueId: optionalUuid(),
    posterMediaId: optionalUuid(),
    description: richTextField(),
    priceText: optionalText(120),
    ctaUrl: optionalUrl(),
    status: labeledEnum(eventStatusLabels, 'Elige un estado de la lista.'),
    isPublished: checkbox(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && !value.endTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Escribe también la hora de término.' })
      return
    }
    if (!value.endTime) return
    const end = `${value.endDate ?? value.startDate}T${value.endTime}`
    if (end < `${value.startDate}T${value.startTime}`) {
      ctx.addIssue({
        code: 'custom',
        path: [value.endDate ? 'endDate' : 'endTime'],
        message: 'El término no puede ser anterior al inicio.',
      })
    }
  })
export type EventFormValues = z.input<typeof eventSchema>
export type EventData = z.output<typeof eventSchema>
