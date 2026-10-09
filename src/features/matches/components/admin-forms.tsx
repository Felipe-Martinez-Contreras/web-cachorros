'use client' // Cliente: formularios de programación de partidos (react-hook-form + Zod).

import { zodResolver } from '@hookform/resolvers/zod'
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
  type MatchdayFormValues,
  type MatchFormValues,
  type MatchStatusFormValues,
  matchdaySchema,
  matchSchema,
  matchStatusSchema,
} from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>
type Option = { value: string; label: string }

export function MatchForm({
  action,
  defaults,
  options,
  isNew = false,
}: {
  action: Action
  defaults: MatchFormValues
  options: { competitions: Option[]; series: Option[]; teams: Option[]; venues: Option[] }
  isNew?: boolean
}) {
  return (
    <EntityForm
      schema={matchSchema}
      action={action}
      defaultValues={defaults}
      submitLabel={isNew ? 'Programar partido' : 'Guardar'}
      successMessage={isNew ? 'Partido programado.' : 'Guardado.'}
      redirectTo={isNew ? '/admin/partidos' : undefined}
      cancelHref={isNew ? '/admin/partidos' : undefined}
      fields={[
        { name: 'seriesId', label: 'Serie', type: 'select', options: options.series },
        { name: 'competitionId', label: 'Competencia', type: 'select', options: options.competitions },
        { name: 'homeTeamId', label: 'Local', type: 'select', options: options.teams },
        { name: 'awayTeamId', label: 'Visita', type: 'select', options: options.teams },
        { name: 'date', label: 'Día', type: 'date' },
        { name: 'time', label: 'Hora', type: 'time', help: 'Hora de Chile continental.' },
        {
          name: 'venueId',
          label: 'Cancha',
          type: 'select',
          required: false,
          emptyLabel: 'Por definir',
          options: options.venues,
        },
        {
          name: 'roundNumber',
          label: 'Número de fecha',
          type: 'number',
          required: false,
          min: 1,
          max: 60,
          inputMode: 'numeric',
        },
        {
          name: 'roundLabel',
          label: 'Rótulo de la fecha',
          type: 'text',
          required: false,
          help: 'Solo si no es una fecha numerada: «Semifinal», «Final». Si lo dejas vacío se muestra «Fecha N».',
        },
        {
          name: 'notes',
          label: 'Nota visible',
          type: 'textarea',
          required: false,
          maxLength: 300,
          help: 'Se muestra en el detalle del partido.',
        },
      ]}
    />
  )
}

export function MatchStatusForm({ action, defaults }: { action: Action; defaults: MatchStatusFormValues }) {
  return (
    <EntityForm
      schema={matchStatusSchema}
      action={action}
      defaultValues={defaults}
      submitLabel="Cambiar estado"
      successMessage="Estado del partido actualizado."
      fields={[
        {
          name: 'status',
          label: 'Nuevo estado',
          type: 'select',
          options: [
            { value: 'postergado', label: 'Postergado (se jugará otro día)' },
            { value: 'suspendido', label: 'Suspendido' },
            { value: 'cancelado', label: 'Cancelado (no se juega)' },
            { value: 'programado', label: 'Programado (nueva fecha confirmada)' },
          ],
        },
        { name: 'date', label: 'Nuevo día', type: 'date', required: false },
        { name: 'time', label: 'Nueva hora', type: 'time', required: false },
        {
          name: 'notes',
          label: 'Motivo',
          type: 'textarea',
          required: false,
          maxLength: 300,
          help: 'Se muestra en el sitio: «Postergado por lluvia».',
        },
      ]}
    />
  )
}

type MatchdayProps = {
  action: Action
  defaults: MatchdayFormValues
  seriesNames: Record<string, string>
  options: { competitions: Option[]; rivals: Option[]; venues: Option[] }
}

/** «Programar jornada» (7.4): un rival, un día y una fila por serie con su hora y número de fecha. */
export function MatchdayForm({ action, defaults, seriesNames, options }: MatchdayProps) {
  const uid = useId()
  const router = useRouter()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<MatchdayFormValues>({
    resolver: zodResolver(matchdaySchema as never) as unknown as Resolver<MatchdayFormValues>,
    defaultValues: defaults,
  })
  const { fields } = useFieldArray({ control: form.control, name: 'rows' })
  const { errors, isSubmitting } = form.formState
  const rows = form.watch('rows')
  const included = rows.filter((row) => row.include).length

  const onSubmit = form.handleSubmit(async () => {
    setFormError(null)
    const result = await action(form.getValues())
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof MatchdayFormValues, { type: 'server', message: messages[0] })
      }
      setFormError(result.message)
      return
    }
    toast({ message: included === 1 ? 'Se programó 1 partido.' : `Se programaron ${included} partidos.` })
    router.push('/admin/partidos')
    router.refresh()
  })

  const rowsError = errors.rows?.message ?? errors.rows?.root?.message

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FormBody className="grid gap-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Field
          id={`${uid}-date`}
          label="Día"
          type="date"
          error={errors.date?.message}
          {...form.register('date')}
        />
        <SelectField
          id={`${uid}-rival`}
          label="Rival"
          error={errors.rivalId?.message}
          {...form.register('rivalId')}
        >
          {options.rivals.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${uid}-condition`}
          label="El club juega de"
          error={errors.condition?.message}
          {...form.register('condition')}
        >
          <option value="local">Local</option>
          <option value="visita">Visita</option>
        </SelectField>
        <SelectField
          id={`${uid}-venue`}
          label="Cancha"
          required={false}
          error={errors.venueId?.message}
          {...form.register('venueId')}
        >
          <option value="">Por definir</option>
          {options.venues.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${uid}-competition`}
          label="Competencia"
          error={errors.competitionId?.message}
          {...form.register('competitionId')}
        >
          {options.competitions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <fieldset className="grid gap-2">
          <legend className="mb-1 font-medium">Series que juegan ese día</legend>
          {typeof rowsError === 'string' && (
            <p role="alert" className="text-sm font-medium text-danger">
              {rowsError}
            </p>
          )}
          {fields.map((field, index) => {
            const name = seriesNames[field.seriesId] ?? 'Serie'
            const on = rows[index]?.include === true
            return (
              <div key={field.id} className="rounded-lg border border-neutral-300 bg-paper p-3">
                <label className="flex min-h-12 cursor-pointer items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="size-5 accent-ink"
                    {...form.register(`rows.${index}.include`)}
                  />
                  {name}
                </label>
                {on && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Field
                      id={`${uid}-time-${index}`}
                      label={`Hora de ${name}`}
                      type="time"
                      error={errors.rows?.[index]?.time?.message}
                      {...form.register(`rows.${index}.time`)}
                    />
                    <Field
                      id={`${uid}-round-${index}`}
                      label={`Fecha n.º de ${name}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={60}
                      required={false}
                      error={errors.rows?.[index]?.roundNumber?.message}
                      {...form.register(`rows.${index}.roundNumber`)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </fieldset>

        <div>
          <Button type="submit" variant="dark" size="lg" loading={isSubmitting}>
            {included === 1 ? 'Programar 1 partido' : `Programar ${included} partidos`}
          </Button>
        </div>
      </FormBody>
    </form>
  )
}
