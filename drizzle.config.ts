import { defineConfig } from 'drizzle-kit'

// Solo se usa para `drizzle-kit generate` (no se conecta a la BD). Prohibido `drizzle-kit push`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
})
