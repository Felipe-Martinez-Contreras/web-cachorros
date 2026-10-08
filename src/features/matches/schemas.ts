import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredDate,
  requiredTime,
  requiredUuid,
} from '@/lib/form-schemas'
import { lineupRoleLabels, matchEventTypeLabels, matchResolutionLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

const ROUND_MESSAGE = 'El número de fecha va entre 1 y 60.'
const SCORE_MESSAGE = 'Escribe los goles (entre 0 y 99).'

export const matchSchema = z
  .object({
    competitionId: requiredUuid('Elige la competencia.'),
    seriesId: requiredUuid('Elige la serie.'),
    homeTeamId: requiredUuid('Elige el equipo local.'),
    awayTeamId: requiredUuid('Elige el equipo visita.'),
    date: requiredDate('Elige el día del partido.'),
    time: requiredTime('Escribe la hora del partido.'),
    venueId: optionalUuid(),
    roundNumber: optionalInt(1, 60, ROUND_MESSAGE),
    roundLabel: optionalText(40),
    notes: optionalText(300),
  })
  .refine((value) => value.homeTeamId !== value.awayTeamId, {
    path: ['awayTeamId'],
    message: 'El local y la visita no pueden ser el mismo equipo.',
  })
export type MatchFormValues = z.input<typeof matchSchema>

/** «Programar jornada» (7.4): varias series contra el mismo rival el mismo día. */
export const matchdaySchema = z
  .object({
    competitionId: requiredUuid('Elige la competencia.'),
    rivalId: requiredUuid('Elige el rival.'),
    condition: z.enum(['local', 'visita'], { error: 'Indica si el club juega de local o de visita.' }),
    date: requiredDate('Elige el día de la jornada.'),
    venueId: optionalUuid(),
    rows: z
      .array(
        z.object({
          seriesId: requiredUuid('Serie inválida.'),
          include: checkbox(),
          time: z.string(),
          roundNumber: optionalInt(1, 60, ROUND_MESSAGE),
        }),
      )
      .max(30),
  })
  .superRefine((value, ctx) => {
    const included = value.rows.filter((row) => row.include)
    if (included.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'Marca al menos una serie que juegue ese día.',
      })
    }
    value.rows.forEach((row, index) => {
      if (row.include && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) {
        ctx.addIssue({ code: 'custom', path: ['rows', index, 'time'], message: 'Escribe la hora.' })
      }
    })
  })
export type MatchdayFormValues = z.input<typeof matchdaySchema>

/** Postergar, suspender, cancelar o volver a programar (7.4). */
export const matchStatusSchema = z
  .object({
    status: z.enum(['programado', 'postergado', 'suspendido', 'cancelado'], { error: 'Elige el estado.' }),
    date: optionalDate('Elige el nuevo día.'),
    time: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().nullable(),
    ),
    notes: optionalText(300),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'programado' && (!value.date || !value.time)) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'Para volver a programarlo, indica el día y la hora.',
      })
    }
    if (value.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'Escribe una hora válida.' })
    }
    if (value.status !== 'programado' && !value.notes) {
      ctx.addIssue({
        code: 'custom',
        path: ['notes'],
        message: 'Cuenta brevemente el motivo: se muestra en el sitio.',
      })
    }
  })
export type MatchStatusFormValues = z.input<typeof matchStatusSchema>

export const lineupSchema = z
  .object({
    players: z
      .array(
        z.object({
          playerId: requiredUuid('Jugador inválido.'),
          role: labeledEnum(lineupRoleLabels, 'Indica si fue titular o suplente.'),
          shirtNumber: optionalInt(1, 99, 'El número va entre 1 y 99.'),
          played: checkbox(),
        }),
      )
      .max(40, 'La nómina admite hasta 40 jugadores.'),
  })
  .refine((value) => new Set(value.players.map((p) => p.playerId)).size === value.players.length, {
    path: ['players'],
    message: 'Un jugador aparece dos veces en la nómina.',
  })
export type LineupInput = z.input<typeof lineupSchema>

const CLUB_PLAYER_REQUIRED = new Set([
  'gol',
  'gol_penal',
  'penal_errado',
  'tarjeta_amarilla',
  'segunda_amarilla',
  'tarjeta_roja',
  'cambio',
])

export const matchEventSchema = z
  .object({
    type: labeledEnum(matchEventTypeLabels, 'Elige el tipo de evento.'),
    /** A quién pertenece el evento: el club o su rival. En un autogol, el equipo de quien lo hizo. */
    team: z.enum(['club', 'rival'], { error: 'Indica el equipo.' }),
    playerId: optionalUuid(),
    relatedPlayerId: optionalUuid(),
    freeTextName: optionalText(80),
    minute: optionalInt(1, 150, 'El minuto va entre 1 y 150.'),
    stoppageMinute: optionalInt(1, 30, 'La adición va entre 1 y 30 minutos.'),
    comment: optionalText(280),
    /** Idempotencia: el mismo toque enviado dos veces crea un solo evento. */
    clientEventId: optionalUuid(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'comentario') {
      if (!value.comment)
        ctx.addIssue({ code: 'custom', path: ['comment'], message: 'Escribe el comentario.' })
      return
    }
    if (value.team === 'club' && CLUB_PLAYER_REQUIRED.has(value.type) && !value.playerId) {
      ctx.addIssue({ code: 'custom', path: ['playerId'], message: 'Elige al jugador.' })
    }
    if (value.type === 'cambio' && value.team === 'club') {
      if (!value.relatedPlayerId) {
        ctx.addIssue({ code: 'custom', path: ['relatedPlayerId'], message: 'Elige al jugador que entra.' })
      } else if (value.relatedPlayerId === value.playerId) {
        ctx.addIssue({ code: 'custom', path: ['relatedPlayerId'], message: 'Entra y sale el mismo jugador.' })
      }
    }
  })
export type MatchEventInput = z.input<typeof matchEventSchema>

export const matchResultSchema = z
  .object({
    resolution: labeledEnum(matchResolutionLabels, 'Indica cómo se definió el partido.'),
    homeScore: optionalInt(0, 99, SCORE_MESSAGE),
    awayScore: optionalInt(0, 99, SCORE_MESSAGE),
    homePenalties: optionalInt(0, 99, SCORE_MESSAGE),
    awayPenalties: optionalInt(0, 99, SCORE_MESSAGE),
  })
  .superRefine((value, ctx) => {
    if (value.resolution === 'penales') {
      if (value.homePenalties === null) {
        ctx.addIssue({ code: 'custom', path: ['homePenalties'], message: 'Escribe los penales convertidos.' })
      }
      if (value.awayPenalties === null) {
        ctx.addIssue({ code: 'custom', path: ['awayPenalties'], message: 'Escribe los penales convertidos.' })
      }
      if (value.homePenalties !== null && value.homePenalties === value.awayPenalties) {
        ctx.addIssue({
          code: 'custom',
          path: ['awayPenalties'],
          message: 'Una definición por penales no puede terminar empatada.',
        })
      }
    }
  })
export type MatchResultInput = z.input<typeof matchResultSchema>
