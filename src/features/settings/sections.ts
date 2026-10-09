/** Secciones de Configuración (especificación 7.7): un formulario corto por cada una. Lógica pura. */
export const SETTINGS_SECTIONS = {
  club: {
    label: 'Datos del club',
    description: 'El nombre con que aparece el club en todo el sitio.',
  },
  contacto: {
    label: 'Contacto y avisos',
    description: 'WhatsApp, teléfono y correo públicos, y quién recibe los avisos de cada formulario.',
  },
  redes: {
    label: 'Redes sociales',
    description: 'Los perfiles oficiales del club. Aparecen en el pie del sitio.',
  },
  ubicacion: {
    label: 'Dirección y mapa',
    description: 'Dónde queda la cancha del club, para «Cómo llegar».',
  },
  aportes: {
    label: 'Datos bancarios y aportes',
    description: 'La cuenta para transferencias y el enlace de pago, para socios y donaciones.',
  },
  portada: {
    label: 'Portada',
    description: 'La foto grande, el título y el botón con que abre el sitio.',
  },
  destacados: {
    label: 'Serie y auspiciador destacados',
    description: 'La serie que se muestra primero y el auspiciador de las tarjetas para redes.',
  },
  seo: {
    label: 'Buscadores y redes',
    description: 'El texto y la imagen que aparecen en Google y al compartir el sitio.',
  },
} as const

export type SettingsSection = keyof typeof SETTINGS_SECTIONS

export const SETTINGS_SECTION_KEYS = Object.keys(SETTINGS_SECTIONS) as SettingsSection[]

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && Object.hasOwn(SETTINGS_SECTIONS, value)
}
