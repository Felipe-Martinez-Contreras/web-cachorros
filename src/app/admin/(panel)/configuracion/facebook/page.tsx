import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader, ResourceList } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { guardarFacebook, probarConexionFacebook } from '@/features/social-publishing/actions'
import { facebookPanelState } from '@/features/social-publishing/admin-queries'
import { FacebookSettingsForm } from '@/features/social-publishing/components/forms'
import { PublicationRow } from '@/features/social-publishing/components/publication-row'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Facebook' }

export default async function FacebookSettingsPage() {
  await requirePanelUser('settings:write')
  const state = await facebookPanelState()
  const { settings } = state

  return (
    <>
      <PageHeader
        title="Facebook"
        description="Publica solas en la página del club la programación del fin de semana y, si quieres, los resultados."
        back={{ href: '/admin/configuracion', label: 'Configuración' }}
      />
      <div className="grid gap-8">
        {!state.configured ? (
          <Alert variant="warning" title="La página todavía no está conectada">
            {state.blockedReason} Mientras tanto puedes dejar lista la configuración.
          </Alert>
        ) : state.blockedReason && settings.enabled ? (
          <Alert variant="warning" title="Por ahora no se publica nada">
            {state.blockedReason}
          </Alert>
        ) : null}
        {state.nonProductionAllowed && (
          <Alert variant="warning" title="Sitio de pruebas con publicación permitida">
            Este no es el sitio de producción, pero FACEBOOK_ALLOW_NON_PRODUCTION está activo: lo que se
            publique aparecerá en la página de Facebook conectada.
          </Alert>
        )}

        <FacebookSettingsForm
          action={guardarFacebook}
          defaults={{
            enabled: settings.enabled,
            weekday: String(settings.weekday),
            time: settings.time,
            publishResults: settings.publishResults,
            photo1: settings.photos?.[0] ?? '',
            photo2: settings.photos?.[1] ?? '',
            photo3: settings.photos?.[2] ?? '',
          }}
        />

        <section aria-labelledby="conexion" className="grid max-w-2xl gap-3">
          <h2 id="conexion" className="text-lg font-bold">
            Conexión
          </h2>
          <p className="text-neutral-600">
            Consulta la página con el token cargado en el servidor. No publica nada.
          </p>
          <div>
            <ActionButton
              action={probarConexionFacebook}
              successMessage="La conexión con la página de Facebook funciona."
              disabled={!state.configured}
            >
              Probar conexión
            </ActionButton>
          </div>
        </section>

        <section aria-labelledby="publicaciones" className="grid gap-3">
          <h2 id="publicaciones" className="text-lg font-bold">
            Publicaciones recientes
          </h2>
          {state.publications.length === 0 ? (
            <p className="text-neutral-600">
              Todavía no se ha publicado nada. Cuando salga la programación o un partido, aparecerá aquí con
              su estado.
            </p>
          ) : (
            <ResourceList label="Publicaciones recientes en Facebook">
              {state.publications.map((publication) => (
                <PublicationRow key={publication.id} publication={publication} />
              ))}
            </ResourceList>
          )}
        </section>
      </div>
    </>
  )
}
