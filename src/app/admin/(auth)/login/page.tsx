import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/features/auth/components/login-form'

export const metadata: Metadata = { title: 'Entrar' }

export default function LoginPage() {
  return (
    <>
      <h1 className="mt-1 mb-6 text-2xl font-bold">Entrar al panel</h1>
      <LoginForm />
      <p className="mt-2">
        <Link href="/admin/recuperar" className="inline-flex min-h-11 items-center text-(--link) underline">
          Olvidé mi contraseña
        </Link>
      </p>
    </>
  )
}
