import type { ActionResult } from '@/lib/action-result'
import { ActionButton } from './action-button'

type DeleteSectionProps = {
  /** «la serie Honor»: se usa en la pregunta de confirmación. */
  what: string
  /** Cuándo se puede eliminar y qué hacer si no. */
  description: string
  action: () => Promise<ActionResult<unknown>>
  redirectTo: string
  buttonLabel: string
  successMessage: string
}

/** Zona de eliminación al pie de una pantalla de edición: siempre con confirmación (especificación 7.1). */
export function DeleteSection({
  what,
  description,
  action,
  redirectTo,
  buttonLabel,
  successMessage,
}: DeleteSectionProps) {
  return (
    <section
      aria-labelledby="eliminar-titulo"
      className="mt-10 grid max-w-2xl gap-2 border-t border-neutral-200 pt-6"
    >
      <h2 id="eliminar-titulo" className="text-lg font-bold">
        Eliminar
      </h2>
      <p className="text-neutral-600">{description}</p>
      <div>
        <ActionButton
          action={action}
          variant="danger"
          redirectTo={redirectTo}
          successMessage={successMessage}
          confirm={{
            title: `¿Eliminar ${what}?`,
            description: 'No se puede deshacer.',
            confirmLabel: 'Sí, eliminar',
          }}
        >
          {buttonLabel}
        </ActionButton>
      </div>
    </section>
  )
}
