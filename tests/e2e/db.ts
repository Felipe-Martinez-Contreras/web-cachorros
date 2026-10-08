import postgres from 'postgres'

/**
 * Conexión de solo lectura (por convención) a la base local para que una prueba e2e pueda elegir datos
 * del seed, por ejemplo un jugador juvenil. Las pruebas nunca escriben por aquí: los cambios se hacen
 * por el panel, que es lo que invalida la caché del sitio.
 */
export function adminSql() {
  if (!process.env.DATABASE_ADMIN_URL) process.loadEnvFile('.env')
  const url = process.env.DATABASE_ADMIN_URL
  if (!url) throw new Error('Falta DATABASE_ADMIN_URL para las pruebas e2e.')
  return postgres(url, { max: 1, onnotice: () => {} })
}
