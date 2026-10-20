# Fase 3a — Comunidad y datos personales

- **Rama:** `fase-3a-comunidad-y-datos` · PR #8
- **Fecha:** 20 de octubre de 2026
- **Alcance:** hitos 1 a 5 del plan de la Fase 3: la prueba inestable de la portada en vivo, los formularios
  públicos, socios, contacto y privacidad, auspiciadores, y los derechos y la retención de datos personales.
  La Fase 3 se cierra con el PR 3b (tienda, eventos, club, formativas, la cancha, donaciones, galería y videos).

## Qué quedó hecho

| Hito | Entregable | Dónde |
|---|---|---|
| 1 | **Prueba inestable de la portada en vivo.** El seed escribe sin invalidar la caché y la franja (`revalidate` 30 s) seguía mostrando «en vivo» en la prueba siguiente. Ahora la prueba recarga hasta ver el estado esperado después de cada seed | `tests/e2e/portada.spec.ts` |
| 2 | **Formularios públicos.** `POST /api/forms/[form]`: `Origin` (CSRF) → rate limit con 429 real → campo trampa y tiempo mínimo firmado → Turnstile → Zod. Funciona sin JavaScript (PRG). IP solo como HMAC; consentimiento versionado; aviso a la directiva con `after()` y reintento en `tick`; acuse de recibo | `src/lib/forms/`, `src/features/inbox/`, `src/components/site/public-form.tsx` |
| 3 | **Privacidad, contacto y socios.** `/privacidad` con la versión vigente; `/contacto` con temas, correo, WhatsApp y redes; `/socios` con beneficios, planes, formulario (RUT opcional con módulo 11) y preguntas frecuentes. Panel: solicitudes (responder con un toque, aprobar → padrón con número correlativo), padrón, planes y mensajes | `src/features/members/`, `/admin/socios/**`, `/admin/mensajes/**` |
| 4 | **Auspiciadores.** Vitrina por nivel con vigencia; formulario de interés; `/r/auspiciador/[slug]?a=web\|instagram\|whatsapp` cuenta el clic del día y redirige con 302. Panel: auspiciadores, solicitudes y reporte mensual de clics | `src/features/sponsors/`, `src/app/r/`, `/admin/auspiciadores/**` |
| 5 | **Derechos y retención.** Panel → Datos personales: buscar por correo, RUT o celular, exportar en JSON y eliminar. Tarea `GET /api/cron/daily` con la retención de 12 meses. Procedimiento escrito | `src/features/privacy/`, `src/features/inbox/retention.ts`, `docs/seguridad-privacidad.md` |

- Exportaciones CSV auditadas (padrón, solicitudes de socio y de auspicio, mensajes y clics) en
  `GET /api/admin/exportar/[lista]`: punto y coma, BOM UTF-8 y fórmulas neutralizadas.
- Una migración nueva, `0004_consentimiento_y_reintentos.sql`: solo agrega columnas (consentimiento en contacto y
  auspicios, y `notify_attempts` en las tres bandejas).
- Cuatro permisos nuevos (`members:write`, `messages:write`, `sponsors:write`, `privacy:manage`) y un grupo
  «Comunidad» en el panel.

## Criterios de aceptación de la Fase 3 que cubre este PR

| Criterio | Resultado | Evidencia |
|---|---|---|
| Envío válido: se guarda y se notifica a los destinatarios configurados (Mailpit) | ✅ | e2e `contacto.spec.ts`, `socios.spec.ts`, `auspiciadores.spec.ts` |
| Honeypot lleno o Turnstile inválido: se rechaza | ✅ | e2e `contacto.spec.ts`; integración `public-forms.test.ts` (clave «siempre falla») |
| 6.º envío en 10 min desde la misma IP: 429 con mensaje amable | ✅ | e2e `contacto.spec.ts`; integración `public-forms.test.ts` |
| Si el SMTP falla, la solicitud queda guardada y se reintenta desde `tick` | ✅ | integración `public-forms.test.ts` (5 intentos, 48 h) |
| Exportar y eliminar los datos de una persona desde el panel | ✅ | integración `privacy.test.ts`; e2e `datos-personales.spec.ts` |
| Contenido de ejemplo de la fase en el seed | ✅ (de este PR) | `seed.test.ts`: planes, padrón, solicitudes, mensajes, enlaces de auspiciadores y textos |
| WhatsApp de la tienda, PDF con `sandbox`, mapa y videos sin terceros | ⏳ PR 3b | — |

