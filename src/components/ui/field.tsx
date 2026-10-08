import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const controlClass =
  // El borde usa neutral-500: neutral-400 no alcanza 3:1 sobre blanco (WCAG 1.4.11).
  'block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base text-ink ' +
  'placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-600 ' +
  'aria-invalid:border-danger aria-invalid:border-2'

type Shared = {
  /** También se usa como `id`: debe ser único en la página. */
  name: string
  label: string
  help?: string
  error?: string
  className?: string
}

function describedBy(name: string, help?: string, error?: string): string | undefined {
  return [error ? `${name}-error` : null, help ? `${name}-help` : null].filter(Boolean).join(' ') || undefined
}

/** Etiqueta visible, ayuda y error asociados al control (especificación 4.9). */
function FieldShell({
  name,
  label,
  help,
  error,
  required,
  className,
  children,
}: Shared & { required?: boolean; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1', className)}>
      <label htmlFor={name} className="font-medium">
        {label}
        {required === false && <span className="font-normal text-neutral-600"> (opcional)</span>}
      </label>
      {children}
      {help && (
        <p id={`${name}-help`} className="text-sm text-neutral-600">
          {help}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'className'> & Shared

export function Field({ name, label, help, error, className, ...input }: FieldProps) {
  return (
    <FieldShell
      name={name}
      label={label}
      help={help}
      error={error}
      required={input.required}
      className={className}
    >
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, help, error)}
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
  label,
  help,
  error,
  className,
  rows = 4,
  ...textarea
}: TextareaFieldProps) {
  return (
    <FieldShell
      name={name}
      label={label}
      help={help}
      error={error}
      required={textarea.required}
      className={className}
    >
      <textarea
        id={name}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, help, error)}
        className={cn(controlClass, 'py-3')}
        {...textarea}
      />
    </FieldShell>
  )
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name' | 'className'> & Shared

export function SelectField({ name, label, help, error, className, children, ...select }: SelectFieldProps) {
  return (
    <FieldShell
      name={name}
      label={label}
      help={help}
      error={error}
      required={select.required}
      className={className}
    >
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, help, error)}
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
export function CheckboxField({ name, label, help, error, className, ...input }: CheckboxFieldProps) {
  return (
    <div className={cn('grid gap-1', className)}>
      <label htmlFor={name} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          id={name}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, help, error)}
          className="mt-0.5 size-5 shrink-0 accent-ink"
          {...input}
        />
        <span>{label}</span>
      </label>
      {help && (
        <p id={`${name}-help`} className="text-sm text-neutral-600">
          {help}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
