import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { guardarFacebook, probarConexionFacebook } from '@/features/social-publishing/actions'
import { facebookSettingsState } from '@/features/social-publishing/admin-queries'
import { FacebookTabs } from '@/features/social-publishing/components/facebook-notices'
import { FacebookSettingsForm } from '@/features/social-publishing/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Facebook: ajustes' }

export default async function FacebookSettingsPage() {
  await requirePanelUser('settings:write')
  const state = await facebookSettingsState()
  const { settings } = state

  return (
    <>
      <PageHeader
        title="Facebook"
        description="La conexión con la página del club y cómo salen las tarjetas."
      />
      <FacebookTabs current="/admin/facebook/ajustes" canConfigure />
      <div className="grid gap-8">
        <section aria-labelledby="conexion" className="grid max-w-2xl gap-3">
          <h2 id="conexion" className="text-lg font-bold">
            Conexión
          </h2>
          {!state.configured ? (
            <Alert variant="warning" title="La página todavía no está conectada">
              {state.blockedReason} Mientras tanto puedes dejar listos los ajustes.
            </Alert>
          ) : state.blockedReason ? (
            <Alert variant="warning" title="Por ahora no se publica nada">
              {state.blockedReason}
            </Alert>
          ) : (
            <Alert variant="success" title="Conectada y activa">
              Lo que se publique o programe saldrá en la página de Facebook del club.
            </Alert>
          )}
          {state.nonProductionAllowed && (
            <Alert variant="warning" title="Sitio de pruebas con publicación permitida">
              Este no es el sitio de producción, pero FACEBOOK_ALLOW_NON_PRODUCTION está activo: lo que se
              publique aparecerá en la página de Facebook conectada.
            </Alert>
          )}
          <p className="text-neutral-600">
            «Probar conexión» consulta la página con el token cargado en el servidor. No publica nada.
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

        <section aria-labelledby="ajustes" className="grid gap-3">
          <h2 id="ajustes" className="text-lg font-bold">
            Ajustes
          </h2>
          <p className="max-w-2xl text-neutral-600">
            La línea sobre «MATCHDAY» y las 3 fotos por defecto de las tarjetas. Cada jornada o partido puede
            usar otras fotos al prepararlo.
          </p>
          <FacebookSettingsForm
            action={guardarFacebook}
            previews={state.photoPreviews}
            defaults={{
              enabled: settings.enabled,
              weekly: settings.weekly ?? false,
              weekday: String(settings.weekday),
              time: settings.time,
              publishResults: settings.publishResults,
              photo1: settings.photos?.[0] ?? '',
              photo2: settings.photos?.[1] ?? '',
              photo3: settings.photos?.[2] ?? '',
              topLineMode: state.topLineMode,
              topLineText: settings.topLine?.text ?? '',
              topLineLogo: settings.topLine?.logoId ?? '',
            }}
          />
        </section>
      </div>
    </>
  )
}