### Verificación

| Paso | Dónde | Resultado |
|---|---|---|
| `pnpm check` | local | en verde |
| `pnpm test` (unitarias) | local | 226 de 226 |
| `pnpm test:integration` | local | 186 de 186 |
| `pnpm build` (sin BD) | local y CI | en verde |
| e2e de cada hito (workers=1) | local | hito 2: 12/12 · hito 3: 8/8 · hito 4: 16/16 (con socios) · hito 5: 2/2 |
| `pnpm test:e2e` completa | CI del PR #8 | ver «CI del cierre» abajo |
| Lighthouse móvil de la portada | CI (job informativo) | en verde; los puntajes están en el resumen de la ejecución del CI |
| Imagen Docker (build y arranque) | CI | en verde en cada push |

Por la RAM del equipo (6,8 GB), la suite e2e completa corre solo en el CI del PR, que se abrió como borrador para
eso. En local corrieron las e2e de cada hito.

**CI del cierre:** _se completa al final de este documento._

## Imagen Docker y memoria

El CI construye la imagen y la arranca contra PostgreSQL en cada push (job «Imagen Docker»). **No la construí en
local:** quedan 9,3 GB libres y la regla es avisar antes de un `docker build` con menos de 10 GB. Por lo mismo,
falta la medición de memoria con `--memory=512m`. Lo regenerable que podría borrarse está en el reporte del PR.

## Dependencias nuevas

Ninguna. Turnstile se carga desde Cloudflare en el navegador (sin paquete), el CSV y el JSON se generan sin
librerías y el bloqueo del padrón es de PostgreSQL.

## Qué falta

- **PR 3b:** tienda, eventos (+ `.ics`), directiva y transparencia (subida de PDF), formativas, la cancha,
  donaciones, galería y videos, con sus criterios.
- Docker en local y la medición de memoria (falta espacio en disco; ver arriba).
- El contenedor `ops` que llama a `tick` y `daily` llega en la Fase 5. Hasta entonces las rutas existen y están
  probadas, pero nadie las llama en staging.
- Textos reales: política de privacidad, beneficios de socios y de auspicio, preguntas frecuentes y cuotas
  (`pnpm content:pending`).

## Desviaciones y ADRs

- **Route Handler para los formularios públicos** en vez de Server Actions (aprobado sin ADR). Una Server Action no
  puede responder un 429 ni funcionar sin JavaScript con PRG. El Route Handler verifica el `Origin` a mano: es la
  protección CSRF que las Server Actions traen de serie.
- **IP simulada en las e2e:** no se confía en un `CF-Connecting-IP` falso. Se usa una cabecera aparte,
  `x-e2e-client-ip`, que se acepta solo con `SITE_ENV=development` (así corre el CI). En staging y producción la
  IP siempre es la de Cloudflare. Hay pruebas que lo verifican.
- **Clics por día, no por enlace:** el plan decía «por día y por enlace», pero la especificación define
  `sponsor_clicks_daily` con PK `(sponsor_id, day)`. Manda la especificación: el reporte es por auspiciador y por
  día. Separar por enlace necesita una columna y otra PK (migración *expand/contract*). Si el club lo pide, va con su ADR.
- **El slug del auspiciador no cambia al renombrarlo** (a diferencia de noticias y jugadores, que dejan una 301).
  Es el enlace que cuenta los clics y ya pudo imprimirse o compartirse.

## Decisiones que tomé (defaults)

