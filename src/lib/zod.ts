import * as z from 'zod'

// Mensajes de validación en español para todos los esquemas (especificación 3.9).
z.config(z.locales.es())
// Sin el JIT de Zod: su sonda de `new Function` la reporta la CSP del panel como violación (9.3).
z.config({ jitless: true })

export { z }
