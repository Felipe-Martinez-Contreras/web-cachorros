import type {
  competitionKind,
  contactTopic,
  documentCategory,
  eventStatus,
  eventType,
  feePeriod,
  inboxStatus,
  lineupRole,
  matchEventType,
  matchPeriod,
  matchResolution,
  matchStatus,
  memberStatus,
  newsStatus,
  newsType,
  playerPosition,
  positionDetail,
  registrationStatus,
  seriesKind,
  socialPlatform,
  sponsorTier,
  staffRole,
  standingsMode,
} from '@/db/schema/enums'

// Etiquetas visibles de los enums del dominio, en un solo lugar (especificación 3.9).
type Labels<E extends { enumValues: readonly string[] }> = Record<E['enumValues'][number], string>

export const seriesKindLabels: Labels<typeof seriesKind> = {
  adulta: 'Adulta',
  senior: 'Senior',
  juvenil: 'Juvenil',
  formativa: 'Formativa',
}

export const competitionKindLabels: Labels<typeof competitionKind> = {
  liga: 'Campeonato',
  copa: 'Copa',
  regional: 'Regional',
  nacional: 'Nacional',
  amistoso: 'Amistoso',
  verano: 'Campeonato de verano',
}

export const matchStatusLabels: Labels<typeof matchStatus> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
  suspendido: 'Suspendido',
  postergado: 'Postergado',
  cancelado: 'Cancelado',
}

export const matchPeriodLabels: Labels<typeof matchPeriod> = {
  previa: 'Previa',
  primer_tiempo: '1.er tiempo',
  entretiempo: 'Entretiempo',
  segundo_tiempo: '2.º tiempo',
  alargue: 'Alargue',
  penales: 'Penales',
  terminado: 'Terminado',
}

export const matchResolutionLabels: Labels<typeof matchResolution> = {
  normal: 'Resultado en cancha',
  penales: 'Definido por penales',
  walkover: 'W.O.',
  secretaria: 'Por secretaría',
}

export const matchEventTypeLabels: Labels<typeof matchEventType> = {
  gol: 'Gol',
  gol_penal: 'Gol de penal',
  autogol: 'Autogol',
  penal_errado: 'Penal errado',
  tarjeta_amarilla: 'Tarjeta amarilla',
  segunda_amarilla: 'Segunda amarilla',
  tarjeta_roja: 'Tarjeta roja',
  cambio: 'Cambio',
  comentario: 'Comentario',
}

export const playerPositionLabels: Labels<typeof playerPosition> = {
  arquero: 'Arquero',
  defensa: 'Defensa',
  mediocampista: 'Mediocampista',
  delantero: 'Delantero',
}

export const playerPositionGroupLabels: Labels<typeof playerPosition> = {
  arquero: 'Arqueros',
  defensa: 'Defensas',
  mediocampista: 'Mediocampistas',
  delantero: 'Delanteros',
}

export const positionDetailLabels: Labels<typeof positionDetail> = {
  central: 'Central',
  lateral_derecho: 'Lateral derecho',
  lateral_izquierdo: 'Lateral izquierdo',
  volante_contencion: 'Volante de contención',
  volante_mixto: 'Volante mixto',
  volante_creativo: 'Volante creativo',
  extremo_derecho: 'Extremo derecho',
  extremo_izquierdo: 'Extremo izquierdo',
  centrodelantero: 'Centrodelantero',
}

export const lineupRoleLabels: Labels<typeof lineupRole> = { titular: 'Titular', suplente: 'Suplente' }

export const registrationStatusLabels: Labels<typeof registrationStatus> = {
  activo: 'Activo',
  lesionado: 'Lesionado',
  baja: 'Baja',
}

export const staffRoleLabels: Labels<typeof staffRole> = {
  director_tecnico: 'Director técnico',
  ayudante_tecnico: 'Ayudante técnico',
  preparador_fisico: 'Preparador físico',
  preparador_arqueros: 'Preparador de arqueros',
  kinesiologo: 'Kinesiólogo',
  delegado: 'Delegado',
  utilero: 'Utilero',
  coordinador_formativas: 'Coordinador de formativas',
}

export const standingsModeLabels: Labels<typeof standingsMode> = {
  manual: 'Manual',
  calculada: 'Calculada',
}

export const newsStatusLabels: Labels<typeof newsStatus> = {
  borrador: 'Borrador',
  programada: 'Programada',
  publicada: 'Publicada',
  archivada: 'Archivada',
}

export const newsTypeLabels: Labels<typeof newsType> = {
  noticia: 'Noticia',
  cronica: 'Crónica',
  comunicado: 'Comunicado oficial',
  entrevista: 'Entrevista',
  galeria: 'Galería',
}

export const eventTypeLabels: Labels<typeof eventType> = {
  completada: 'Completada',
  bingo: 'Bingo',
  rifa: 'Rifa',
  aniversario: 'Aniversario',
  campeonato_verano: 'Campeonato de verano',
  asamblea: 'Asamblea',
  actividad_social: 'Actividad social',
  otro: 'Actividad',
}

export const eventStatusLabels: Labels<typeof eventStatus> = {
  programado: 'Programado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const sponsorTierLabels: Labels<typeof sponsorTier> = {
  principal: 'Auspiciador principal',
  oficial: 'Auspiciador oficial',
  colaborador: 'Colaborador',
}

export const documentCategoryLabels: Labels<typeof documentCategory> = {
  acta: 'Acta',
  balance: 'Balance',
  rendicion: 'Rendición',
  estatutos: 'Estatutos',
  reglamento: 'Reglamento',
  memoria: 'Memoria',
  otro: 'Otro',
}

export const inboxStatusLabels: Labels<typeof inboxStatus> = {
  nueva: 'Nueva',
  en_revision: 'En revisión',
  respondida: 'Respondida',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  archivada: 'Archivada',
}

export const contactTopicLabels: Labels<typeof contactTopic> = {
  general: 'Consulta general',
  socios: 'Socios',
  auspicios: 'Auspicios',
  formativas: 'Formativas',
  prensa: 'Prensa',
  historia: 'Historia',
}

export const memberStatusLabels: Labels<typeof memberStatus> = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  baja: 'Baja',
}

export const feePeriodLabels: Labels<typeof feePeriod> = {
  mensual: 'al mes',
  trimestral: 'al trimestre',
  semestral: 'al semestre',
  anual: 'al año',
  unico: 'pago único',
}

export const socialPlatformLabels: Labels<typeof socialPlatform> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
}

export const weekdayLabels: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}