- RUT opcional en la solicitud de socio; celular y comuna obligatorios.
- Acuse de recibo al solicitante: sí, en los tres formularios.
- Retención de 12 meses: solicitudes cerradas (aprobada, rechazada, archivada) se anonimizan; mensajes de contacto
  y auditoría se eliminan. Las abiertas no se tocan. Los clics se conservan.
- Eliminar a una persona borra sus solicitudes y mensajes. En el padrón queda como «baja», sin nombre ni
  contacto, y su número sigue reservado.
- La auditoría de datos personales anota números, estados y conteos, nunca nombres, RUT ni contacto.
- «Aprobada» en socios solo llega con «Aprobar y dar de alta». Una aprobada solo puede quedar así o archivarse.
- Rubros regulados: nota en el formulario del auspiciador («sin alcohol ni apuestas junto a formativas»).
- La versión de la política es la fecha de su última edición en el panel.
- Un celular en E.164 sale en el CSV tal cual: un número puro no es fórmula para Excel. Todo lo demás que empiece
  con `= + - @` se neutraliza.

## Hallazgos corregidos en el camino

- **Hoja «Más» del celular (panel):** seguía abierta después de elegir un módulo y tapaba la pantalla. Ahora se
  cierra al navegar (`close-sheet-on-navigate.tsx`).
- **Listas del panel con datos viejos:** una mutación sin tags públicos (estado de un mensaje) no invalidaba lo
  que el navegador ya tenía precargado. Ahora `mutate()` llama a `refresh()` cuando no invalida ningún tag.
- **Filtros que conservaban una selección ajena:** React reutilizaba el `<select>` de la pantalla anterior; los
  filtros ahora llevan `key`.
- **Rastreadores y clics:** un buscador que siguiera los enlaces `/r/auspiciador/…` inflaría los clics. En
  producción, `robots.txt` ahora incluye `Disallow: /r/`, además del `X-Robots-Tag: noindex` de la ruta (e2e
  `seo.spec.ts`).
- **Jerarquía de títulos:** los bloques de preguntas y beneficios usaban `h2` dentro de una sección con `h2`;
  ahora son `h3`.

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

1. `http://localhost:3000/socios`: elige un plan, completa el formulario (RUT opcional) y envíalo. En Mailpit
   (`http://localhost:8025`) llegan el aviso a `socios@cachorros.test` y el acuse al solicitante.
2. Panel → Socios: abre la solicitud, responde por correo o WhatsApp, y «Aprobar y dar de alta». En Padrón aparece
   con su número; «Exportar CSV» descarga el padrón.
3. `http://localhost:3000/auspiciadores`: abre un enlace de un auspiciador. Panel → Auspiciadores → Reporte de
   clics muestra el clic de hoy.
4. Panel → Datos personales: busca `solicitante@cachorros.test`, exporta en JSON y elimina.
5. Tarea diaria (con el `CRON_SECRET` de tu `.env`):
   `Invoke-RestMethod http://localhost:3000/api/cron/daily -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }`

En local, el `.env` necesita `IP_HASH_SALT` (32 caracteres o más; el README trae el comando para generarlo).
**Lo completé en tu `.env` con un valor aleatorio**, porque ahora es obligatorio. Ese archivo no se versiona.

## Capturas

En `docs/fases/capturas/fase-3a/`, a 360 y 1280 px:

- Sitio: `socios`, `auspiciadores`, `contacto` y `privacidad`.
- Panel: `panel-socios-solicitudes`, `panel-socios-solicitud`, `panel-socios-padron`, `panel-socios-planes`,
  `panel-mensajes`, `panel-auspiciadores`, `panel-auspiciadores-reporte` y `panel-datos-personales`.

Se regeneran con:

```powershell
$env:CAPTURAS = 'fase-3a'
pnpm test:e2e capturas
Remove-Item Env:CAPTURAS
```

## Notas para la Fase 3b

- Un formulario o tabla nueva con datos de personas se agrega a `PERSONAL_DATA_SOURCES` y a `runRetention()`.
- La tienda no recolecta datos (el pedido es por WhatsApp), así que no entra en la retención.
- La subida de PDF debe validar la firma con `file-type` (dependencia a justificar en ese PR).
