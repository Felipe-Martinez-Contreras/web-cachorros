# Publicación en la página de Facebook

El sitio publica en la página de Facebook del club. Todo se maneja desde el menú del panel → **Facebook**
(pestañas **Programadas**, **Publicadas** y **Ajustes**):

- **Cada jornada o partido, programado o al momento:** desde la página de la jornada (Partidos → «Jornadas
  próximas», o al terminar «Programar jornada») o desde la ficha de un partido → «Publicar o programar en
  Facebook». Ahí eliges las series (solo jornada) y las 3 fotos, ves la tarjeta, revisas el texto y eliges
  **Publicar ahora** o **Programar** (día y hora de Chile). Es la forma recomendada.
- **El resultado de un partido:** desde su ficha, al momento (no se programa).
- **El resultado al finalizar un partido** (opcional, en Ajustes): sale solo unos 10 minutos después de
  finalizarlo.
- **La publicación automática semanal** (opcional y **apagada por defecto**): un solo post con la programación
  del fin de semana, el día y la hora que se elijan. **Solo cubre sábado y domingo.**

Cada jornada o partido se publica una sola vez.

La decisión técnica está en el [ADR 0009](../adr/0009-publicacion-en-redes-graph-api.md). Esta guía explica cómo
conectar la página (se hace una vez y la puede hacer cualquier persona que administre la página) y cómo
programar.

> Revisado con la documentación oficial de Meta el 24 de octubre de 2026. Los nombres de los menús de Meta for
> Developers cambian seguido: si algo no coincide, busca la opción equivalente.

## Lo que necesitas

- Una cuenta personal de Facebook que **administre la página del club** (con control total, o al menos con
  permiso para crear contenido).
- Acceso a la VM para editar `/opt/cachorros/.env` (ver [despliegue](../despliegue.md)).
- Unos 20 minutos.

## Permisos y vigencia (lo que dice Meta)

| Qué | Detalle |
|---|---|
| Permisos | `pages_manage_posts`, `pages_read_engagement` y `pages_show_list`: son los que pide `POST /{page-id}/photos` |
| Token | **Token de página** generado por alguien que puede crear contenido en la página |
| Revisión de Meta | No hace falta: con **acceso estándar** la app puede usar esos permisos con personas que tienen un rol en la app. La verificación del negocio y la revisión de la app solo se piden para el acceso avanzado (usuarios sin rol), que aquí no se usa |
| Token de usuario corto | Dura alrededor de una hora |
| Token de usuario largo | Dura unos 60 días |
| Token de página sacado de un token de usuario largo | **No tiene fecha de vencimiento.** Deja de servir si quien lo generó pierde su rol en la página, cambia su contraseña, quita la app o revoca los permisos |

