const MARKER = /^\[(COMPLETAR|DECIDIR|VERIFICAR)[^\]]*\]$/

/**
 * `true` si el texto es un marcador de contenido pendiente (`[COMPLETAR: …]`, especificación 0.3). Los
 * formularios del panel lo aceptan tal cual: el dato sigue apareciendo en los pendientes hasta que el
 * club lo complete, en vez de perderse o de inventarse.
 */
export function isContentMarker(value: unknown): boolean {
  return typeof value === 'string' && MARKER.test(value.trim())
}
