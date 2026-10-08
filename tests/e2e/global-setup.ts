import { spawnSync } from 'node:child_process'
import { E2E_USERS, PASSWORD } from './support'

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['scripts/run.mjs', ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

/**
 * Deja la base lista para las pruebas: borra lo que crearon las pruebas anteriores, datos de ejemplo del seed (sin partido en vivo) y los usuarios de
 * prueba con una contraseña conocida (los crea o los restablece).
 */
export default function globalSetup() {
  const clean = run(['e2e-clean'])
  if (clean.status !== 0) {
    throw new Error(`No se pudo limpiar lo que dejaron las pruebas anteriores:
${clean.stdout}${clean.stderr}`)
  }

  const seed = run(['seed'])
  if (seed.status !== 0) {
    throw new Error(
      `No se pudieron cargar los datos de ejemplo:\n${seed.stdout}${seed.stderr}\n` +
        '¿Está corriendo PostgreSQL y se aplicaron las migraciones (pnpm db:migrate)?',
    )
  }

  for (const user of E2E_USERS) {
    const result = run(['create-admin', '--restablecer'], {
      ADMIN_NAME: user.name,
      ADMIN_EMAIL: user.email,
      ADMIN_PASSWORD: PASSWORD,
    })
    if (result.status !== 0) {
      throw new Error(
        `No se pudo preparar el usuario ${user.email}:\n${result.stdout}${result.stderr}\n` +
          '¿Está corriendo PostgreSQL y se aplicaron las migraciones (pnpm db:migrate)?',
      )
    }
  }
}
