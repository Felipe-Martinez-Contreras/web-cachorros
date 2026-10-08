import { House, type LucideIcon, Palette } from 'lucide-react'
import type { Permission } from '@/lib/permissions'

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  permission: Permission
  /** Aparece en la barra inferior del celular (máximo 4; el resto va en «Más»). */
  primary?: boolean
}

export type AdminNavGroup = { label: string; items: AdminNavItem[] }

/** Módulos del panel (especificación 7.2). Cada módulo se agrega aquí cuando su página existe. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'General',
    items: [{ href: '/admin', label: 'Inicio', icon: House, permission: 'panel:access', primary: true }],
  },
  {
    label: 'Sistema',
    items: [
      {
        href: '/admin/sistema-de-diseno',
        label: 'Sistema de diseño',
        icon: Palette,
        permission: 'panel:access',
      },
    ],
  },
]
