import { z } from '@/lib/zod'

export const updateClubIdentitySchema = z.object({
  clubName: z.string().trim().min(3, 'Escribe el nombre del club.').max(120),
  shortName: z.string().trim().min(2, 'Escribe el nombre corto.').max(30),
})

export type UpdateClubIdentityInput = z.infer<typeof updateClubIdentitySchema>
