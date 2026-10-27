import { checkbox, labeledEnum, optionalText, optionalUuid, requiredText } from '@/lib/form-schemas'
import { crestCardStyleLabels } from '@/lib/labels'
import { z } from '@/lib/zod'
import { parseCoordinates } from './lib/parse-coordinates'

export const teamSchema = z.object({
  name: requiredText('Escribe el nombre del club.', 80),
  shortName: requiredText('Escribe el nombre corto.', 24),
  commune: optionalText(60),
  crestMediaId: optionalUuid(),
  cardCrestStyle: labeledEnum(crestCardStyleLabels, 'Elige cómo va el escudo en las tarjetas.').default(
    'color',
  ),
})
export type TeamFormValues = z.input<typeof teamSchema>

/** «Escudos en las tarjetas»: solo el estilo del escudo de un equipo. */
export const crestStyleSchema = z.object({
  cardCrestStyle: labeledEnum(crestCardStyleLabels, 'Elige cómo va el escudo en las tarjetas.'),
})

export const venueSchema = z.object({
  name: requiredText('Escribe el nombre de la cancha.', 80),
  address: optionalText(160),
  commune: optionalText(60),
  location: optionalText(600).refine((value) => value === null || parseCoordinates(value) !== null, {
    message:
      'No encontramos las coordenadas. Pega el enlace largo de Google Maps o escribe «latitud, longitud».',
  }),
  isHome: checkbox(),
  notes: optionalText(300),
})
export type VenueFormValues = z.input<typeof venueSchema>
