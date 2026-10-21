# Seguridad y privacidad

Medidas de la sección 9 de la especificación que ya están implementadas, y el procedimiento ante una solicitud
de datos personales. Marco: Ley 19.628 y Ley 21.719 (vigencia prevista el 1 de diciembre de 2026)
`[VERIFICAR con asesoría legal]`.

## Qué datos personales guarda el sitio

| Dónde | Datos | Quién los ve | Cuánto tiempo |
|---|---|---|---|
| Solicitudes de socio (`membership_requests`) | Nombre, correo, celular, comuna, RUT (opcional), mensaje, consentimientos | Panel → Socios | Cerradas (aprobada, rechazada, archivada): se anonimizan a los 12 meses `[DECIDIR]` |
| Padrón (`members`) | Número de socio, nombre, RUT, correo, celular, plan, estado | Panel → Socios → Padrón | Mientras sea socio; se elimina a pedido |
| Solicitudes de auspicio (`sponsorship_inquiries`) | Comercio, nombre de contacto, correo, celular, mensaje | Panel → Auspiciadores → Solicitudes | Cerradas: se anonimizan a los 12 meses |
| Mensajes de contacto (`contact_messages`) | Nombre, correo, celular, tema, mensaje | Panel → Mensajes | Se eliminan a los 12 meses |
| Auditoría (`audit_log`) | Quién hizo qué en el panel; **nunca** nombres, RUT ni contacto de las personas | Panel → Actividad | Se elimina a los 12 meses |
| Clics de auspiciadores (`sponsor_clicks_daily`) | Solo conteos por día | Panel → Auspiciadores → Reporte | Se conservan (no son datos personales) |

Ningún formulario recibe datos de niños: solo los del adulto responsable (6.9).

## Medidas en los formularios públicos

- **Consentimiento** explícito, nunca premarcado y versionado: se guardan `privacy_consent_at` y
  `privacy_policy_version`. La versión es la fecha de la última edición de la política (panel → Textos de páginas
  → Política de privacidad), y se muestra en `/privacidad`.
- **Minimización:** el RUT es opcional en la solicitud de socio. La IP no se guarda: solo un HMAC con
  `IP_HASH_SALT`, para detectar abuso.
- **Anti-spam:** verificación de `Origin`, rate limit (5 envíos cada 10 minutos por formulario e IP), campo trampa,
  tiempo mínimo firmado y Turnstile validado en el servidor.
- **Correos:** el aviso a la directiva lleva `Reply-To` al remitente; los registros del servidor enmascaran
  todos los correos.

## Medidas en el panel

- Cada pantalla, acción y descarga verifica su permiso (`members:write`, `messages:write`, `sponsors:write`,
  `privacy:manage`).
- Las exportaciones CSV quedan en la auditoría con el número de filas. Las celdas que Excel leería como fórmula
  se neutralizan.
- La búsqueda de una persona viaja en el cuerpo de la petición (Server Action o POST), nunca en la URL: así el dato
  no queda en el historial del navegador ni en los registros del servidor.

## Procedimiento ante una solicitud de datos personales

Aplica a los derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo.

1. **Recibir la solicitud** por el formulario de contacto o el correo del club. Anotar la fecha: el plazo de
   respuesta corre desde ahí `[COMPLETAR: plazo legal en días hábiles]`.
2. **Verificar la identidad.** Responder desde el correo del club **al mismo correo o celular que figura en los
   datos**. Nunca entregar datos a otra dirección.
3. **Buscar** en Panel → Datos personales por el correo, el RUT (con guion) o el celular. La pantalla muestra
   cuántos registros hay en cada lugar.
4. Según lo que pida:
   - **Acceso o portabilidad:** «Exportar en JSON» y enviarle el archivo por un canal seguro.
   - **Rectificación:** corregir el dato en Socios → Padrón (o en la solicitud correspondiente).
   - **Supresión u oposición:** primero exportar (si pidió una copia) y después «Eliminar sus datos». Se borran
     sus solicitudes y mensajes. En el padrón queda como «baja», sin nombre, RUT ni contacto, y su número sigue
     reservado.
   - **Bloqueo:** en el padrón, cambiar su estado a «suspendido» y anotar el motivo fuera del sistema
     `[VERIFICAR: alcance del bloqueo con asesoría legal]`.
5. **Buscar de nuevo por los otros datos** de la persona (por ejemplo, el celular además del correo): una
   búsqueda encuentra lo que coincide con ese dato.
6. **Responder** a la persona con lo que se hizo. La auditoría (Panel → Actividad) registra la exportación y la
   eliminación con la fecha y el administrador, sin los datos.

Fuera del sistema: los correos de aviso que ya llegaron a las casillas de la directiva no se borran solos.
Cada destinatario debe eliminarlos a mano. Los respaldos se renuevan en 12 meses o menos (12.7).

## Tareas programadas

- `tick` (cada 5 minutos): reintenta los avisos por correo que fallaron (hasta 5 veces, dentro de 48 h).
- `daily` (03:30): aplica la retención de esta página (`src/features/inbox/retention.ts`). Es idempotente.

Ambas se llaman con `Authorization: Bearer $CRON_SECRET`. El contenedor `ops` que las ejecuta llega en la Fase 5.

## Pendientes

- Texto definitivo de la política de privacidad y datos legales del club `[COMPLETAR]` `[VERIFICAR con asesoría legal]`.
- Plazos de retención `[DECIDIR]` (default 12 meses).
- Rubros regulados de auspiciadores (alcohol, apuestas junto a formativas) `[VERIFICAR normativa]`.
