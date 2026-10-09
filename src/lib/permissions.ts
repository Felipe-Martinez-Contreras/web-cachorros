/**
 * Matriz de permisos en código (especificación 2.5). Lógica pura: no importa nada del servidor.
 * v1 habilita solo `admin`; la estructura queda lista para `editor`, `delegado` y `prensa`.
 */
export const USER_ROLES = ['admin', 'editor', 'delegado', 'prensa'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const PERMISSIONS = [
  'panel:access',
  'settings:write',
  'users:manage',
  'audit:read',
  'sport:write', // series, temporadas, competencias, rivales y canchas
  'players:write', // jugadores, inscripciones y cuerpo técnico
  'matches:write',
  'matches:live',
  'standings:write',
  'news:write',
  'history:write',
  'pages:write',
  'media:write',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  // Roles futuros: sin permisos hasta que se habiliten.
  editor: [],
  delegado: [],
  prensa: [],
}

export type PermissionSubject = { role?: string | null; banned?: boolean | null }

function isUserRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(role)
}

export function can(user: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!user || user.banned) return false
  // Better Auth guarda `role` como texto y admite varios separados por coma.
  const roles = (user.role ?? '').split(',').map((r) => r.trim())
  return roles.some((role) => isUserRole(role) && ROLE_PERMISSIONS[role].includes(permission))
}
