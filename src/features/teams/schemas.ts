import { checkbox, optionalText, optionalUuid, requiredText } from '@/lib/form-schemas'
import { z } from '@/lib/zod'
import { parseCoordinates } from './lib/parse-coordinates'

export const teamSchema = z.object({
  name: requiredText('Escribe el nombre del club.', 80),
  shortName: requiredText('Escribe el nombre corto.', 24),
  commune: optionalText(60),
  crestMediaId: optionalUuid(),
})
export type TeamFormValues = z.input<typeof teamSchema>

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
