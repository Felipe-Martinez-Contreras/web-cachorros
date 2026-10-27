import * as z from 'zod'
import { optionalUuid, requiredUuid } from '@/lib/form-schemas'
import { MAX_JORNADA_SERIES } from './lib/jornada'

const SERIES_MESSAGE = 'Marca al menos una serie.'

/** «Series y fotos» de la tarjeta de una jornada (el mismo esquema en el panel y en la acción). */
export const jornadaOptionsSchema = z.object({
  series: z
    .array(requiredUuid('Serie inválida.'), { error: SERIES_MESSAGE })
    .min(1, SERIES_MESSAGE)
    .max(MAX_JORNADA_SERIES, `En la tarjeta caben ${MAX_JORNADA_SERIES} series: desmarca alguna.`),
  photo1: optionalUuid(),
  photo2: optionalUuid(),
  photo3: optionalUuid(),
})
export type JornadaOptionsValues = z.input<typeof jornadaOptionsSchema>
