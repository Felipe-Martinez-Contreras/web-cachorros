import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants'
import { requiredText } from '@/lib/form-schemas'
import { z } from '@/lib/zod'

const newPassword = z
  .string({ error: 'Escribe la contraseña nueva.' })
  .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(128, 'La contraseña es demasiado larga.')

export const inviteUserSchema = z.object({
  name: requiredText('Escribe el nombre de la persona.', 80),
  email: z
    .string({ error: 'Escribe un correo válido.' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Escribe un correo válido.')),
})
export type InviteUserValues = z.input<typeof inviteUserSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Escribe tu contraseña actual.' })
      .min(1, 'Escribe tu contraseña actual.'),
    newPassword,
    confirm: z.string({ error: 'Repite la contraseña nueva.' }),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirm) {
      ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'Las contraseñas no coinciden.' })
    }
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Elige una contraseña distinta de la actual.',
      })
    }
  })
export type ChangePasswordValues = z.input<typeof changePasswordSchema>

export const confirmPasswordSchema = z.object({
  password: z.string({ error: 'Escribe tu contraseña.' }).min(1, 'Escribe tu contraseña.'),
})
