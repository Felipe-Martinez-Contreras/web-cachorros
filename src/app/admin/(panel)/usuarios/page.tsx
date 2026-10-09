import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import {
  cerrarSesionesDeUsuario,
  desactivarUsuario,
  invitarAdministrador,
  reactivarUsuario,
  reenviarInvitacion,
} from '@/features/users/actions'
import { InviteUserForm } from '@/features/users/components/forms'
import { listUsersAdmin } from '@/features/users/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatLongDateTime, formatShortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsersPage() {
  const me = await requirePanelUser('users:manage')
  const rows = await listUsersAdmin()

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Las personas que pueden entrar al panel. No hay registro público: se invita desde aquí."
      />
      <ResourceList label="Administradores">
        {rows.map((row) => {
          const isMe = row.id === me.id
          return (
            <ResourceRow
              key={row.id}
              title={isMe ? `${row.name} (tú)` : row.name}
              subtitle={
                <>
                  {row.email} · desde el {formatShortDate(row.createdAt)}
                  <br />
                  {row.lastSeenAt
                    ? `Última actividad: ${formatLongDateTime(row.lastSeenAt)}`
                    : 'Sin sesiones abiertas'}
                </>
              }
              badges={
                <>
                  <Badge variant={row.isActive ? 'success' : 'dark'}>
                    {row.isActive ? 'Activa' : 'Desactivada'}
                  </Badge>
                  <Badge variant={row.twoFactorEnabled ? 'neutral' : 'soft'}>
                    {row.twoFactorEnabled ? 'Con dos pasos' : 'Sin dos pasos'}
                  </Badge>
                </>
              }
              actions={
                !isMe && (
                  <>
                    {row.isActive && (
                      <ActionButton
                        action={reenviarInvitacion.bind(null, row.id)}
                        successMessage="Enlace enviado. Vale por 1 hora."
                        aria-label={`Enviar a ${row.name} el enlace para crear su contraseña`}
                      >
                        Enviar enlace
                      </ActionButton>
                    )}
                    {row.activeSessions > 0 && (
                      <ActionButton
                        action={cerrarSesionesDeUsuario.bind(null, row.id)}
                        successMessage="Sesiones cerradas."
                        aria-label={`Cerrar las sesiones de ${row.name}`}
                        confirm={{
                          title: `¿Cerrar las sesiones de ${row.name}?`,
                          description: 'Tendrá que volver a entrar en todos sus dispositivos.',
                          confirmLabel: 'Sí, cerrar',
                        }}
                      >
                        Cerrar sesiones
                      </ActionButton>
                    )}
                    {row.isActive ? (
                      <ActionButton
                        action={desactivarUsuario.bind(null, row.id)}
                        variant="danger"
                        successMessage="Cuenta desactivada."
                        aria-label={`Desactivar la cuenta de ${row.name}`}
                        confirm={{
                          title: `¿Desactivar la cuenta de ${row.name}?`,
                          description:
                            'Pierde el acceso de inmediato. Lo que hizo queda registrado y puedes reactivarla después.',
                          confirmLabel: 'Sí, desactivar',
                        }}
                      >
                        Desactivar
                      </ActionButton>
                    ) : (
                      <ActionButton
                        action={reactivarUsuario.bind(null, row.id)}
                        successMessage="Cuenta reactivada."
                        aria-label={`Reactivar la cuenta de ${row.name}`}
                      >
                        Reactivar
                      </ActionButton>
                    )}
                  </>
                )
              }
            />
          )
        })}
      </ResourceList>

      <section aria-labelledby="invitar" className="mt-10 grid gap-4">
        <h2 id="invitar" className="text-lg font-bold">
          Invitar a un administrador
        </h2>
        <InviteUserForm action={invitarAdministrador} />
      </section>
    </>
  )
}
