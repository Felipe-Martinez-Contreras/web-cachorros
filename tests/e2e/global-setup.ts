import { spawnSync } from 'node:child_process'
import { E2E_USERS, PASSWORD } from './support'

/** Deja los usuarios de prueba con una contraseña conocida (los crea o los restablece). */
export default function globalSetup() {
  for (const user of E2E_USERS) {
    const result = spawnSync(process.execPath, ['scripts/run.mjs', 'create-admin', '--restablecer'], {
      env: { ...process.env, ADMIN_NAME: user.name, ADMIN_EMAIL: user.email, ADMIN_PASSWORD: PASSWORD },
      encoding: 'utf8',
    })
    if (result.status !== 0) {
      throw new Error(
        `No se pudo preparar el usuario ${user.email}:\n${result.stdout}${result.stderr}\n` +
          '¿Está corriendo PostgreSQL y se aplicaron las migraciones (pnpm db:migrate)?',
      )
    }
  }
}
