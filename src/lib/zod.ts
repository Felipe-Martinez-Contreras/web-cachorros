import * as z from 'zod'

// Mensajes de validación en español para todos los esquemas (especificación 3.9).
z.config(z.locales.es())

export { z }
