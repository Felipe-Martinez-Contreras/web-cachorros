import path from 'node:path'
import { defineConfig } from 'vitest/config'

export const alias = {
  '@': path.resolve(import.meta.dirname, 'src'),
  // Fuera de Next, `server-only` siempre lanza: en las pruebas se reemplaza por un módulo vacío.
  'server-only': path.resolve(import.meta.dirname, 'scripts/lib/server-only-stub.mjs'),
}

// Pruebas unitarias: lógica pura, sin base de datos ni red.
export default defineConfig({
  resolve: { alias },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/features/*/lib/**', 'src/lib/permissions.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
