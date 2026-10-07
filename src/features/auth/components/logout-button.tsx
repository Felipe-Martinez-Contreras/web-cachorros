'use client' // Cliente: cierra la sesión en /api/auth y vuelve al login.

import { useState } from 'react'
import { authClient } from '@/lib/auth/client'

export function LogoutButton() {
  const [pending, setPending] = useState(false)

  async function onClick() {
    setPending(true)
    await authClient.signOut()
    window.location.assign('/admin/login')
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="min-h-12 rounded-md border border-neutral-400 px-4 font-medium disabled:opacity-60"
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}
