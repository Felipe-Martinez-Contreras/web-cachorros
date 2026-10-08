'use client' // Cliente: Next exige que los límites de error lo sean.

export default function PanelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-neutral-200 bg-paper p-4">
      <h1 className="text-xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-neutral-600">
        No pudimos cargar esta parte del panel. Inténtalo de nuevo; si sigue fallando, avisa a soporte.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 min-h-12 rounded-md bg-ink px-5 font-semibold text-paper"
      >
        Reintentar
      </button>
    </div>
  )
}
