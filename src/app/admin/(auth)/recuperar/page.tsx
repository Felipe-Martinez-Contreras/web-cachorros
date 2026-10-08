import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mt-1 mb-2 text-2xl font-bold">Recuperar contraseña</h1>
      <p className="mb-6 text-neutral-600">
        Escribe tu correo y te enviaremos un enlace para crear una nueva.
      </p>
      <ForgotPasswordForm />
      <p className="mt-2">
        <Link href="/admin/login" className="inline-flex min-h-11 items-center text-(--link) underline">
          Volver a entrar
        </Link>
      </p>
    </>
  )
}
