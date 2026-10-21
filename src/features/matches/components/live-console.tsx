'use client' // Cliente: consola en vivo del celular (botones grandes, cola sin conexión, reloj y Wake Lock).

import { CloudOff, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field, TextareaField } from '@/components/ui/field'
import type { ActionResult } from '@/lib/action-result'
import { cn } from '@/lib/cn'
import { matchEventTypeLabels, matchPeriodLabels } from '@/lib/labels'
import type { ConsoleSnapshot, SheetEvent, SheetPlayer } from '../admin-queries'
import { newClientId } from '../lib/client-id'
import { availableTransitions, type PeriodTransition, resolveTransition } from '../lib/live'
import { formatMinute, suggestedMinute } from '../lib/match-clock'
import { type QueuedAction, queueStatusText } from '../lib/offline-queue'
import { matchEventSchema } from '../schemas'
import { LineupSection } from './result-loader'
import { type Senders, useConsoleQueue } from './use-console-queue'

type Period = SheetEvent['period']
type EventType = SheetEvent['type']
type Outcome = Promise<ActionResult<unknown>>

export type LiveConsoleProps = {
  matchId: string
  /** Estado inicial (del servidor); la consola lo relee con `online.read` tras cada acción confirmada. */
  snapshot: ConsoleSnapshot
  senders: Senders
  online: {
    read: () => Promise<ActionResult<ConsoleSnapshot>>
    deleteEvent: (eventId: string) => Outcome
    editEvent: (eventId: string, input: unknown) => Outcome
    saveLineup: (input: unknown) => Outcome
    copyLineup: () => Outcome
  }
}

const TRANSITION_LABELS: Record<PeriodTransition, string> = {
  iniciar_primer_tiempo: 'Iniciar 1.er tiempo',
  terminar_primer_tiempo: 'Fin del 1.er tiempo',
  iniciar_segundo_tiempo: 'Iniciar 2.º tiempo',
  iniciar_alargue: 'Iniciar alargue',
  iniciar_penales: 'Ir a penales',
}

/** Qué se registra con cada botón grande: tipos posibles, equipo y qué datos pide. */
type SheetKind =
  | 'gol_club'
  | 'gol_rival'
  | 'autogol_rival'
  | 'tarjeta'
  | 'cambio'
  | 'comentario'
  | 'penal_errado'

const SHEETS: Record<
  SheetKind,
  {
    title: string
    types: EventType[]
    team: 'club' | 'rival' | 'elegir'
    player?: boolean
    related?: boolean
  }
> = {
  gol_club: { title: 'Gol del club', types: ['gol', 'gol_penal'], team: 'club', player: true },
  gol_rival: { title: 'Gol rival', types: ['gol', 'gol_penal'], team: 'rival' },
  autogol_rival: { title: 'Autogol del rival', types: ['autogol'], team: 'rival' },
  tarjeta: {
    title: 'Tarjeta',
    types: ['tarjeta_amarilla', 'segunda_amarilla', 'tarjeta_roja'],
    team: 'elegir',
    player: true,
  },
  cambio: { title: 'Cambio', types: ['cambio'], team: 'club', player: true, related: true },
  penal_errado: { title: 'Penal errado', types: ['penal_errado'], team: 'elegir', player: true },
  comentario: { title: 'Comentario', types: ['comentario'], team: 'club' },
}

function vibrate() {
  try {
    navigator.vibrate?.(40)
  } catch {
    // Sin vibración: no pasa nada.
  }
}

/** Pantalla encendida durante el partido (Wake Lock), donde el navegador lo permita. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          lock = sentinel
        })
        .catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void lock?.release().catch(() => {})
    }
  }, [active])
}

/** El reloj de la consola: minuto sugerido, recalculado cada 10 s. */
function useSuggestedMinute(match: ConsoleSnapshot['match'], period: Period) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(timer)
  }, [])
  if (now === null) return null
  return suggestedMinute(
    { period, periodStartedAt: match.periodStartedAt, halfLengthMinutes: match.halfLengthMinutes },
    new Date(now),
  )
}

