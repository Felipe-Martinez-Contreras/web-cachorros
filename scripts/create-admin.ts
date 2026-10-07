// `pnpm admin:create` (desarrollo) · `node scripts/create-admin.mjs` (dentro del contenedor).
//
// Interactivo por defecto. Sin terminal (CI, automatización) lee ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD.
// Con `--restablecer` cambia la contraseña de un administrador que ya existe y reactiva su cuenta.
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import * as z from 'zod'
import { sql } from '@/db/client'
import { createAdmin, createAdminSchema } from '@/lib/auth/create-admin'

async function ask(question: string, { hidden = false } = {}): Promise<string> {
  let muted = false
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk)
      callback()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: true })
  try {
    const pending = rl.question(question)
    muted = hidden // la pregunta ya se mostró: lo que se escribe después no se imprime
    const answer = await pending
    if (hidden) process.stdout.write('\n')
    return answer
  } finally {
    rl.close()
  }
}

async function readInput() {
  const fromEnv = {
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }
  if (fromEnv.email && fromEnv.password) {
    return { ...fromEnv, name: fromEnv.name || 'Administrador' }
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'Sin terminal interactiva: define ADMIN_EMAIL y ADMIN_PASSWORD (y opcionalmente ADMIN_NAME).',
    )
  }
  console.log('Crear administrador del panel\n')
  const name = await ask('Nombre: ')
  const email = await ask('Correo: ')
  const password = await ask('Contraseña (mínimo 12 caracteres, no se muestra): ', { hidden: true })
  const confirm = await ask('Repite la contraseña: ', { hidden: true })
  if (password !== confirm) throw new Error('Las contraseñas no coinciden.')
  return { name, email, password }
}

let exitCode = 0
try {
  const reset = process.argv.includes('--restablecer')
  const parsed = createAdminSchema.safeParse(await readInput())
  if (!parsed.success) {
    const errors = Object.values(z.flattenError(parsed.error).fieldErrors).flat()
    throw new Error(`Datos no válidos:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }

  const result = await createAdmin(parsed.data, { reset })
  if (result.status === 'ya_existe') {
    throw new Error(
      `Ya existe una cuenta con el correo ${result.email}. Para cambiar su contraseña usa: pnpm admin:create --restablecer`,
    )
  }
  console.log(
    result.status === 'creado'
      ? `Listo: administrador creado (${result.email}). Ya puede entrar en /admin/login.`
      : `Listo: contraseña restablecida para ${result.email}. Se cerraron sus sesiones abiertas.`,
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  await sql.end()
}
process.exit(exitCode)
