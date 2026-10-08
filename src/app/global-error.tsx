'use client' // Cliente: Next exige que el límite de error global lo sea.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-CL">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1>Algo salió mal</h1>
        <p>Tuvimos un problema al cargar la página. Inténtalo de nuevo en unos segundos.</p>
        <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: '0 1.25rem' }}>
          Reintentar
        </button>
      </body>
    </html>
  )
}
