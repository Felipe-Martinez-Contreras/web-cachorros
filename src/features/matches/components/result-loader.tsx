'use client' // Cliente: carga de resultado después del partido (nómina, eventos y cierre) con respuesta inmediata.

import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field, SelectField, TextareaField } from '@/components/ui/field'
import type { ActionResult } from '@/lib/action-result'
import { optionsFromLabels } from '@/lib/form-schemas'
import { matchEventTypeLabels, matchResolutionLabels, playerPositionGroupLabels } from '@/lib/labels'
import type { SheetEvent, SheetLineupRow, SheetPlayer } from '../admin-queries'
import { formatMinute } from '../lib/match-clock'
import { type MatchEventInput, type MatchResultInput, matchEventSchema, matchResultSchema } from '../schemas'

type Outcome = Promise<ActionResult<unknown>>

export type ResultLoaderProps = {
  match: {
    homeName: string
    awayName: string
    clubSide: 'local' | 'visita' | 'ninguno'
    status: string
    resolution: MatchResultInput['resolution']
    homeScore: number
    awayScore: number
    homePenalties: number | null
    awayPenalties: number | null
    scoreLocked: boolean
  }
  squad: SheetPlayer[]
  lineup: SheetLineupRow[]
  events: SheetEvent[]
  hasPreviousLineup: boolean
  actions: {
    saveLineup: (input: unknown) => Outcome
    copyLineup: () => Outcome
    addEvent: (input: unknown) => Outcome
    deleteEvent: (eventId: string) => Outcome
    finish: (input: unknown) => Outcome
  }
}

const sectionClass = 'grid gap-3 rounded-lg border border-neutral-200 bg-paper p-4'

/** Ejecuta una Server Action con protección contra doble toque, aviso del resultado y recarga de datos. */
function useRunner() {
  const router = useRouter()
  const toast = useToast()
  const [pending, setPending] = useState<string | null>(null)
  async function run(
    key: string,
    action: () => Outcome,
    success: string,
  ): Promise<ActionResult<unknown> | null> {
    if (pending) return null
    setPending(key)
    try {
      const result = await action()
      if (result.ok) {
        toast({ message: success })
        router.refresh()
      } else if (!result.fieldErrors) {
        toast({ variant: 'danger', message: result.message })
      }
      return result
    } finally {
      setPending(null)
    }
  }
  return { pending, run }
}

/**
 * UUID para la idempotencia de un evento. `crypto.randomUUID` solo existe en contextos seguros (HTTPS o
 * localhost): al probar desde el celular por la red local hace falta este respaldo.
 */
function newEventId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ───────────────────────── Nómina ─────────────────────────

type LineupState = 'no' | 'titular' | 'entro' | 'banca'

const LINEUP_LABELS: Record<LineupState, string> = {
  no: 'No citado',
  titular: 'Titular',
  entro: 'Suplente: entró',
  banca: 'Suplente: no entró',
}

function stateOf(row: SheetLineupRow | undefined): LineupState {
  if (!row) return 'no'
  if (row.role === 'titular') return 'titular'
  return row.played ? 'entro' : 'banca'
}

