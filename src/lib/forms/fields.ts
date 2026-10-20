// Nombres de los campos de control de los formularios públicos. Sin dependencias de Node: los usa el cliente.

/** Campo trampa: invisible para las personas, los bots lo llenan. */
export const HONEYPOT_FIELD = 'sitio_web'
/** Momento firmado en que se dibujó el formulario. */
export const STAMP_FIELD = 'enviado_desde'
/** Campo que el widget de Turnstile agrega al formulario. */
export const TURNSTILE_FIELD = 'cf-turnstile-response'