Referencias:
[permisos de `/{page-id}/photos`](https://developers.facebook.com/docs/graph-api/reference/page/photos/),
[tokens de larga duración](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived),
[niveles de acceso](https://developers.facebook.com/docs/graph-api/overview/access-levels/).

## 1. Crear la app en Meta for Developers

1. Entra a [developers.facebook.com](https://developers.facebook.com) con la cuenta que administra la página y,
   si es la primera vez, regístrate como desarrollador.
2. **Mis apps → Crear app.** Ponle un nombre reconocible («Sitio Los Cachorros») y un correo de contacto del club.
3. En el caso de uso, elige el de **administrar todo en tu página** (o, si aparece la pregunta por el tipo,
   **Negocio**). `[VERIFICAR: nombre exacto del caso de uso al crearla]`
4. Si pide un portafolio comercial (Business Manager), puedes elegir el del club u omitirlo.
5. En el caso de uso, **agrega los permisos** `pages_show_list`, `pages_read_engagement` y `pages_manage_posts`.
   Con acceso estándar no hace falta enviarlos a revisión.
6. Deja la app como está: no hace falta pasarla a «En vivo» mientras solo la use gente con rol en ella
   `[VERIFICAR: si Meta lo exige para publicar en una página real]`.
7. En **Configuración de la app → Básica**, anota el **identificador de la app** y la **clave secreta**. La
   clave secreta es como una contraseña: no la pegues en chats ni en documentos compartidos.

## 2. Token de usuario de corta duración

1. Abre el [Explorador de la Graph API](https://developers.facebook.com/tools/explorer/).
2. Arriba a la derecha, elige tu app.
3. En **Permisos**, agrega `pages_show_list`, `pages_read_engagement` y `pages_manage_posts`.
4. **Generate Access Token** (Generar token): Facebook te pide autorizar la app. Elige **solo la página del
   club** y acepta.
5. Copia el token que aparece. Vence en alrededor de una hora: haz el paso siguiente ahora.

## 3. Cambiarlo por uno de larga duración

Desde tu PC, en PowerShell (reemplaza los tres valores; el comando no queda en ningún servidor):

```powershell
$app = 'IDENTIFICADOR_DE_LA_APP'
$secreto = 'CLAVE_SECRETA_DE_LA_APP'
$corto = 'TOKEN_DEL_PASO_2'
$largo = (Invoke-RestMethod "https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$app&client_secret=$secreto&fb_exchange_token=$corto").access_token
$largo
```

En Linux o macOS:

```bash
curl -s "https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=IDENTIFICADOR&client_secret=CLAVE_SECRETA&fb_exchange_token=TOKEN_CORTO"
```

Meta pide hacer esta llamada desde un servidor o un equipo propio, nunca desde una página web, porque lleva la
clave secreta.

## 4. Sacar el token de la página

Con el token largo del paso 3:

```powershell
(Invoke-RestMethod "https://graph.facebook.com/v26.0/me/accounts?access_token=$largo").data |
  Select-Object name, id, access_token
```

Busca la fila con el nombre de la página del club:

- `id` → es el **`FACEBOOK_PAGE_ID`**.
- `access_token` → es el **`FACEBOOK_PAGE_TOKEN`**.

Después, cierra PowerShell: el historial de la ventana guarda los valores.

## 5. Comprobar el token

En el [Depurador de tokens](https://developers.facebook.com/tools/debug/accesstoken/) pega el token de la
página y revisa:

- **Tipo:** página, la del club.
- **Caduca:** «Nunca».
- **Permisos:** aparecen los tres del paso 1.

## 6. Cargarlo en el servidor

En la VM (entra por IAP, como dice la [guía de despliegue](../despliegue.md)):

```bash
cd /opt/cachorros
nano .env
```

Completa estas líneas (si no existen, agrégalas):

```text
FACEBOOK_PAGE_ID=123456789012345
FACEBOOK_PAGE_TOKEN=EAAB…
FACEBOOK_ALLOW_NON_PRODUCTION=false
```

Guarda y reinicia la app para que lea los valores nuevos:

```bash
docker compose up -d app
```

El `.env` debe seguir con permisos 600 (`ls -l .env` muestra `-rw-------`).

**En staging** no se publica nada aunque el token esté cargado. Para probar a propósito, usa una **página de
prueba** (no la oficial) y `FACEBOOK_ALLOW_NON_PRODUCTION=true`; al terminar, vuelve a `false`.

## 7. Activarlo en el panel

1. **Facebook → Ajustes → Probar conexión.** Debe decir «La conexión con la página de Facebook funciona». No
   publica nada.
2. Marca **Publicar en Facebook** (el interruptor general: sin él no sale nada, ni lo publicado a mano ni lo
   programado), elige la línea sobre «MATCHDAY» y las 3 fotos por defecto, decide si se publican los resultados
   y guarda.
3. Deja **apagada** la publicación automática semanal, salvo que el club la quiera además de lo programado:
   solo cubre sábado y domingo.

## Programar una jornada o un partido

1. Abre la jornada (Partidos → «Jornadas próximas») o la ficha del partido → «Publicar o programar en
   Facebook».
2. En la jornada, marca las series que van en la tarjeta. En los dos casos puedes cambiar las 3 fotos solo para
   ese post.
3. Revisa la tarjeta. Al abrir la página no se dibuja nada nuevo: si la tarjeta todavía no existe aparece
   **Ver imagen**, que la dibuja al tocarla.
4. Revisa el texto. **Si no lo cambias, se vuelve a armar al publicar** con los datos de ese momento (por
   ejemplo, si cambió la hora de un partido). Si lo escribes a mano, sale tal cual.
5. En **Cuándo**, elige **Programar** (o **Publicar ahora**). El día y la hora vienen sugeridos: el día anterior
   a la jornada a las 10:00, hora de Chile; si esa hora ya pasó, la próxima hora en punto. La hora debe estar al
   menos 5 minutos en el futuro y antes del primer partido. **Puede publicarse hasta 5 minutos después de la
   hora elegida** (la tarea que publica corre cada 5 minutos).
6. Ya programada, la página muestra «Se publicará el …» con **Cambiar fecha** y **Cancelar**. Lo mismo está en
   **Facebook → Programadas**, con la miniatura de la tarjeta.

Cancelar la borra: la jornada o el partido se puede volver a programar o publicar. La tarjeta y el texto
sugerido se generan al publicar, con las series y fotos guardadas al programar y los datos vigentes.

### Los seguros: cuándo una programada no sale

Cada 5 minutos, y otra vez justo antes de publicar, el sitio compara lo programado con los partidos. Aunque
Facebook esté apagado, revisa igual.

| Si antes de la hora… | Qué pasa |
|---|---|
| Un partido se **cancela**, se **posterga** o se **suspende** | No sale: queda «Descartado» con el motivo |
| Un partido (o su serie) se **elimina** | No sale |
| Cambia el **rival** | No sale |
| Cambia el **día** de un partido (la jornada pasa a ser otra) | No sale |
| Cambia la **hora** el mismo día y el texto es el sugerido | **Sale**, con la hora nueva en la tarjeta y el texto |
| Cambia la **hora** y el texto se había escrito a mano | No sale: el texto podría decir la hora vieja |
| La nueva hora de inicio queda **antes de la hora programada** | No sale |
| El partido **ya empezó** (por ejemplo, porque Facebook estaba apagado a la hora programada) | No sale. Nunca se publica tarde |

Si una foto elegida se borra o se marca «contiene menores» después de programar, ese panel usa la foto por
defecto de Ajustes en la misma posición (o queda en gris): la publicación sale igual, nunca con esa foto.

Cuando un seguro descarta una programada:

- El panel lo avisa en **Facebook → Programadas** y en **Inicio**, con el motivo y el enlace para volver a
  programarla.
- Se envía **un correo a los administradores** (una sola vez por publicación) con qué era, el motivo y el
  enlace. Si el correo falla, se reintenta hasta 5 veces en 48 horas.
- Si la descarta o la cancela una persona desde el panel, no se envía correo.

### Con «Publicar en Facebook» apagado

Se puede programar igual, pero nada sale: el formulario, **Programadas** e **Inicio** muestran «Facebook está
desactivado: lo programado no saldrá hasta que lo actives». Al activarlo, lo que ya pasó su hora sale en los
5 minutos siguientes si el partido todavía no empieza; si ya empezó, quedó descartado con su motivo.

### Las fotos de las tarjetas

La tarjeta matchday lleva tres fotos en blanco y negro. Las por defecto se eligen en **Facebook → Ajustes**
desde la biblioteca de medios; sin fotos, cada panel usa un fondo con los colores del club.

- Las fotos marcadas «contiene menores» no se pueden elegir, y si una foto se marca así después, deja de usarse
  sola.
- Al preparar una jornada o un partido puedes cambiarlas solo para ese post: la vista previa se actualiza
  antes de confirmar.

### Estados

Lo programado está en **Facebook → Programadas**; lo demás, en **Facebook → Publicadas**:

| Estado | Qué significa | Qué hacer |
|---|---|---|
| Programada | Sale sola a la hora elegida (hasta 5 minutos después) | «Cambiar fecha» o «Cancelar» |
| Pendiente | Sale en los próximos 5 minutos | Nada |
| Publicado | Está en Facebook | «Ver en Facebook» lleva al post |
| Con error | Facebook la rechazó o se agotaron los 5 intentos | Lee el error, corrígelo y usa «Reintentar» |
| Sin confirmar | Facebook no respondió: puede que sí se haya publicado | Revisa la página. Si no está, «Reintentar»; si está, «Descartar» |
| Descartado | No se va a enviar (a mano o por un seguro, con el motivo) | «Reintentar», o vuelve a programarla o publicarla desde su página |

## Renovar o cambiar el token

Repite los pasos 2 a 6 y reinicia la app. Hay que hacerlo si:

- El panel muestra «El token de la página venció o fue revocado».
- Quien generó el token deja de administrar la página o cambia su contraseña de Facebook.
- Cambia la directiva: lo recomendable es que el token lo genere una cuenta que va a seguir en el club, y
  rotarlo al cambiar de administradores (como los demás secretos, sección 9.7).

## Problemas comunes

| Error en el panel | Causa probable |
|---|---|
| «El token de la página venció o fue revocado» (código 190) | Ver «Renovar o cambiar el token» |
| Código 10 o 200 (permisos) | Al token le falta `pages_manage_posts`, o quien lo generó no puede crear contenido en la página |
| Códigos 4, 17, 32 o 613 (límite de uso) | Demasiadas llamadas: se reintenta solo |
| Código 368 | Facebook bloqueó temporalmente la publicación por sus reglas: se reintenta solo; si se repite, revisa la página |
| «Falta conectar la página…» | Falta `FACEBOOK_PAGE_ID` o `FACEBOOK_PAGE_TOKEN` en `.env`, o no se reinició la app |
| «Este sitio no es el de producción…» | Es staging: ver el paso 6 |

## Para quien mantiene el código

- La versión de la Graph API está en `GRAPH_API_VERSION` (`src/features/social-publishing/channels/facebook.ts`).
  Meta mantiene cada versión unos dos años: revísala al menos una vez al año.
- Las pruebas nunca llaman a Facebook. Integración: `fetch` simulado y una URL que falla al instante. E2E:
  `tests/e2e/graph-mock.mjs`, que Playwright levanta en el puerto 3190.
- Programadas: estado `programada` con `scheduled_at` y `scheduled_snapshot` (migración 0009). Las reglas puras
  (hora válida, hora sugerida, seguros, fotos de respaldo) están en `lib/scheduling.ts`; los seguros del tick y
  el correo de descarte, en `scheduled.ts`. Un descarte a mano marca `discard_notified_at` al descartar: así no
  se envía correo ni aparece en el aviso del panel.