/** Lo que verá la consola mientras hay acciones sin confirmar: el período y el marcador esperados. */
function optimistic(data: ConsoleSnapshot, queue: QueuedAction[]) {
  let period = data.match.period
  let status = data.match.status
  let { homeScore, awayScore } = data.match
  const clubIsHome = data.match.clubSide === 'local'
  for (const action of queue) {
    if (action.status !== 'pending') continue
    if (action.kind === 'period') {
      const result = resolveTransition({ status, period }, action.input.transition as PeriodTransition)
      if (result.kind === 'apply') {
        period = result.period
        status = 'en_vivo'
      }
    }
    if (action.kind === 'event' && !data.match.scoreLocked) {
      const type = action.input.type
      const club = action.input.team === 'club'
      const scored = type === 'gol' || type === 'gol_penal' ? club : type === 'autogol' ? !club : null
      if (scored !== null && period !== 'penales') {
        if (scored === clubIsHome) homeScore += 1
        else awayScore += 1
      }
    }
  }
  return { period, status, homeScore, awayScore }
}

function playerLabel(player: SheetPlayer) {
  return `${player.shirtNumber ? `${player.shirtNumber} · ` : ''}${player.name}`
}

function EventSheet({
  kind,
  players,
  defaultMinute,
  defaultStoppage,
  editing,
  onSubmit,
  onCancel,
}: {
  kind: SheetKind
  players: SheetPlayer[]
  defaultMinute: number | null
  defaultStoppage: number
  editing?: SheetEvent
  onSubmit: (input: Record<string, unknown>, label: string) => Promise<string | null>
  onCancel: () => void
}) {
  const uid = useId()
  const sheet = SHEETS[kind]
  const [type, setType] = useState<EventType>(editing?.type ?? sheet.types[0] ?? 'gol')
  const [team, setTeam] = useState<'club' | 'rival'>(
    editing?.team ?? (sheet.team === 'elegir' ? 'club' : sheet.team),
  )
  const [playerId, setPlayerId] = useState(editing?.playerId ?? '')
  const [relatedPlayerId, setRelatedPlayerId] = useState(editing?.relatedPlayerId ?? '')
  const [name, setName] = useState(editing?.freeTextName ?? '')
  const [minute, setMinute] = useState(String(editing ? (editing.minute ?? '') : (defaultMinute ?? '')))
  const [stoppage, setStoppage] = useState(
    String(editing ? (editing.stoppageMinute ?? '') : defaultStoppage > 0 ? defaultStoppage : ''),
  )
  const [comment, setComment] = useState(editing?.comment ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const isComment = type === 'comentario'
  const pickPlayer = sheet.player && team === 'club'

  async function submit() {
    if (busy) return
    const input = {
      type,
      team: isComment ? 'club' : team,
      playerId: pickPlayer ? playerId : '',
      relatedPlayerId: sheet.related ? relatedPlayerId : '',
      freeTextName: team === 'rival' ? name : '',
      minute: isComment ? '' : minute,
      stoppageMinute: isComment ? '' : stoppage,
      comment: isComment ? comment : '',
    }
    const parsed = matchEventSchema.safeParse(input)
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])),
      )
      return
    }
    setErrors({})
    const who = pickPlayer ? players.find((player) => player.playerId === playerId)?.name : name || null
    const label = [
      matchEventTypeLabels[type],
      who,
      team === 'rival' && !isComment ? '(rival)' : null,
      isComment ? comment : formatMinute(parsed.data.minute, parsed.data.stoppageMinute),
    ]
      .filter(Boolean)
      .join(' · ')
    setBusy(true)
    const error = await onSubmit(input, label)
    setBusy(false)
    if (error) setErrors({ form: error })
  }

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="grid gap-3 rounded-lg border-2 border-ink bg-paper p-3"
    >
      <h2 id={`${uid}-title`} className="text-lg font-bold">
        {editing ? `Editar: ${matchEventTypeLabels[editing.type]}` : sheet.title}
      </h2>
      {errors.form && <Alert variant="danger">{errors.form}</Alert>}
      {sheet.types.length > 1 && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Tipo</legend>
          {sheet.types.map((item) => (
            <Button
              key={item}
              size="lg"
              variant={type === item ? 'dark' : 'outline'}
              aria-pressed={type === item}
              onClick={() => setType(item)}
            >
              {matchEventTypeLabels[item]}
            </Button>
          ))}
        </fieldset>
      )}
      {sheet.team === 'elegir' && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Equipo</legend>
          {(['club', 'rival'] as const).map((item) => (
            <Button
              key={item}
              size="lg"
              variant={team === item ? 'dark' : 'outline'}
              aria-pressed={team === item}
              onClick={() => setTeam(item)}
            >
              {item === 'club' ? 'Del club' : 'Del rival'}
            </Button>
          ))}
        </fieldset>
      )}
      {isComment ? (
        <TextareaField
          id={`${uid}-comment`}
          name="comment"
          label="Comentario"
          help="Hasta 280 caracteres. Se ve en la cronología pública."
          maxLength={280}
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          error={errors.comment}
        />
      ) : (
        <>
          {pickPlayer && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-medium">{sheet.related ? 'Sale' : 'Jugador'}</legend>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {players.map((player) => (
                  <li key={player.playerId}>
                    <Button
                      size="lg"
                      variant={playerId === player.playerId ? 'dark' : 'outline'}
                      aria-pressed={playerId === player.playerId}
                      className="h-auto min-h-12 w-full justify-start py-2 text-left whitespace-normal"
                      onClick={() => setPlayerId(player.playerId)}
                    >
                      {playerLabel(player)}
                    </Button>
                  </li>
                ))}
              </ul>
              {errors.playerId && <p className="text-sm font-medium text-danger">{errors.playerId}</p>}
            </fieldset>
          )}
          {sheet.related && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-medium">Entra</legend>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {players.map((player) => (
                  <li key={player.playerId}>
                    <Button
                      size="lg"
                      variant={relatedPlayerId === player.playerId ? 'dark' : 'outline'}
                      aria-pressed={relatedPlayerId === player.playerId}
                      className="h-auto min-h-12 w-full justify-start py-2 text-left whitespace-normal"
                      onClick={() => setRelatedPlayerId(player.playerId)}
                    >
                      {playerLabel(player)}
                    </Button>
                  </li>
                ))}
              </ul>
              {errors.relatedPlayerId && (
                <p className="text-sm font-medium text-danger">{errors.relatedPlayerId}</p>
              )}
            </fieldset>
          )}
          {team === 'rival' && (
            <Field
              id={`${uid}-name`}
              name="freeTextName"
              label="Nombre del jugador rival"
              required={false}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.freeTextName}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              id={`${uid}-minute`}
              name="minute"
              label="Minuto"
              type="number"
              inputMode="numeric"
              min={1}
              max={150}
              required={false}
              value={minute}
              onChange={(event) => setMinute(event.target.value)}
              error={errors.minute}
            />
            <Field
              id={`${uid}-stoppage`}
              name="stoppageMinute"
              label="Adición"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              required={false}
              value={stoppage}
              onChange={(event) => setStoppage(event.target.value)}
              error={errors.stoppageMinute}
            />
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="lg" variant="primary" loading={busy} onClick={submit}>
          {editing ? 'Guardar' : 'Registrar'}
        </Button>
      </div>
    </section>
  )
}

