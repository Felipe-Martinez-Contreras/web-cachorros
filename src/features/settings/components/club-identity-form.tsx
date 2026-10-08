'use client' // Cliente: muestra el resultado de la acción y el estado de envío con useActionState.

import { useActionState } from 'react'
import { actualizarIdentidadClubForm } from '../actions'
import type { ClubIdentityDTO } from '../dto'

const inputClass =
  'block min-h-12 w-full rounded-md border border-neutral-300 bg-paper px-3 text-base text-ink aria-invalid:border-danger'

export function ClubIdentityForm({ initial }: { initial: ClubIdentityDTO }) {
  const [state, formAction, pending] = useActionState(actualizarIdentidadClubForm, null)
  const current = state?.ok ? state.data : initial
  const errors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1">
        <label htmlFor="clubName" className="font-medium">
          Nombre del club
        </label>
        <input
          id="clubName"
          name="clubName"
          required
          defaultValue={current.clubName}
          aria-invalid={errors?.clubName ? true : undefined}
          aria-describedby={errors?.clubName ? 'clubName-error' : undefined}
          className={inputClass}
        />
        {errors?.clubName && (
          <p id="clubName-error" className="text-sm text-danger">
            {errors.clubName[0]}
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="shortName" className="font-medium">
          Nombre corto
        </label>
        <input
          id="shortName"
          name="shortName"
          required
          defaultValue={current.shortName}
          aria-invalid={errors?.shortName ? true : undefined}
          aria-describedby={errors?.shortName ? 'shortName-error' : 'shortName-help'}
          className={inputClass}
        />
        <p id="shortName-help" className="text-sm text-neutral-600">
          Se usa donde hay poco espacio, por ejemplo en el celular.
        </p>
        {errors?.shortName && (
          <p id="shortName-error" className="text-sm text-danger">
            {errors.shortName[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-ink px-5 font-semibold text-paper disabled:opacity-60 sm:justify-self-start"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>

      <p role="status" className={state?.ok ? 'text-success' : 'text-danger'}>
        {state ? (state.ok ? 'Guardado.' : state.message) : ''}
      </p>
    </form>
  )
}
