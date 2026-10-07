import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db/client'
import * as schema from '@/db/schema'
import { buildAuthOptions } from './options'

function createAuth() {
  return betterAuth({
    ...buildAuthOptions(),
    database: drizzleAdapter(db, { provider: 'pg', schema }),
  })
}

export type Auth = ReturnType<typeof createAuth>

let instance: Auth | undefined

/** Instancia perezosa: se crea con la primera petición, nunca durante `next build`. */
export function getAuth(): Auth {
  instance ??= createAuth()
  return instance
}
