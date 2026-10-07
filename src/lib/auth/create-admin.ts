import 'server-only'
import { db } from '@/db/client'
import { auditLog } from '@/db/schema'
import { getAuth } from '@/lib/auth'
import { z } from '@/lib/zod'
import { MIN_PASSWORD_LENGTH } from './constants'

export const createAdminSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de la persona.').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido.')),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    .max(128, 'La contraseña es demasiado larga.'),
})

export type CreateAdminInput = z.infer<typeof createAdminSchema>

export type CreateAdminResult =
  | { status: 'creado' | 'restablecido'; email: string }
  | { status: 'ya_existe'; email: string }

/**
 * Crea un administrador (no hay registro público). Si el correo ya existe solo actúa con `reset: true`:
 * cambia la contraseña, lo deja como admin y reactiva la cuenta.
 * Se usa desde la consola (`admin:create`) y desde las pruebas.
 */
export async function createAdmin(
  input: CreateAdminInput,
  { reset = false }: { reset?: boolean } = {},
): Promise<CreateAdminResult> {
  const { name, email, password } = createAdminSchema.parse(input)
  const ctx = await getAuth().$context
  const hash = await ctx.password.hash(password)
  const existing = await ctx.internalAdapter.findUserByEmail(email)

  if (existing) {
    if (!reset) return { status: 'ya_existe', email }
    await ctx.internalAdapter.updateUser(existing.user.id, { name, role: 'admin', banned: false })
    await ctx.internalAdapter.updatePassword(existing.user.id, hash)
    await ctx.internalAdapter.deleteUserSessions(existing.user.id)
    await db.insert(auditLog).values({
      action: 'user.admin.reset',
      entityType: 'user',
      entityId: existing.user.id,
      summary: 'Administrador restablecido desde la consola',
    })
    return { status: 'restablecido', email }
  }

  const user = await ctx.internalAdapter.createUser(
    { name, email, emailVerified: true, role: 'admin' },
    { method: 'admin' },
  )
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hash,
  })
  await db.insert(auditLog).values({
    action: 'user.admin.create',
    entityType: 'user',
    entityId: user.id,
    summary: 'Administrador creado desde la consola',
  })
  return { status: 'creado', email }
}
