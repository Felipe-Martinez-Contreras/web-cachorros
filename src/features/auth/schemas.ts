import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants'
import { z } from '@/lib/zod'

const email = z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido.'))

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      .max(128, 'La contraseña es demasiado larga.'),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden.',
  })
