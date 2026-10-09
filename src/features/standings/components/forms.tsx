'use client' // Cliente: grilla editable de la tabla de posiciones (PJ, DIF y PTS se calculan al escribir).

import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { type Resolver, useFieldArray, useForm } from 'react-hook-form'
import { EntityForm } from '@/components/admin/entity-form'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field, SelectField } from '@/components/ui/field'
import type { ActionResult } from '@/lib/action-result'
import {
  type NewStandingsFormValues,
  newStandingsSchema,
  type StandingsFormValues,
  standingsSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

const MODE_OPTIONS = [
  { value: 'manual', label: 'Manual: copio la tabla que publica la asociación' },
  { value: 'calculada', label: 'Calculada: sale sola de los resultados cargados' },
]

export function NewStandingsForm({
  action,
  defaults,
  competitions,
  series,
}: {
  action: Action
  defaults: NewStandingsFormValues
  competitions: Option[]
  series: Option[]
}) {
  return (
    <EntityForm
      schema={newStandingsSchema}
      action={action}
      defaultValues={defaults}
      submitLabel="Crear tabla"
      successMessage="Tabla creada. Ahora agrega los equipos."
      redirectTo={(id) => `/admin/posiciones/${id}`}
      cancelHref="/admin/posiciones"
      fields={[
        { name: 'seriesId', label: 'Serie', type: 'select', options: series },
        { name: 'competitionId', label: 'Competencia', type: 'select', options: competitions },
        {
          name: 'groupLabel',
          label: 'Grupo',
          type: 'text',
          required: false,
          help: 'Solo si la competencia tiene grupos: «Grupo A».',
        },
        { name: 'mode', label: 'Cómo se arma', type: 'select', options: MODE_OPTIONS },
        { name: 'asOf', label: 'Actualizada al', type: 'date', required: false },
        {
          name: 'sourceNote',
          label: 'Fuente',
          type: 'text',
          required: false,
          help: 'De dónde salen los datos: «Asociación de fútbol, boletín 12».',
        },
      ]}
    />
  )
}

const EMPTY_ROW = {
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  pointsAdjustment: 0,
  position: '',
  note: '',
}

const number = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type EditorProps = {
  action: Action
  defaults: StandingsFormValues
  teams: Option[]
  pointsWin: number
  pointsDraw: number
}

export function StandingsEditor({ action, defaults, teams, pointsWin, pointsDraw }: EditorProps) {
  const uid = useId()
  const router = useRouter()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [teamToAdd, setTeamToAdd] = useState('')
  const form = useForm<StandingsFormValues>({
    resolver: zodResolver(standingsSchema as never) as unknown as Resolver<StandingsFormValues>,
    defaultValues: defaults,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' })
  const { errors, isSubmitting } = form.formState
  const rows = form.watch('rows')
  const manual = form.watch('mode') === 'manual'
  const nameOf = new Map(teams.map((team) => [team.value, team.label]))
  const used = new Set(rows.map((row) => row.teamId))
  const available = teams.filter((team) => !used.has(team.value))

  const onSubmit = form.handleSubmit(async () => {
    setFormError(null)
    const result = await action(form.getValues())
    if (!result.ok) {
      setFormError(result.fieldErrors?.rows?.[0] ?? result.message)
      return
    }
    toast({ message: 'Tabla guardada.' })
    router.refresh()
  })

  const cell = (index: number, name: keyof typeof EMPTY_ROW, label: string, team: string, min = 0) => (
    <Field
      id={`${uid}-${index}-${name}`}
      label={label}
      aria-label={`${label} de ${team}`}
      type="number"
      inputMode="numeric"
      min={min}
      required={name === 'position' ? false : undefined}
      error={errors.rows?.[index]?.[name]?.message}
      {...form.register(`rows.${index}.${name}`)}
    />
  )

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl">
      <FormBody className="grid gap-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <SelectField id={`${uid}-mode`} label="Cómo se arma" {...form.register('mode')}>
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${uid}-asOf`}
            label="Actualizada al"
            type="date"
            required={false}
            error={errors.asOf?.message}
            {...form.register('asOf')}
          />
          <Field
            id={`${uid}-source`}
            label="Fuente"
            required={false}
            error={errors.sourceNote?.message}
            {...form.register('sourceNote')}
          />
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-1 font-medium">Equipos</legend>
          {!manual && (
            <Alert title="Tabla calculada">
              Los partidos, goles y puntos salen de los resultados cargados (incluidos los partidos entre
              rivales). Aquí solo se agregan los equipos y, si hace falta, un ajuste de puntos o de posición.
            </Alert>
          )}
          {fields.length === 0 && <p className="text-neutral-600">Agrega los equipos de la tabla.</p>}
          {fields.map((field, index) => {
            const row = rows[index]
            const team = nameOf.get(field.teamId) ?? 'Equipo'
            const played = number(row?.won) + number(row?.drawn) + number(row?.lost)
            const diff = number(row?.goalsFor) - number(row?.goalsAgainst)
            const points =
              number(row?.won) * pointsWin + number(row?.drawn) * pointsDraw + number(row?.pointsAdjustment)
            return (
              <div key={field.id} className="grid gap-2 rounded-lg border border-neutral-300 bg-paper p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{team}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar a ${team}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <input type="hidden" {...form.register(`rows.${index}.teamId`)} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                  {manual && (
                    <>
                      {cell(index, 'won', 'PG', team)}
                      {cell(index, 'drawn', 'PE', team)}
                      {cell(index, 'lost', 'PP', team)}
                      {cell(index, 'goalsFor', 'GF', team)}
                      {cell(index, 'goalsAgainst', 'GC', team)}
                    </>
                  )}
                  {cell(index, 'pointsAdjustment', 'Ajuste', team, -99)}
                  {cell(index, 'position', 'Pos. manual', team, 1)}
                </div>
                {manual && (
                  <p className="text-sm text-neutral-600" role="status">
                    PJ {played} · DIF {diff > 0 ? `+${diff}` : diff} ·{' '}
                    <span className="font-bold text-ink">PTS {points}</span>
                  </p>
                )}
              </div>
            )
          })}
          {available.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-0 flex-1 basis-56 gap-1 font-medium">
                Agregar equipo
                <select
                  value={teamToAdd}
                  onChange={(event) => setTeamToAdd(event.target.value)}
                  className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base font-normal"
                >
                  <option value="">Elige un equipo</option>
                  {available.map((team) => (
                    <option key={team.value} value={team.value}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                size="lg"
                disabled={!teamToAdd}
                onClick={() => {
                  append({ teamId: teamToAdd, ...EMPTY_ROW })
                  setTeamToAdd('')
                }}
              >
                Agregar
              </Button>
            </div>
          )}
          <p className="text-sm text-neutral-600">
            «Ajuste» suma o resta puntos (por ejemplo, −3 por una sanción). «Pos. manual» solo decide cuando
            dos equipos quedan iguales en puntos, diferencia y goles a favor.
          </p>
        </fieldset>

        <div>
          <Button type="submit" variant="dark" size="lg" loading={isSubmitting}>
            Guardar tabla
          </Button>
        </div>
      </FormBody>
    </form>
  )
}
