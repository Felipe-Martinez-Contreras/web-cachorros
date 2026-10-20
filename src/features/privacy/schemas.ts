import { requiredText } from '@/lib/form-schemas'
import { z } from '@/lib/zod'
import { type PersonIdentifier, parseIdentifier } from './lib/identifier'

const UNRECOGNIZED = 'Escribe un correo, un RUT con guion (12.345.678-5) o un celular (+56 9 1234 5678).'

/** Lo que se escribe para buscar a una persona; sale ya reconocido y normalizado. */
export const personalDataQuerySchema = z.object({
  q: requiredText('Escribe el correo, el RUT o el celular de la persona.', 160).transform((value, ctx) => {
    const who = parseIdentifier(value)
    if (!who) ctx.addIssue({ code: 'custom', message: UNRECOGNIZED })
    return who as PersonIdentifier
  }),
})
