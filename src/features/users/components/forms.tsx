'use client' // Cliente: formularios de usuarios y de «Mi cuenta» (react-hook-form + Zod).

import { EntityForm } from '@/components/admin/entity-form'
import type { ActionResult } from '@/lib/action-result'
import { changePasswordSchema, inviteUserSchema } from '../schemas'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

export function InviteUserForm({ action }: { action: Action }) {
  return (
    <EntityForm
      schema={inviteUserSchema}
      action={action}
      defaultValues={{ name: '', email: '' }}
      resetOnSuccess
      submitLabel="Enviar invitación"
      successMessage="Invitación enviada. El enlace vale por 1 hora."
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'off' },
        {
          name: 'email',
          label: 'Correo',
          type: 'email',
          inputMode: 'email',
          help: 'Le llegará un enlace para crear su contraseña. Tendrá acceso a todo el panel.',
        },
      ]}
    />
  )
}

export function ChangePasswordForm({ action }: { action: Action }) {
  return (
    <EntityForm
      schema={changePasswordSchema}
      action={action}
      defaultValues={{ currentPassword: '', newPassword: '', confirm: '' }}
      resetOnSuccess
      submitLabel="Cambiar contraseña"
      successMessage="Contraseña cambiada. Se cerraron tus otras sesiones."
      fields={[
        {
          name: 'currentPassword',
          label: 'Contraseña actual',
          type: 'password',
          autoComplete: 'current-password',
        },
        {
          name: 'newPassword',
          label: 'Contraseña nueva',
          type: 'password',
          autoComplete: 'new-password',
          help: 'Al menos 12 caracteres. Una frase larga es fácil de recordar y difícil de adivinar.',
        },
        {
          name: 'confirm',
          label: 'Repite la contraseña nueva',
          type: 'password',
          autoComplete: 'new-password',
        },
      ]}
    />
  )
}