function LineupSection({ squad, lineup, hasPreviousLineup, actions }: ResultLoaderProps) {
  const uid = useId()
  const { pending, run } = useRunner()
  const byPlayer = new Map(lineup.map((row) => [row.playerId, row]))
  const [rows, setRows] = useState(() =>
    squad.map((player) => {
      const saved = byPlayer.get(player.playerId)
      return {
        playerId: player.playerId,
        state: stateOf(saved),
        shirtNumber: String(saved?.shirtNumber ?? player.shirtNumber ?? ''),
      }
    }),
  )
  const [error, setError] = useState<string>()
  const called = rows.filter((row) => row.state !== 'no')
  const starters = rows.filter((row) => row.state === 'titular').length

  function update(playerId: string, patch: Partial<(typeof rows)[number]>) {
    setRows((all) => all.map((row) => (row.playerId === playerId ? { ...row, ...patch } : row)))
  }

  async function save() {
    setError(undefined)
    const result = await run(
      'lineup',
      () =>
        actions.saveLineup({
          players: called.map((row) => ({
            playerId: row.playerId,
            role: row.state === 'titular' ? 'titular' : 'suplente',
            shirtNumber: row.shirtNumber,
            played: row.state !== 'banca',
          })),
        }),
      'Nómina guardada.',
    )
    if (result && !result.ok) setError(result.fieldErrors?.players?.[0] ?? result.message)
  }

  const groups = (['arquero', 'defensa', 'mediocampista', 'delantero'] as const)
    .map((position) => ({ position, players: squad.filter((player) => player.position === position) }))
    .filter((group) => group.players.length > 0)

  return (
    <section aria-labelledby={`${uid}-title`} className={sectionClass}>
      <h2 id={`${uid}-title`} className="text-lg font-bold">
        1. Nómina
      </h2>
      {squad.length === 0 ? (
        <Alert title="No hay jugadores inscritos en esta serie">
          Inscríbelos en Jugadores para poder armar la nómina y registrar quién hizo los goles.
        </Alert>
      ) : (
        <>
          {lineup.length === 0 && hasPreviousLineup && (
            <div>
              <Button
                variant="outline"
                size="lg"
                loading={pending === 'copy'}
                onClick={() => run('copy', actions.copyLineup, 'Nómina copiada del partido anterior.')}
              >
                Usar nómina del partido anterior
              </Button>
            </div>
          )}
          {groups.map((group) => (
            <fieldset key={group.position} className="grid gap-2">
              <legend className="mb-1 text-eyebrow text-neutral-600">
                {playerPositionGroupLabels[group.position]}
              </legend>
              {group.players.map((player) => {
                const row = rows.find((item) => item.playerId === player.playerId)
                if (!row) return null
                return (
                  <div
                    key={player.playerId}
                    className="grid grid-cols-[1fr_4.5rem] items-end gap-2 sm:grid-cols-[1fr_14rem_4.5rem]"
                  >
                    <p className="col-span-2 font-medium sm:col-span-1 sm:self-center">{player.name}</p>
                    <label className="grid gap-1 text-sm">
                      <span className="sr-only">Participación de {player.name}</span>
                      <select
                        value={row.state}
                        onChange={(event) =>
                          update(player.playerId, { state: event.target.value as LineupState })
                        }
                        className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-2 text-base"
                      >
                        {(Object.keys(LINEUP_LABELS) as LineupState[]).map((state) => (
                          <option key={state} value={state}>
                            {LINEUP_LABELS[state]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="sr-only">Número de {player.name}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={99}
                        placeholder="N.º"
                        value={row.shirtNumber}
                        onChange={(event) => update(player.playerId, { shirtNumber: event.target.value })}
                        className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-2 text-base"
                      />
                    </label>
                  </div>
                )
              })}
            </fieldset>
          ))}
          {error && (
            <p role="alert" className="font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="dark" size="lg" loading={pending === 'lineup'} onClick={save}>
              Guardar nómina
            </Button>
            <p className="text-sm text-neutral-600" role="status">
              {called.length} citados · {starters} titulares
            </p>
          </div>
        </>
      )}
    </section>
  )
}

// ───────────────────────── Eventos ─────────────────────────

type EventKind = 'gol_club' | 'gol_rival' | 'tarjeta' | 'cambio' | 'otro'

const KIND_LABELS: Record<EventKind, string> = {
  gol_club: 'Gol nuestro',
  gol_rival: 'Gol rival',
  tarjeta: 'Tarjeta',
  cambio: 'Cambio',
  otro: 'Otro',
}

/** Tipos de evento que ofrece cada botón y a qué equipo pertenecen. */
const KIND_TYPES: Record<
  EventKind,
  { value: string; type: MatchEventInput['type']; team: 'club' | 'rival'; label: string }[]
> = {
  gol_club: [
    { value: 'gol', type: 'gol', team: 'club', label: 'Gol' },
    { value: 'gol_penal', type: 'gol_penal', team: 'club', label: 'Gol de penal' },
    { value: 'autogol_rival', type: 'autogol', team: 'rival', label: 'Autogol del rival (a favor nuestro)' },
  ],
  gol_rival: [
    { value: 'gol', type: 'gol', team: 'rival', label: 'Gol' },
    { value: 'gol_penal', type: 'gol_penal', team: 'rival', label: 'Gol de penal' },
    { value: 'autogol_club', type: 'autogol', team: 'club', label: 'Autogol nuestro (en contra)' },
  ],
  tarjeta: [
    {
      value: 'amarilla_club',
      type: 'tarjeta_amarilla',
      team: 'club',
      label: 'Amarilla a un jugador nuestro',
    },
    {
      value: 'segunda_club',
      type: 'segunda_amarilla',
      team: 'club',
      label: 'Segunda amarilla a uno nuestro',
    },
    { value: 'roja_club', type: 'tarjeta_roja', team: 'club', label: 'Roja a un jugador nuestro' },
    { value: 'amarilla_rival', type: 'tarjeta_amarilla', team: 'rival', label: 'Amarilla al rival' },
    { value: 'segunda_rival', type: 'segunda_amarilla', team: 'rival', label: 'Segunda amarilla al rival' },
    { value: 'roja_rival', type: 'tarjeta_roja', team: 'rival', label: 'Roja al rival' },
  ],
  cambio: [{ value: 'cambio', type: 'cambio', team: 'club', label: 'Cambio nuestro' }],
  otro: [
    { value: 'penal_errado', type: 'penal_errado', team: 'club', label: 'Penal errado por uno nuestro' },
    { value: 'penal_errado_rival', type: 'penal_errado', team: 'rival', label: 'Penal errado por el rival' },
    { value: 'comentario', type: 'comentario', team: 'club', label: 'Comentario para la cronología' },
  ],
}

type EventFormValues = {
  variant: string
  playerId: string
  relatedPlayerId: string
  freeTextName: string
  minute: string
  stoppageMinute: string
  comment: string
}

function EventForm({
  kind,
  players,
  addEvent,
  onDone,
}: {
  kind: EventKind
  players: SheetPlayer[]
  addEvent: (input: unknown) => Outcome
  onDone: () => void
}) {
  const uid = useId()
  const { run } = useRunner()
  // Un identificador por formulario abierto: si el mismo envío llega dos veces, el servidor lo ignora.
  const clientEventId = useRef(newEventId())
  const variants = KIND_TYPES[kind]
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<EventFormValues>({
    defaultValues: {
      variant: variants[0]?.value ?? '',
      playerId: '',
      relatedPlayerId: '',
      freeTextName: '',
      minute: '',
      stoppageMinute: '',
      comment: '',
    },
    resolver: (async (values, context, options) => {
      const variant = variants.find((item) => item.value === values.variant) ?? variants[0]
      const input = {
        ...values,
        type: variant?.type,
        team: variant?.team,
        clientEventId: clientEventId.current,
      }
      return zodResolver(matchEventSchema as never)(input as never, context, options as never)
    }) as Resolver<EventFormValues>,
  })
  const { errors, isSubmitting } = form.formState
  const variant = variants.find((item) => item.value === form.watch('variant')) ?? variants[0]
  const isClub = variant?.team === 'club'
  const isComment = variant?.type === 'comentario'
  const isChange = variant?.type === 'cambio'
  const playerOptional = variant?.type === 'autogol'

  const onSubmit = form.handleSubmit(async () => {
    setFormError(null)
    const values = form.getValues()
    const result = await run(
      'event',
      () =>
        addEvent({
          ...values,
          type: variant?.type,
          team: variant?.team,
          clientEventId: clientEventId.current,
        }),
      'Registrado.',
    )
    if (!result) return
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof EventFormValues, { type: 'server', message: messages[0] })
      }
      setFormError(result.message)
      return
    }
    onDone()
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormBody className="grid gap-3 rounded-md border-2 border-ink p-3">
        <h3 className="font-bold">{KIND_LABELS[kind]}</h3>
        {formError && <Alert variant="danger">{formError}</Alert>}
        {variants.length > 1 && (
          <SelectField id={`${uid}-variant`} label="Tipo" {...form.register('variant')}>
            {variants.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
        )}
        {isComment ? (
          <TextareaField
            id={`${uid}-comment`}
            label="Comentario"
            help="Hasta 280 caracteres. Se ve en la cronología pública del partido."
            maxLength={280}
            rows={3}
            error={errors.comment?.message}
            {...form.register('comment')}
          />
        ) : (
          <>
            {isClub ? (
              <SelectField
                id={`${uid}-player`}
                label={isChange ? 'Sale' : 'Jugador'}
                required={playerOptional ? false : undefined}
                error={errors.playerId?.message}
                {...form.register('playerId')}
              >
                <option value="">{playerOptional ? 'Sin especificar' : 'Elige al jugador'}</option>
                {players.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.shirtNumber ? `${player.shirtNumber} · ` : ''}
                    {player.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <Field
                id={`${uid}-name`}
                label="Nombre del jugador rival"
                required={false}
                maxLength={80}
                error={errors.freeTextName?.message}
                {...form.register('freeTextName')}
              />
            )}
            {isChange && (
              <SelectField
                id={`${uid}-related`}
                label="Entra"
                error={errors.relatedPlayerId?.message}
                {...form.register('relatedPlayerId')}
              >
                <option value="">Elige al jugador</option>
                {players.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.shirtNumber ? `${player.shirtNumber} · ` : ''}
                    {player.name}
                  </option>
                ))}
              </SelectField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field
                id={`${uid}-minute`}
                label="Minuto"
                type="number"
                inputMode="numeric"
                min={1}
                max={150}
                required={false}
                error={errors.minute?.message}
                {...form.register('minute')}
              />
              <Field
                id={`${uid}-stoppage`}
                label="Adición"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                required={false}
                help="Para «45+2», escribe 45 y 2."
                error={errors.stoppageMinute?.message}
                {...form.register('stoppageMinute')}
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="dark" size="lg" loading={isSubmitting}>
            Registrar
          </Button>
          <Button variant="outline" size="lg" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </FormBody>
    </form>
  )
}

function eventLine(event: SheetEvent, match: ResultLoaderProps['match']): string {
  const minute = formatMinute(event.minute, event.stoppageMinute)
  const label = matchEventTypeLabels[event.type]
  if (event.type === 'comentario') return `${minute} ${label}: ${event.comment ?? ''}`.trim()
  const clubName = match.clubSide === 'local' ? match.homeName : match.awayName
  const rivalName = match.clubSide === 'local' ? match.awayName : match.homeName
  const team = event.team === 'club' ? clubName : rivalName
  const who =
    event.type === 'cambio'
      ? `sale ${event.playerName ?? '—'}, entra ${event.relatedPlayerName ?? '—'}`
      : (event.playerName ?? 'sin nombre')
  return `${minute} ${label} · ${who} (${team})`.trim()
}

function EventsSection({ match, squad, lineup, events, actions }: ResultLoaderProps) {
  const uid = useId()
  const { pending, run } = useRunner()
  const [kind, setKind] = useState<EventKind | null>(null)
  // Cada apertura monta un formulario nuevo (con su propio identificador de envío).
  const [opened, setOpened] = useState(0)
  // Primero quienes están en la nómina; si aún no hay nómina, todo el plantel.
  const inLineup = new Set(lineup.map((row) => row.playerId))
  const players = lineup.length > 0 ? squad.filter((player) => inLineup.has(player.playerId)) : squad

  return (
    <section aria-labelledby={`${uid}-title`} className={sectionClass}>
      <h2 id={`${uid}-title`} className="text-lg font-bold">
        2. Goles, tarjetas y cambios
      </h2>
      {match.scoreLocked && (
        <Alert title="El marcador de este partido es manual">
          Se definió por W.O. o por secretaría: los goles que registres aquí no cambian el marcador.
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(KIND_LABELS) as EventKind[]).map((item) => (
          <Button
            key={item}
            variant={item === 'gol_club' ? 'primary' : 'outline'}
            size="lg"
            aria-pressed={kind === item}
            onClick={() => {
              setKind(item)
              setOpened((count) => count + 1)
            }}
            className={item === 'gol_club' ? 'col-span-2 sm:col-span-1' : undefined}
          >
            {KIND_LABELS[item]}
          </Button>
        ))}
      </div>
      {kind && (
        <EventForm
          key={opened}
          kind={kind}
          players={players}
          addEvent={actions.addEvent}
          onDone={() => setKind(null)}
        />
      )}

      {events.length === 0 ? (
        <p className="text-neutral-600">
          Todavía no hay eventos. Parte por los goles: el marcador se arma solo.
        </p>
      ) : (
        <ol aria-label="Eventos registrados" className="grid gap-1">
          {events.map((event) => {
            const line = eventLine(event, match)
            return (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2 border-b border-neutral-200 py-1 last:border-0"
              >
                <span className="min-w-0 break-words">{line}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar: ${line}`}
                  loading={pending === event.id}
                  onClick={() => {
                    if (window.confirm(`¿Eliminar este evento?\n${line}`)) {
                      run(event.id, () => actions.deleteEvent(event.id), 'Evento eliminado.')
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ───────────────────────── Cierre ─────────────────────────

function FinishSection({ match, actions }: ResultLoaderProps) {
  const uid = useId()
  const { run } = useRunner()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const finished = match.status === 'finalizado'
  const neutral = match.clubSide === 'ninguno'
  const form = useForm<MatchResultInput>({
    resolver: zodResolver(matchResultSchema as never) as unknown as Resolver<MatchResultInput>,
    defaultValues: {
      resolution: match.resolution,
      homeScore: match.scoreLocked || neutral ? match.homeScore : '',
      awayScore: match.scoreLocked || neutral ? match.awayScore : '',
      homePenalties: match.homePenalties ?? '',
      awayPenalties: match.awayPenalties ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const resolution = form.watch('resolution')
  const manual = neutral || resolution === 'walkover' || resolution === 'secretaria'
  const home = manual ? String(form.watch('homeScore') ?? '') : String(match.homeScore)
  const away = manual ? String(form.watch('awayScore') ?? '') : String(match.awayScore)

  const submit = form.handleSubmit(async () => {
    setFormError(null)
    dialogRef.current?.close()
    const result = await run(
      'finish',
      () => actions.finish(form.getValues()),
      finished ? 'Resultado corregido.' : 'Partido finalizado.',
    )
    if (result && !result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof MatchResultInput, { type: 'server', message: messages[0] })
      }
      setFormError(result.message)
    }
  })

  const score = (name: 'homeScore' | 'awayScore' | 'homePenalties' | 'awayPenalties', label: string) => (
    <Field
      id={`${uid}-${name}`}
      label={label}
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      error={errors[name]?.message}
      {...form.register(name)}
    />
  )

  return (
    <section aria-labelledby={`${uid}-title`} className={sectionClass}>
      <h2 id={`${uid}-title`} className="text-lg font-bold">
        {neutral ? 'Marcador final' : '3. Cerrar el partido'}
      </h2>
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          // Primero se valida; si está bien, se pide confirmar el marcador final.
          if (await form.trigger()) dialogRef.current?.showModal()
        }}
      >
        <FormBody className="grid gap-3">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <SelectField
            id={`${uid}-resolution`}
            label="Cómo se definió"
            error={errors.resolution?.message}
            {...form.register('resolution')}
          >
            {optionsFromLabels(matchResolutionLabels).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          {manual ? (
            <div className="grid grid-cols-2 gap-3">
              {score('homeScore', `Goles de ${match.homeName}`)}
              {score('awayScore', `Goles de ${match.awayName}`)}
            </div>
          ) : (
            <p className="text-neutral-600">
              El marcador sale de los goles registrados:{' '}
              <span className="font-bold text-ink">
                {match.homeName} {match.homeScore} – {match.awayScore} {match.awayName}
              </span>
              . Si no calza, revisa los goles de arriba.
            </p>
          )}
          {resolution === 'penales' && (
            <div className="grid grid-cols-2 gap-3">
              {score('homePenalties', `Penales de ${match.homeName}`)}
              {score('awayPenalties', `Penales de ${match.awayName}`)}
            </div>
          )}
          <div>
            <Button type="submit" variant="dark" size="lg" loading={isSubmitting}>
              {finished ? 'Guardar corrección' : 'Finalizar partido'}
            </Button>
          </div>
        </FormBody>
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-confirm`}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-paper p-5 text-ink shadow-2xl backdrop:bg-ink/60"
      >
        <h3 id={`${uid}-confirm`} className="text-h3">
          {finished ? '¿Guardar la corrección?' : '¿Finalizar el partido?'}
        </h3>
        <p className="mt-3 text-center font-display text-2xl font-extrabold [font-stretch:75%]">
          {match.homeName} {home} – {away} {match.awayName}
        </p>
        <p className="mt-2 text-neutral-600">
          Queda como finalizado y se publica en el sitio. Las estadísticas y la tabla se actualizan solas.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="lg" onClick={() => dialogRef.current?.close()}>
            Volver
          </Button>
          <Button variant="dark" size="lg" onClick={submit}>
            {finished ? 'Sí, guardar' : 'Sí, finalizar'}
          </Button>
        </div>
      </dialog>
    </section>
  )
}

/**
 * «Cargar resultado» (modo post-partido, especificación 7.3): la consola sin reloj. Tres pasos en una
 * sola pantalla: nómina, eventos (el marcador se arma solo) y cierre.
 */
export function ResultLoader(props: ResultLoaderProps) {
  const { match } = props
  const neutral = match.clubSide === 'ninguno'
  return (
    // La nómina y los eventos tienen controles fuera de un <form>: todo espera a que la pantalla esté lista.
    <FormBody className="grid max-w-3xl gap-4">
      <p
        role="status"
        aria-label="Marcador actual"
        className="rounded-lg bg-ink p-4 text-center font-display text-2xl font-extrabold text-paper [font-stretch:75%]"
      >
        {match.homeName} <span className="tabular-nums">{match.homeScore}</span> –{' '}
        <span className="tabular-nums">{match.awayScore}</span> {match.awayName}
      </p>
      {neutral ? (
        <Alert title="Partido entre rivales">
          Sirve para la tabla calculada: solo se carga el marcador final, sin nómina ni goleadores.
        </Alert>
      ) : (
        <>
          <LineupSection {...props} />
          <EventsSection {...props} />
        </>
      )}
      <FinishSection {...props} />
    </FormBody>
  )
}
