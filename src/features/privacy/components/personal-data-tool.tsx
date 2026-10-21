'use client' // Cliente: busca por Server Action para que el dato de la persona no quede en la URL.

import { Download, Search } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ActionButton } from '@/components/admin/action-button'
import { FormBody } from '@/components/admin/form-body'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { buscarDatosPersonales, eliminarDatosPersonales } from '../actions'
import { identifierKindLabels } from '../lib/identifier'
import type { PersonalDataSummary } from '../queries'

export function PersonalDataTool() {
  const [query, setQuery] = useState('')
  const [summary, setSummary] = useState<PersonalDataSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  async function search(q: string) {
    setSearching(true)
    try {
      const result = await buscarDatosPersonales({ q })
      if (result.ok) {
        setSummary(result.data)
        setError(null)
      } else {
        setSummary(null)
        setError(result.fieldErrors?.q?.[0] ?? result.message)
      }
    } finally {
      setSearching(false)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '')
    setQuery(q)
    await search(q)
  }

  return (
    <FormBody className="grid max-w-2xl gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <Field
            name="q"
            label="Correo, RUT o celular"
            help="El RUT con guion: 12.345.678-5. El celular con o sin +56."
            autoComplete="off"
            error={error ?? undefined}
          />
        </div>
        <Button type="submit" size="lg" variant="outline" loading={searching}>
          <Search aria-hidden="true" /> Buscar
        </Button>
      </form>

      {summary && (
        <section aria-labelledby="resultado" className="grid gap-4">
          <h2 id="resultado" className="text-lg font-bold">
            {summary.total === 0
              ? `No hay datos con ese ${identifierKindLabels[summary.kind]}`
              : `${summary.total} ${summary.total === 1 ? 'registro' : 'registros'} con ese ${identifierKindLabels[summary.kind]}`}
          </h2>
          <ul className="grid gap-1">
            {summary.sources.map((entry) => (
              <li key={entry.source}>
                {entry.label}: <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>
          {summary.total > 0 && (
            <div className="flex flex-wrap gap-2">
              {/* Formulario nativo: el navegador descarga el archivo. El dato va en el cuerpo, no en la URL. */}
              <form method="post" action="/api/admin/datos-personales/exportar">
                <input type="hidden" name="q" value={query} />
                <Button type="submit" size="lg" variant="outline">
                  <Download aria-hidden="true" /> Exportar en JSON
                </Button>
              </form>
              <ActionButton
                action={async () => {
                  const result = await eliminarDatosPersonales({ q: query })
                  if (result.ok) await search(query)
                  return result
                }}
                variant="danger"
                confirm={{
                  title: '¿Eliminar los datos de esta persona?',
                  description:
                    'Se borran sus solicitudes y mensajes. En el padrón queda como «baja», sin nombre ni contacto. No se puede deshacer.',
                  confirmLabel: 'Eliminar sus datos',
                }}
                successMessage="Datos eliminados."
              >
                Eliminar sus datos
              </ActionButton>
            </div>
          )}
          <Alert variant="info">
            <p>
              Antes de eliminar, exporta los datos si la persona pidió una copia. El procedimiento está en
              docs/seguridad-privacidad.md.
            </p>
          </Alert>
        </section>
      )}
    </FormBody>
  )
}
