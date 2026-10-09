import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileText,
  House,
  Images,
  Landmark,
  ListOrdered,
  type LucideIcon,
  MapPin,
  Newspaper,
  Palette,
  Settings,
  Shield,
  ShieldHalf,
  Trophy,
  Users,
} from 'lucide-react'
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
    label: 'Partidos',
    items: [
      {
        href: '/admin/partidos',
        label: 'Partidos',
        icon: CalendarDays,
        permission: 'matches:write',
        primary: true,
      },
      { href: '/admin/posiciones', label: 'Posiciones', icon: ListOrdered, permission: 'standings:write' },
    ],
  },
  {
    label: 'Plantel',
    items: [
      {
        href: '/admin/jugadores',
        label: 'Jugadores',
        icon: Users,
        permission: 'players:write',
        primary: true,
      },
      {
        href: '/admin/cuerpo-tecnico',
        label: 'Cuerpo técnico',
        icon: ClipboardList,
        permission: 'players:write',
      },
    ],
  },
  {
    label: 'Competencia',
    items: [
      { href: '/admin/series', label: 'Series', icon: Shield, permission: 'sport:write' },
      { href: '/admin/temporadas', label: 'Temporadas', icon: CalendarRange, permission: 'sport:write' },
      { href: '/admin/competencias', label: 'Competencias', icon: Trophy, permission: 'sport:write' },
      { href: '/admin/rivales', label: 'Rivales', icon: ShieldHalf, permission: 'sport:write' },
      { href: '/admin/canchas', label: 'Canchas', icon: MapPin, permission: 'sport:write' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      {
        href: '/admin/noticias',
        label: 'Noticias',
        icon: Newspaper,
        permission: 'news:write',
        primary: true,
      },
      { href: '/admin/historia', label: 'Historia', icon: Landmark, permission: 'history:write' },
      { href: '/admin/textos', label: 'Textos de páginas', icon: FileText, permission: 'pages:write' },
      { href: '/admin/medios', label: 'Medios', icon: Images, permission: 'media:write' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        href: '/admin/configuracion',
        label: 'Configuración',
        icon: Settings,
        permission: 'settings:write',
      },
      {
        href: '/admin/sistema-de-diseno',
        label: 'Sistema de diseño',
        icon: Palette,
        permission: 'panel:access',
      },
    ],
  },
]
