import { pgEnum } from 'drizzle-orm/pg-core'

// Enums nativos (especificación 8.3). Agregar un valor = nueva migración.

// user.role es texto gestionado por Better Auth (plugin admin); sus valores válidos se fijan en código.
export const USER_ROLES = ['admin', 'editor', 'delegado', 'prensa'] as const // v1: solo 'admin'

export const seriesKind = pgEnum('series_kind', ['adulta', 'senior', 'juvenil', 'formativa'])
export const competitionKind = pgEnum('competition_kind', [
  'liga',
  'copa',
  'regional',
  'nacional',
  'amistoso',
  'verano',
])
export const matchStatus = pgEnum('match_status', [
  'programado',
  'en_vivo',
  'finalizado',
  'suspendido',
  'postergado',
  'cancelado',
])
export const matchPeriod = pgEnum('match_period', [
  'previa',
  'primer_tiempo',
  'entretiempo',
  'segundo_tiempo',
  'alargue',
  'penales',
  'terminado',
])
export const matchResolution = pgEnum('match_resolution', ['normal', 'penales', 'walkover', 'secretaria'])
export const matchEventType = pgEnum('match_event_type', [
  'gol',
  'gol_penal',
  'autogol',
  'penal_errado',
  'tarjeta_amarilla',
  'segunda_amarilla',
  'tarjeta_roja',
  'cambio',
  'comentario',
])
export const clubSide = pgEnum('club_side', ['local', 'visita', 'ninguno'])
export const playerPosition = pgEnum('player_position', ['arquero', 'defensa', 'mediocampista', 'delantero'])
export const positionDetail = pgEnum('position_detail', [
  'central',
  'lateral_derecho',
  'lateral_izquierdo',
  'volante_contencion',
  'volante_mixto',
  'volante_creativo',
  'extremo_derecho',
  'extremo_izquierdo',
  'centrodelantero',
])
export const lineupRole = pgEnum('lineup_role', ['titular', 'suplente'])
export const registrationStatus = pgEnum('registration_status', ['activo', 'lesionado', 'baja'])
export const staffRole = pgEnum('staff_role', [
  'director_tecnico',
  'ayudante_tecnico',
  'preparador_fisico',
  'preparador_arqueros',
  'kinesiologo',
  'delegado',
  'utilero',
  'coordinador_formativas',
])
export const standingsMode = pgEnum('standings_mode', ['manual', 'calculada'])
export const newsStatus = pgEnum('news_status', ['borrador', 'programada', 'publicada', 'archivada'])
export const newsType = pgEnum('news_type', ['noticia', 'cronica', 'comunicado', 'entrevista', 'galeria'])
export const eventType = pgEnum('event_type', [
  'completada',
  'bingo',
  'rifa',
  'aniversario',
  'campeonato_verano',
  'asamblea',
  'actividad_social',
  'otro',
])
export const eventStatus = pgEnum('event_status', ['programado', 'realizado', 'cancelado'])
export const sponsorTier = pgEnum('sponsor_tier', ['principal', 'oficial', 'colaborador'])
export const documentCategory = pgEnum('document_category', [
  'acta',
  'balance',
  'rendicion',
  'estatutos',
  'reglamento',
  'memoria',
  'otro',
])
export const inboxStatus = pgEnum('inbox_status', [
  'nueva',
  'en_revision',
  'respondida',
  'aprobada',
  'rechazada',
  'archivada',
])
export const contactTopic = pgEnum('contact_topic', [
  'general',
  'socios',
  'auspicios',
  'formativas',
  'prensa',
  'historia',
])
export const memberStatus = pgEnum('member_status', ['activo', 'suspendido', 'baja'])
export const feePeriod = pgEnum('fee_period', ['mensual', 'trimestral', 'semestral', 'anual', 'unico'])
export const datePrecision = pgEnum('date_precision', ['dia', 'mes', 'anio'])
export const socialPlatform = pgEnum('social_platform', ['instagram', 'facebook', 'tiktok', 'youtube', 'x'])
export const videoProvider = pgEnum('video_provider', ['youtube', 'facebook'])
export const mediaKind = pgEnum('media_kind', ['imagen', 'documento'])
export const opsRunKind = pgEnum('ops_run_kind', ['respaldo', 'prueba_restauracion', 'limpieza', 'disco'])
export const opsRunStatus = pgEnum('ops_run_status', ['ok', 'error'])