function ConfirmDialog({
  dialogRef,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  title: string
  children?: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
}) {
  const uid = useId()
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${uid}-title`}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-paper p-5 text-ink shadow-2xl backdrop:bg-ink/60"
    >
      <h2 id={`${uid}-title`} className="text-h3">
        {title}
      </h2>
      <div className="mt-3 grid gap-3">{children}</div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={() => dialogRef.current?.close()}>
          Volver
        </Button>
        <Button
          variant="dark"
          size="lg"
          onClick={() => {
            onConfirm()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}

/**
 * Consola en vivo (especificación 7.3): pensada para el celular en la cancha. Cada toque se guarda primero
 * en el celular y se envía cuando hay señal; el servidor ignora los duplicados (`clientEventId`).
 */
export function LiveConsole({ matchId, snapshot, senders, online: onlineActions }: LiveConsoleProps) {
  const toast = useToast()
  const [data, setData] = useState(snapshot)
  // La nómina (previa) se guarda con su propio formulario, que pide la página de nuevo: llega otra instantánea.
  useEffect(() => setData(snapshot), [snapshot])
  const reload = async () => {
    try {
      const result = await onlineActions.read()
      if (result.ok) setData(result.data)
    } catch {
      // Sin señal: se queda con lo que muestra; la próxima confirmación vuelve a leer.
    }
  }
  const { match, squad, lineup, events } = data
  const queue = useConsoleQueue(matchId, senders, () => void reload())
  const view = optimistic(data, queue.queue)
  const suggested = useSuggestedMinute(match, view.period)
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const [editing, setEditing] = useState<SheetEvent | null>(null)
  const [suspendNotes, setSuspendNotes] = useState('')
  const [penalties, setPenalties] = useState({ home: '', away: '' })
  const finishRef = useRef<HTMLDialogElement>(null)
  const suspendRef = useRef<HTMLDialogElement>(null)
  const undoRef = useRef<HTMLDialogElement>(null)
  const playing = view.status === 'en_vivo'
  useWakeLock(playing)

  const inLineup = new Set(lineup.map((row) => row.playerId))
  const players = lineup.length > 0 ? squad.filter((player) => inLineup.has(player.playerId)) : squad
  const pendingEvents = queue.queue.filter((action) => action.kind === 'event')
  const lastPending = [...queue.queue].reverse().find((action) => action.status === 'pending')
  const statusText = queueStatusText(queue.queue, queue.online)
  const finished = match.status === 'finalizado'
  const clubName = match.clubSide === 'local' ? match.homeName : match.awayName

  function open(kind: SheetKind) {
    setEditing(null)
    setSheet(kind)
    setSheetKey((key) => key + 1)
  }

  function add(kind: QueuedAction['kind'], input: Record<string, unknown>, label: string) {
    const id = newClientId()
    queue.add({ id, kind, input: kind === 'event' ? { ...input, clientEventId: id } : input, label })
    vibrate()
  }

  async function submitEvent(input: Record<string, unknown>, label: string): Promise<string | null> {
    if (editing) {
      const result = await onlineActions.editEvent(editing.id, input)
      if (!result.ok) return result.message
      toast({ message: 'Evento corregido.' })
      await reload()
    } else {
      add('event', input, label)
    }
    setSheet(null)
    setEditing(null)
    return null
  }

  function undo() {
    undoRef.current?.close()
    // Si el último toque aún no salió del celular, deshacerlo es sacarlo de la cola.
    if (lastPending?.kind === 'event') {
      queue.discard(lastPending.id)
      vibrate()
      return
    }
    if (data.lastEventId) add('undo', { lastEventId: data.lastEventId }, 'Deshacer el último evento')
  }

  async function deleteEvent(event: SheetEvent) {
    if (
      !window.confirm(
        `¿Eliminar este evento?\n${matchEventTypeLabels[event.type]} ${formatMinute(event.minute, event.stoppageMinute)}`,
      )
    )
      return
    const result = await onlineActions.deleteEvent(event.id)
    toast(result.ok ? { message: 'Evento eliminado.' } : { variant: 'danger', message: result.message })
    if (result.ok) await reload()
  }

  return (
    <FormBody className="grid max-w-3xl gap-4">
      <div className="sticky top-0 z-10 grid gap-1 rounded-lg bg-ink p-4 text-center text-paper shadow-lg">
        <p className="text-meta">
          {finished
            ? 'Finalizado'
            : view.status === 'suspendido'
              ? 'Suspendido'
              : matchPeriodLabels[view.period]}
          {playing && suggested && ` · ${formatMinute(suggested.minute, suggested.stoppage)}`}
        </p>
        <p
          role="status"
          aria-label="Marcador"
          className="font-display text-3xl font-extrabold [font-stretch:75%]"
        >
          {match.homeName} <span className="tabular-nums">{view.homeScore}</span> –{' '}
          <span className="tabular-nums">{view.awayScore}</span> {match.awayName}
        </p>
        {statusText && (
          <p
            className={cn(
              'mx-auto flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm font-semibold',
              queue.online ? 'bg-accent text-ink' : 'bg-live text-paper',
            )}
          >
            {!queue.online && <CloudOff aria-hidden="true" className="size-4" />}
            {statusText}
          </p>
        )}
      </div>

      {!queue.persisted && (
        <Alert variant="warning" title="Este celular no deja guardar las acciones">
          Si recargas la página sin señal, se pierden las que aún no se enviaron.
        </Alert>
      )}

      {queue.queue.some((action) => action.status === 'failed') && (
        <section aria-label="Acciones que no se pudieron guardar" className="grid gap-2">
          {queue.queue
            .filter((action) => action.status === 'failed')
            .map((action) => (
              <Alert key={action.id} variant="danger" title={`No se guardó: ${action.label}`}>
                <p>{action.error}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="dark" onClick={() => queue.retry(action.id)}>
                    <RotateCcw aria-hidden="true" /> Reintentar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => queue.discard(action.id)}>
                    Descartar
                  </Button>
                </div>
              </Alert>
            ))}
        </section>
      )}

      {match.status === 'cancelado' || match.status === 'postergado' ? (
        <Alert title="Este partido no se está jugando">
          Para usar la consola, primero vuelve a programarlo desde los datos del partido.
        </Alert>
      ) : (
        <>
          {finished && queue.queue.length === 0 && (
            <Alert variant="success" title="Partido finalizado">
              <p>Las tarjetas para redes ya tienen el resultado final.</p>
              <Link
                href={`/admin/partidos/${matchId}#tarjetas`}
                className={buttonVariants({ variant: 'dark', size: 'lg', className: 'mt-2' })}
              >
                Descargar y compartir tarjetas
              </Link>
            </Alert>
          )}
          {!finished && (
            <section aria-label="Momento del partido" className="grid gap-2 sm:grid-cols-2">
              {availableTransitions(view.period).map((transition) => (
                <Button
                  key={transition}
                  size="lg"
                  variant="dark"
                  className="min-h-14 text-lg"
                  onClick={() => add('period', { transition }, TRANSITION_LABELS[transition])}
                >
                  {TRANSITION_LABELS[transition]}
                </Button>
              ))}
              {playing &&
                (view.period === 'segundo_tiempo' ||
                  view.period === 'alargue' ||
                  view.period === 'penales') && (
                  <Button
                    size="lg"
                    variant="primary"
                    className="min-h-14 text-lg"
                    onClick={() => finishRef.current?.showModal()}
                  >
                    Finalizar partido
                  </Button>
                )}
            </section>
          )}

          {view.period === 'previa' && !finished && (
            <details className="rounded-lg border border-neutral-200 bg-paper p-3" open={lineup.length === 0}>
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold">
                Nómina del partido ({lineup.length})
              </summary>
              <div className="pt-3">
                <LineupSection
                  squad={squad}
                  lineup={lineup}
                  hasPreviousLineup={data.hasPreviousLineup}
                  actions={{ saveLineup: onlineActions.saveLineup, copyLineup: onlineActions.copyLineup }}
                />
              </div>
            </details>
          )}

          {(playing || finished || view.status === 'suspendido') && (
            <section aria-label="Registrar" className="grid gap-2">
              <Button
                size="lg"
                variant="primary"
                className="min-h-16 text-xl"
                onClick={() => open('gol_club')}
              >
                Gol de {clubName}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" variant="outline" className="min-h-14" onClick={() => open('gol_rival')}>
                  Gol rival
                </Button>
                <Button size="lg" variant="outline" className="min-h-14" onClick={() => open('tarjeta')}>
                  Tarjeta
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-14"
                  onClick={() => open('autogol_rival')}
                >
                  Autogol del rival
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-14"
                  onClick={() => undoRef.current?.showModal()}
                  disabled={!lastPending && !data.lastEventId}
                >
                  <Undo2 aria-hidden="true" /> Deshacer último
                </Button>
              </div>
              <details className="rounded-lg border border-neutral-200 bg-paper p-3">
                <summary className="flex min-h-12 cursor-pointer items-center font-semibold">
                  Cambios, comentarios y más
                </summary>
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <Button size="lg" variant="outline" onClick={() => open('cambio')}>
                    Cambio
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => open('comentario')}>
                    Comentario
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => open('penal_errado')}>
                    Penal errado
                  </Button>
                  {playing && (
                    <Button size="lg" variant="danger" onClick={() => suspendRef.current?.showModal()}>
                      Suspender
                    </Button>
                  )}
                </div>
              </details>
            </section>
          )}

          {sheet && (
            <EventSheet
              key={sheetKey}
              kind={sheet}
              players={players}
              defaultMinute={suggested?.minute ?? null}
              defaultStoppage={suggested?.stoppage ?? 0}
              editing={editing ?? undefined}
              onSubmit={submitEvent}
              onCancel={() => {
                setSheet(null)
                setEditing(null)
              }}
            />
          )}

          <section aria-labelledby="consola-eventos" className="grid gap-2">
            <h2 id="consola-eventos" className="text-lg font-bold">
              Cronología
            </h2>
            {events.length === 0 && pendingEvents.length === 0 ? (
              <p className="text-neutral-600">Todavía no hay eventos.</p>
            ) : (
              <ol aria-label="Eventos del partido" className="grid gap-1">
                {events.map((event) => {
                  const text = `${formatMinute(event.minute, event.stoppageMinute)} ${matchEventTypeLabels[event.type]}${event.playerName ? ` · ${event.playerName}` : ''}${event.team === 'rival' ? ' (rival)' : ''}${event.comment ? ` · ${event.comment}` : ''}`
                  return (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-2 border-b border-neutral-200 py-1"
                    >
                      <span className="min-w-0 break-words">{text}</span>
                      <span className="flex shrink-0 gap-1">
                        {event.type !== 'comentario' && event.team !== null && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!queue.online}
                            onClick={() => {
                              const kind: SheetKind =
                                event.type === 'cambio'
                                  ? 'cambio'
                                  : event.type.startsWith('tarjeta') || event.type === 'segunda_amarilla'
                                    ? 'tarjeta'
                                    : event.type === 'penal_errado'
                                      ? 'penal_errado'
                                      : event.type === 'autogol'
                                        ? 'autogol_rival'
                                        : event.team === 'club'
                                          ? 'gol_club'
                                          : 'gol_rival'
                              setEditing(event)
                              setSheet(kind)
                              setSheetKey((key) => key + 1)
                            }}
                          >
                            Editar<span className="sr-only">: {text}</span>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Eliminar: ${text}`}
                          disabled={!queue.online}
                          onClick={() => deleteEvent(event)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </span>
                    </li>
                  )
                })}
                {pendingEvents.map((action) => (
                  <li
                    key={action.id}
                    className="flex items-center justify-between gap-2 border-b border-neutral-200 py-1 text-neutral-600"
                  >
                    <span className="min-w-0 break-words">{action.label}</span>
                    <span className="shrink-0 text-sm font-semibold">
                      {action.status === 'failed' ? 'No se guardó' : 'Pendiente de enviar'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        dialogRef={undoRef}
        title="¿Deshacer el último evento?"
        confirmLabel="Sí, deshacer"
        onConfirm={undo}
      >
        <p>Se borra el último que se registró y el marcador se recalcula.</p>
      </ConfirmDialog>

      <ConfirmDialog
        dialogRef={finishRef}
        title="¿Finalizar el partido?"
        confirmLabel="Sí, finalizar"
        onConfirm={() => {
          finishRef.current?.close()
          const shootout = view.period === 'penales'
          add(
            'finish',
            {
              resolution: shootout ? 'penales' : 'normal',
              homeScore: '',
              awayScore: '',
              homePenalties: shootout ? penalties.home : '',
              awayPenalties: shootout ? penalties.away : '',
            },
            'Finalizar el partido',
          )
        }}
      >
        <p className="text-center font-display text-2xl font-extrabold [font-stretch:75%]">
          {match.homeName} {view.homeScore} – {view.awayScore} {match.awayName}
        </p>
        {view.period === 'penales' && (
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="penales-local"
              label={`Penales de ${match.homeName}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={penalties.home}
              onChange={(event) => setPenalties((value) => ({ ...value, home: event.target.value }))}
            />
            <Field
              name="penales-visita"
              label={`Penales de ${match.awayName}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={penalties.away}
              onChange={(event) => setPenalties((value) => ({ ...value, away: event.target.value }))}
            />
          </div>
        )}
        <p className="text-neutral-600">Queda como finalizado y se publica en el sitio.</p>
      </ConfirmDialog>

      <ConfirmDialog
        dialogRef={suspendRef}
        title="¿Suspender el partido?"
        confirmLabel="Sí, suspender"
        onConfirm={() => {
          if (!suspendNotes.trim()) return
          suspendRef.current?.close()
          add('suspend', { notes: suspendNotes.trim() }, 'Suspender el partido')
        }}
      >
        <TextareaField
          name="motivo"
          label="Motivo"
          help="Se muestra en el sitio. Por ejemplo: «Lluvia intensa»."
          maxLength={280}
          rows={2}
          value={suspendNotes}
          onChange={(event) => setSuspendNotes(event.target.value)}
        />
      </ConfirmDialog>
    </FormBody>
  )
}
