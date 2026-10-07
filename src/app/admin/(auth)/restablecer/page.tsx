import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

export const metadata: Metadata = { title: 'Crear contraseña nueva' }

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mt-1 mb-6 text-2xl font-bold">Crear contraseña nueva</h1>
      {/* El token viene en la URL y se lee en el cliente: el resto de la página es estático. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-neutral-100" />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  )
}
