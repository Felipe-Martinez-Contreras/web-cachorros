# Publicación en la página de Facebook

El sitio puede publicar solo en la página de Facebook del club:

- **La programación del fin de semana:** el día y la hora que se elijan (por defecto, el viernes a las 12:00,
  hora de Chile), con la tarjeta 4:5 y un texto armado con los partidos. Siempre es un solo post: con un solo
  partido sale su tarjeta «Próximo partido»; si todos los partidos son una sola jornada (contra el mismo rival
  el mismo día), la tarjeta «Jornada»; con varios rivales o días, la grilla «Programación». Si ese fin de
  semana no hay partidos, no publica nada.
- **La previa o el resultado de un partido, a mano:** desde la ficha del partido, con «Publicar en Facebook»,
  viendo antes la imagen y pudiendo cambiar el texto.
- **La tarjeta de una jornada, a mano:** desde Partidos → «Jornadas próximas» (o al terminar «Programar
  jornada»), eligiendo las series y las fotos. Cada jornada se publica una sola vez, y no si ya salió como la
  programación del fin de semana.
- **El resultado al finalizar un partido** (opcional): unos 10 minutos después de finalizarlo.

La decisión técnica está en el [ADR 0009](../adr/0009-publicacion-en-redes-graph-api.md). Esta guía explica cómo
conectar la página. Se hace una vez y la puede hacer cualquier persona que administre la página.

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

1. **Configuración → Facebook → Probar conexión.** Debe decir «La conexión con la página de Facebook
   funciona». No publica nada.
2. Marca **Publicar en Facebook**, revisa el día y la hora, decide si se publican los resultados y guarda.
3. Para probar sin esperar al viernes, abre un partido programado y usa **Publicar en Facebook**.

### Las fotos del «Próximo partido»

La tarjeta matchday lleva tres fotos: la primera sale en blanco y negro, la segunda a color y la tercera con un
velo naranjo. Elígelas en **Configuración → Facebook** desde la biblioteca de medios. Sin fotos, cada panel usa
un fondo con los colores del club.

- Las fotos marcadas «contiene menores» no se pueden elegir, y si una foto se marca así después, deja de usarse
  sola.
- Al publicar un partido a mano, en **Fotos de esta publicación** puedes cambiarlas solo para ese post: la
  vista previa se actualiza antes de confirmar.

Lo que se publica aparece en **Configuración → Facebook → Publicaciones recientes**, con su estado:

| Estado | Qué significa | Qué hacer |
|---|---|---|
| Publicado | Está en Facebook | «Ver en Facebook» lleva al post |
| Pendiente | Sale en los próximos 5 minutos | Nada |
| Con error | Facebook la rechazó o se agotaron los 5 intentos | Lee el error, corrígelo y usa «Reintentar» |
| Sin confirmar | Facebook no respondió: puede que sí se haya publicado | Revisa la página. Si no está, «Reintentar»; si está, «Descartar» |
| Descartado | No se va a enviar | Se puede reintentar si cambias de opinión |

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
