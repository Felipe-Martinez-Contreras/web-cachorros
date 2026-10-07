import { createAuthClient } from 'better-auth/react'

// Sin `baseURL`: usa el origen actual, así la misma build sirve en cualquier dominio.
export const authClient = createAuthClient()
