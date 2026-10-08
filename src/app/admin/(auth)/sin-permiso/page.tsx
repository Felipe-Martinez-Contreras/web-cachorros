import type { Metadata } from 'next'
import { LogoutButton } from '@/features/auth/components/logout-button'

export const metadata: Metadata = { title: 'Sin permiso' }

// Vive fuera del layout protegido del panel: es el destino de quien tiene sesión pero no acceso.
export default function NoPermissionPage() {
  return (
    <>
      <h1 className="mt-1 mb-2 text-2xl font-bold">No tienes permiso para ver esto</h1>
      <p className="mb-6 text-neutral-600">
        Tu cuenta no tiene acceso al panel. Si crees que es un error, habla con la directiva del club.
      </p>
      <LogoutButton />
    </>
  )
}
