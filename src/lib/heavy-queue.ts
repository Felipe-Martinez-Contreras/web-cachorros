import 'server-only'
import { createSerialQueue } from '@/features/media/lib/upload-rules'

/**
 * Cola de 1 para todo el trabajo pesado del proceso (sharp al subir imágenes y Satori al dibujar tarjetas,
 * especificación 2.7 y 2.8): nunca corren dos a la vez, así el pico de memoria de la VM queda acotado.
 */
export const runHeavy = createSerialQueue()
