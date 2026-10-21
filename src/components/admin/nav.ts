import {
  Building2,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  ClipboardList,
  Contact,
  FileText,
  GalleryHorizontalEnd,
  Handshake,
  History,
  House,
  Images,
  Inbox,
  KeyRound,
  Landmark,
  ListOrdered,
  type LucideIcon,
  MapPin,
  Newspaper,
  Palette,
  Settings,
  Shield,
  ShieldCheck,
  ShieldHalf,
  ShoppingBag,
  Trophy,
  UserCog,
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
      {
        href: '/admin/galeria',
        label: 'Galería y videos',
        icon: GalleryHorizontalEnd,
        permission: 'gallery:write',
      },
      { href: '/admin/textos', label: 'Textos de páginas', icon: FileText, permission: 'pages:write' },
      { href: '/admin/medios', label: 'Medios', icon: Images, permission: 'media:write' },
    ],
  },
  {
    label: 'Comunidad',
    items: [
      { href: '/admin/socios', label: 'Socios', icon: Contact, permission: 'members:write' },
      { href: '/admin/mensajes', label: 'Mensajes', icon: Inbox, permission: 'messages:write' },
      {
        href: '/admin/auspiciadores',
        label: 'Auspiciadores',
        icon: Handshake,
        permission: 'sponsors:write',
      },
      { href: '/admin/eventos', label: 'Eventos', icon: CalendarHeart, permission: 'events:write' },
      { href: '/admin/tienda', label: 'Tienda', icon: ShoppingBag, permission: 'store:write' },
      { href: '/admin/club', label: 'Club', icon: Building2, permission: 'club:write' },
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
      { href: '/admin/usuarios', label: 'Usuarios', icon: UserCog, permission: 'users:manage' },
      { href: '/admin/actividad', label: 'Actividad', icon: History, permission: 'audit:read' },
      {
        href: '/admin/datos-personales',
        label: 'Datos personales',
        icon: ShieldCheck,
        permission: 'privacy:manage',
      },
      { href: '/admin/cuenta', label: 'Mi cuenta', icon: KeyRound, permission: 'panel:access' },
      {
        href: '/admin/sistema-de-diseno',
        label: 'Sistema de diseño',
        icon: Palette,
        permission: 'panel:access',
      },
    ],
  },
]
