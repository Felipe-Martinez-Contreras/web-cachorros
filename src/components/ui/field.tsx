import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const controlClass =
  // El borde usa neutral-500: neutral-400 no alcanza 3:1 sobre blanco (WCAG 1.4.11).
  'block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base text-ink ' +
  'placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-600 ' +
  'aria-invalid:border-danger aria-invalid:border-2'

type Shared = {
  name: string
  /** Por defecto es `name`. Hay que darlo cuando la página tiene varios formularios con el mismo campo. */
  id?: string
  label: string
  help?: string
  error?: string
  className?: string
}

function describedBy(id: string, help?: string, error?: string): string | undefined {
  return [error ? `${id}-error` : null, help ? `${id}-help` : null].filter(Boolean).join(' ') || undefined
}

/** Etiqueta visible, ayuda y error asociados al control (especificación 4.9). */
function FieldShell({
  id,
  label,
  help,
  error,
  required,
  className,
  children,
}: Omit<Shared, 'name' | 'id'> & { id: string; required?: boolean; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1', className)}>
      <label htmlFor={id} className="font-medium">
        {label}
        {required === false && <span className="font-normal text-neutral-600"> (opcional)</span>}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-sm text-neutral-600">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'className'> & Shared

export function Field({ name, id = name, label, help, error, className, ...input }: FieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      error={error}
      required={input.required}
      className={className}
    >
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={controlClass}
        {...input}
      />
    </FieldShell>
  )
}

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name' | 'className'> &
  Shared

export function TextareaField({
  name,
  id = name,
  label,
  help,
  error,
  className,
  rows = 4,
  ...textarea
}: TextareaFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      error={error}
      required={textarea.required}
      className={className}
    >
      <textarea
        id={id}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={cn(controlClass, 'py-3')}
        {...textarea}
      />
    </FieldShell>
  )
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name' | 'className'> & Shared

export function SelectField({
  name,
  id = name,
  label,
  help,
  error,
  className,
  children,
  ...select
}: SelectFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      error={error}
      required={select.required}
      className={className}
    >
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={controlClass}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  )
}

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'type' | 'className'> &
  Omit<Shared, 'label'> & { label: ReactNode }

/** Casilla con toda la fila como área táctil. */
export function CheckboxField({
  name,
  id = name,
  label,
  help,
  error,
  className,
  ...input
}: CheckboxFieldProps) {
  return (
    <div className={cn('grid gap-1', className)}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          id={id}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, help, error)}
          className="mt-0.5 size-5 shrink-0 accent-ink"
          {...input}
        />
        <span>{label}</span>
      </label>
      {help && (
        <p id={`${id}-help`} className="text-sm text-neutral-600">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
