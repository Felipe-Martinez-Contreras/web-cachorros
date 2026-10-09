import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { can, type Permission } from '@/lib/permissions'
import { getAuth } from './index'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean
}

export type AuthErrorReason = 'sin_sesion' | 'sin_permiso'

export class AuthError extends Error {
  readonly reason: AuthErrorReason

  constructor(reason: AuthErrorReason) {
    super(
      reason === 'sin_sesion' ? 'Debes iniciar sesión para continuar.' : 'No tienes permiso para hacer esto.',
    )
    this.name = 'AuthError'
    this.reason = reason
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, name, email, role, banned } = session.user
  return { id, name, email, role: role ?? null, banned: banned ?? false }
}

/** Id de la sesión de esta petición (para «Mi cuenta»: no se cierra la sesión en uso); `null` sin sesión. */
export async function getCurrentSessionId(): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: await headers() })
  return session?.session.id ?? null
}

/**
 * Autorización de Server Actions y Route Handlers (especificación 2.5): se llama dentro de cada una.
 * Lanza `AuthError`; `runAction` lo convierte en un resultado con mensaje en español.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('sin_sesion')
  if (!can(user, permission)) throw new AuthError('sin_permiso')
  return user
}

/** Autorización de layouts y páginas del panel: sin sesión redirige al login. */
export async function requirePanelUser(permission: Permission = 'panel:access'): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')
  if (!can(user, permission)) redirect('/admin/sin-permiso')
  return user
}
