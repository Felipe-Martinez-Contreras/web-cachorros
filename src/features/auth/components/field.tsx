import type { InputHTMLAttributes } from 'react'

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  name: string
  label: string
  help?: string
  error?: string
}

/** Campo con etiqueta visible, ayuda y error asociados (especificación 4.9). */
export function Field({ name, label, help, error, ...input }: FieldProps) {
  const describedBy = [error ? `${name}-error` : null, help ? `${name}-help` : null].filter(Boolean).join(' ')
  return (
    <div className="grid gap-1">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="block min-h-12 w-full rounded-md border border-neutral-400 bg-paper px-3 text-base text-ink aria-invalid:border-danger"
        {...input}
      />
      {help && (
        <p id={`${name}-help`} className="text-sm text-neutral-600">
          {help}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export const primaryButtonClass =
  'min-h-12 w-full rounded-md bg-ink px-5 font-semibold text-paper disabled:opacity-60'
