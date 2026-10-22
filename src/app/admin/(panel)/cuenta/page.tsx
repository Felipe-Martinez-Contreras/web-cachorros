import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/feedback'
import { cambiarMiContrasena, cerrarMisOtrasSesiones } from '@/features/users/actions'
import { ChangePasswordForm } from '@/features/users/components/forms'
import { TwoFactorPanel } from '@/features/users/components/two-factor-panel'
import { getMyAccount } from '@/features/users/queries'
import { getCurrentSessionId, mustEnableTwoFactor, requirePanelUser } from '@/lib/auth/session'
import { formatLongDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Mi cuenta' }

const cardClass = 'grid gap-4 rounded-lg border border-neutral-200 bg-paper p-4'

export default async function MyAccountPage() {
  const me = await requirePanelUser('panel:access', { allowWithoutTwoFactor: true })
  const twoFactorRequired = mustEnableTwoFactor(me)
  const account = await getMyAccount(me.id, await getCurrentSessionId())
  const others = account.sessions.filter((item) => !item.isCurrent).length

  return (
    <>
      <PageHeader title="Mi cuenta" description={`${me.name} · ${me.email}`} />
      <div className="grid gap-6">
        {twoFactorRequired && (
          <Alert variant="warning" title="Activa la verificación en dos pasos">
            Para proteger los datos del club, el panel exige la verificación en dos pasos. Actívala aquí abajo
            con una app de autenticación; después podrás usar todos los módulos.
          </Alert>
        )}
        <section aria-labelledby="dos-pasos" className={cardClass}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="dos-pasos" className="text-lg font-bold">
              Verificación en dos pasos
            </h2>
            <Badge variant={account.twoFactorEnabled ? 'success' : 'soft'}>
              {account.twoFactorEnabled ? 'Activada' : 'Sin activar'}
            </Badge>
          </div>
          <TwoFactorPanel enabled={account.twoFactorEnabled} />
        </section>

        <section aria-labelledby="contrasena" className={cardClass}>
          <h2 id="contrasena" className="text-lg font-bold">
            Contraseña
          </h2>
          <ChangePasswordForm action={cambiarMiContrasena} />
        </section>

        <section aria-labelledby="sesiones" className={cardClass}>
          <h2 id="sesiones" className="text-lg font-bold">
            Dónde tienes la sesión abierta
          </h2>
          <ul className="grid gap-3">
            {account.sessions.map((item) => (
              <li
                key={item.id}
                className="grid gap-1 border-t border-neutral-200 pt-3 first:border-t-0 first:pt-0"
              >
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {item.device}
                  {item.isCurrent && <Badge variant="success">Esta sesión</Badge>}
                </p>
                <p className="text-sm text-neutral-600">
                  Abierta el {formatLongDateTime(item.startedAt)} · última actividad:{' '}
                  {formatLongDateTime(item.lastSeenAt)}
                </p>
              </li>
            ))}
          </ul>
          {others > 0 && (
            <div>
              <ActionButton
                action={cerrarMisOtrasSesiones}
                successMessage="Se cerraron tus otras sesiones."
                confirm={{
                  title: '¿Cerrar tus otras sesiones?',
                  description: 'Sigues dentro en este dispositivo; en los demás habrá que volver a entrar.',
                  confirmLabel: 'Sí, cerrar',
                }}
              >
                Cerrar las otras sesiones
              </ActionButton>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
