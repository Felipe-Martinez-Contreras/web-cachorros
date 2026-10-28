# ADR 0009 — Publicación en la página de Facebook con la Graph API y una cola en la base

- **Estado:** propuesto el 24 de octubre de 2026 (rama `redes-facebook`, PR #15)
- **Fecha:** 24 de octubre de 2026

## Contexto

El club quiere que la «Programación del fin de semana» salga sola en su página de Facebook (por defecto el
viernes a las 12:00), poder publicar a mano la previa o el resultado de un partido revisando antes la imagen y
el texto, y, opcionalmente, que los resultados salgan solos al finalizar un partido.

Lo que ya existe y condiciona la decisión:

- Las tarjetas para redes (2.8) se dibujan con `next/og` en el servidor, se guardan por versión en disco y se
  generan en una cola de 1 (`runHeavy`). Son la imagen que se publica: sin IA generativa, con datos exactos.
- Staging tiene `robots.txt` cerrado y datos de ejemplo, y comparte la imagen con producción: lo que cambia
  entre los dos son solo las variables de entorno.
- La VM es una e2-micro: no hay espacio para un servicio de colas aparte.
- La tarea `tick` ya corre cada 5 minutos desde el contenedor `ops` (12.8).

## Opciones

1. **SDK de Meta** (`facebook-nodejs-business-sdk`): una dependencia pesada para dos llamadas (subir una foto y
   leer el nombre de la página). Descartada por la regla de dependencias.
2. **Publicar en el momento, sin registro:** simple, pero ante un error de red no se sabe qué quedó publicado
   y un doble clic o dos ticks simultáneos pueden duplicar el post.
3. **`fetch` nativo y una cola en PostgreSQL** procesada por `tick`, con una fila por publicación.
4. **Publicar por URL** (`url=` en lugar del archivo): Facebook descargaría la tarjeta desde el sitio. No sirve
   en staging (cerrado) y depende de que Cloudflare deje pasar al rastreador de Meta.

## Propuesta

La opción 3, subiendo la imagen como archivo (multipart):

- **Tabla `social_publications`** (migración 0005, solo aditiva): canal, tipo (`programacion`, `proximo`,
  `resultado`), sujeto (uuid del partido o sábado del fin de semana), estado, intentos, último error saneado,
  próximo intento, id y enlace del post, quién la pidió.
- **Idempotencia:** índice único `(channel, kind, subject_key)`. Encolar es `INSERT … ON CONFLICT DO NOTHING`;
  publicar toma la fila con `SELECT … FOR UPDATE SKIP LOCKED` y solo si `isPublishable()` (pendiente, o con
  error y ya en su hora). Lo publicado nunca se vuelve a enviar.
- **Estado `incierto`:** si Facebook no respondió (timeout, conexión cortada a medias, 5xx sin detalle) el post
  pudo quedar arriba. No se reintenta solo: el panel pide revisar la página antes de «Reintentar». Las fallas
  transitorias (límites de uso, sin conexión) se reintentan a los 5, 15, 45 y 120 minutos; un token vencido o
  un permiso faltante quedan «Con error» sin reintentos.
- **Disparadores:** `tick` encola la programación desde la hora configurada hasta el primer partido del fin de
  semana (si hay partidos) y los resultados 10 minutos después de finalizar (si está activo); además publica lo
  pendiente, de a 3 por tick. La publicación manual encola dentro de la transacción de la acción y llama a la
  Graph API **después** del commit: si Facebook falla, la fila queda en la cola.
- **Secretos solo en `.env`:** `FACEBOOK_PAGE_ID` y `FACEBOOK_PAGE_TOKEN` (token de página de larga duración).
  El token va en el cuerpo de la petición, nunca en la URL, y se borra de cualquier mensaje antes de guardarlo.
- **Entornos:** fuera de `SITE_ENV=production` no se publica salvo con `FACEBOOK_ALLOW_NON_PRODUCTION=true`.
  `FACEBOOK_GRAPH_URL` distinta de la oficial solo se acepta en `development` (la API simulada de las e2e).
- **Ajustes en la base** (`site_settings.social_publishing`, `jsonb`): activar, día y hora, resultados sí o no,
  y desde cuándo está activo cada uno (no se publica nada programado antes de activarlo).
- **Auditoría:** las acciones del panel con su usuario; lo que publica `tick`, como sistema (`user_id` nulo).

## Instagram, más adelante

Es la misma app de Meta y la misma forma de canal (`PublishChannel` en
`src/features/social-publishing/channels/`), con dos diferencias que ya quedan previstas:

- La API de publicación de Instagram (*Content Publishing*) **no acepta el archivo**: pide `image_url`, una URL
  pública que Meta descarga. El canal de Instagram usará la URL versionada de la tarjeta
  (`/api/share/...?v=`, inmutable y cacheada por Cloudflare), así que solo funcionará en producción.
- Necesita una cuenta profesional de Instagram vinculada a la página y el permiso
  `instagram_content_publish` `[VERIFICAR al implementarlo]`.

El enum `social_channel` ya tiene `instagram`, el índice único es por canal y los ajustes se guardan bajo la
clave de cada canal: sumarlo no cambia el esquema.

## Consecuencias

- Sin dependencias nuevas ni servicios nuevos en la VM.
- Una publicación llega a Facebook con hasta 5 minutos de demora respecto de su hora (el intervalo de `tick`).
- La versión de la Graph API (`GRAPH_API_VERSION`, hoy `v26.0`) queda fija en el código: Meta mantiene cada
  versión unos dos años, así que hay que revisarla al menos una vez al año.
- El token de página no vence por fecha, pero se invalida si quien lo generó pierde su rol en la página, cambia
  su contraseña o se quita la app. El panel lo muestra como «Con error» y la guía explica cómo renovarlo.
- La CI nunca llama a Facebook: la integración simula `fetch` y apunta a una dirección que falla al instante,
  y las e2e usan `tests/e2e/graph-mock.mjs`.

## Adenda (28 de octubre de 2026): programar por jornada o partido

**Contexto.** La programación semanal publica un solo post para sábado y domingo, a una hora fija. El club
prefiere decidir cuándo sale cada jornada o partido.

**Decisión** (rama `facebook-por-jornada`, PR #24):

- **Misma tabla, estado nuevo.** `social_publications` suma el estado `programada`, `scheduled_at` y
  `scheduled_snapshot` (día en Santiago, rival y partidos de la tarjeta al programar), más
  `discard_notified_at` / `discard_notify_attempts` para el aviso por correo (migración 0009, solo aditiva; sin
  CHECK sobre `programada`, porque Postgres no deja usar un valor de enum en la misma transacción que lo crea).
  El índice único `(channel, kind, subject_key)` sigue siendo la idempotencia: una publicación por jornada o
  partido. Una fila `descartado` se reutiliza al volver a programar o publicar (`ON CONFLICT … DO UPDATE
  WHERE status = 'descartado'`); cancelar una programada la borra.
- **Publicación.** `tick` publica las programadas cuya hora llegó, con el mismo bloqueo, reintentos y auditoría.
  La tarjeta y el texto se arman al publicar con los datos vigentes (series y fotos guardadas en la fila); un
  texto igual al sugerido se guarda como `null` para regenerarse. La hora debe estar al menos 5 minutos en el
  futuro y antes del primer partido.
- **Seguros** (`scheduleGuard`, lógica pura). Cada tick (aunque Facebook esté apagado) y otra vez dentro del
  bloqueo, se compara la foto con los partidos vigentes. Se descarta con el motivo si un partido se cancela,
  posterga, suspende o elimina, si cambia el día o el rival, si cambió la hora y el texto se escribió a mano, si
  el inicio quedó antes de la hora programada o si el partido ya empezó (así, con Facebook apagado, nunca sale
  tarde). Un cambio de hora el mismo día con el texto sugerido se mantiene. Una foto que pasa a «contiene
  menores» se reemplaza por la de respaldo de Ajustes.
- **Aviso.** Un descarte por seguro avisa en el panel y por correo a los administradores, una sola vez por fila,
  con hasta 5 reintentos en 48 horas. Un descarte a mano marca `discard_notified_at` al descartar y no avisa.
- **Panel.** Sección propia «Facebook» (Programadas, Publicadas, Ajustes); la jornada y el partido ofrecen
  «Publicar ahora» o «Programar». Las miniaturas no se dibujan al abrir una página: si la versión no está en
  caché, «Ver imagen» la dibuja al tocarla.
- **La semanal queda secundaria** (`weekly`, apagada por defecto): solo cubre sábado y domingo. No se elimina
  todavía.

**Consecuencias.** Sin dependencias ni servicios nuevos. Al desplegar, la semanal se apaga aunque estuviera
activa; hay que programar cada jornada o volver a activarla en Ajustes.
