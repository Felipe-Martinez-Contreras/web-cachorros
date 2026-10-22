import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { can, type Permission } from '@/lib/permissions'
import { getAuth } from './index'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean
  twoFactorEnabled: boolean
}

export type AuthErrorReason = 'sin_sesion' | 'sin_permiso' | 'sin_dos_pasos'

const AUTH_MESSAGES: Record<AuthErrorReason, string> = {
  sin_sesion: 'Debes iniciar sesión para continuar.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  sin_dos_pasos: 'Activa la verificación en dos pasos en «Mi cuenta» para seguir usando el panel.',
}

export class AuthError extends Error {
  readonly reason: AuthErrorReason

  constructor(reason: AuthErrorReason) {
    super(AUTH_MESSAGES[reason])
    this.name = 'AuthError'
    this.reason = reason
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, name, email, role, banned, twoFactorEnabled } = session.user
  return {
    id,
    name,
    email,
    role: role ?? null,
    banned: banned ?? false,
    twoFactorEnabled: twoFactorEnabled ?? false,
  }
}

/** Id de la sesión de esta petición (para «Mi cuenta»: no se cierra la sesión en uso); `null` sin sesión. */
export async function getCurrentSessionId(): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: await headers() })
  return session?.session.id ?? null
}

/**
 * ¿Le falta activar los dos pasos? Con `AUTH_REQUIRE_2FA=true` (producción), una cuenta sin ellos solo
 * puede usar «Mi cuenta» (permiso `panel:access`): cambiar su contraseña, cerrar sesiones y activarlos.
 */
export function mustEnableTwoFactor(user: Pick<SessionUser, 'twoFactorEnabled'>): boolean {
  return env.AUTH_REQUIRE_2FA === true && !user.twoFactorEnabled
}

/**
 * Autorización de Server Actions y Route Handlers (especificación 2.5): se llama dentro de cada una.
 * Lanza `AuthError`; `runAction` lo convierte en un resultado con mensaje en español.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('sin_sesion')
  if (!can(user, permission)) throw new AuthError('sin_permiso')
  if (permission !== 'panel:access' && mustEnableTwoFactor(user)) throw new AuthError('sin_dos_pasos')
  return user
}

/**
 * Autorización de layouts y páginas del panel: sin sesión redirige al login. Si le faltan los dos pasos
 * obligatorios, lleva a «Mi cuenta» (la única pantalla que la pasa con `allowWithoutTwoFactor`).
 */
export async function requirePanelUser(
  permission: Permission = 'panel:access',
  { allowWithoutTwoFactor = false }: { allowWithoutTwoFactor?: boolean } = {},
): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')
  if (!can(user, permission)) redirect('/admin/sin-permiso')
  if (!allowWithoutTwoFactor && mustEnableTwoFactor(user)) redirect('/admin/cuenta?dos-pasos=obligatorio')
  return user
}
