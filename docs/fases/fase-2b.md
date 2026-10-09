# Fase 2b — Noticias, historia, configuración, usuarios y SEO · cierre de la Fase 2

- **Rama:** `fase-2b-contenido-y-sistema`
- **Fecha:** 9 de octubre de 2026
- **Alcance:** hitos 6 a 10 del plan de la Fase 2, más la página 404 con el encabezado y el pie del sitio. Con
  este PR se cierra la Fase 2 (la 2a está en [`fase-2a.md`](fase-2a.md)).

## Qué quedó hecho

| Hito | Entregable | Dónde |
|---|---|---|
| Previo | **Página 404 con la identidad del club** (encabezado, pie y barra inferior), también en las páginas de detalle que resuelve el proxy | `src/app/not-found.tsx`, `src/components/site/site-frame.tsx` |
| 6 | **Noticias.** Panel: editor de texto enriquecido, foto principal y fotos dentro del texto, videos, tipos, categorías, series, partido relacionado, destacada y fijada, SEO, dirección editable, autoguardado de borradores, vista previa, publicar / programar / archivar. Sitio: listado con filtros y paginación, detalle, compartir, RSS. Tarea `tick` | `src/features/news/`, `src/lib/rich-text/`, `/admin/noticias`, `/noticias`, `/api/cron/tick` |
| 7 | **Historia y textos de páginas.** Panel: línea de tiempo, títulos, salón de la fama y camisetas (con orden), y los cinco textos fijos. Sitio: `/historia` con relato y línea de tiempo (vertical en el celular, horizontal en escritorio, filtro por década, anclas por año), y sus tres subpáginas | `src/features/{history,pages}/`, `/admin/{historia,textos}`, `/historia/**` |
| 8 | **Configuración, usuarios y auditoría.** Ocho secciones de configuración; invitar, desactivar y cerrar sesiones de administradores; «Mi cuenta» con cambio de contraseña, sesiones y verificación en dos pasos (QR + enlace + clave + códigos de respaldo); «Actividad» con filtros | `src/features/{settings,users,audit}/`, `/admin/{configuracion,usuarios,cuenta,actividad}` |
| 9 | **SEO base.** Metadatos, canonical y Open Graph en runtime; JSON-LD del club, el sitio, las migas, la noticia y el partido; `sitemap.xml` y `robots.txt`; `noindex` fuera de producción | `src/features/seo/`, `src/app/{sitemap,robots}.ts` |
| 10 | **Inicio del panel** con lo que falta cargar, los partidos de hoy y hasta el domingo, accesos rápidos, noticias sin publicar y estado del sistema | `src/app/admin/(panel)/page.tsx` |

El panel suma 17 pantallas y el sitio 6 páginas que antes decían «Próximamente» (más RSS, sitemap y robots).
Una migración nueva: `0003_dos_pasos.sql` (tabla `two_factor` y columna `user.two_factor_enabled`; solo agrega).

## Criterios de aceptación de la Fase 2

| Criterio | Resultado | Evidencia |
|---|---|---|
| Prueba guiada con una persona no técnica: noticia con foto en ≤ 5 min y resultado completo en ≤ 3 min | **Pendiente (a tu cargo)** | El guion está en [`docs/pruebas-usabilidad.md`](../pruebas-usabilidad.md). Referencia: las e2e a 360 px hacen la noticia con foto en ≈ 22 s y el resultado en ≈ 25 s. Los resultados se anotan en «Prueba guiada», más abajo |
| Un cambio publicado en el panel se ve en el sitio en la siguiente carga | Cumple | e2e: noticia (portada, listado y detalle), corrección de título, hito de historia, relato de la historia, WhatsApp de Configuración, orden del salón de la fama; y lo deportivo de la 2a |
| La vista de estadísticas entrega los totales exactos | Cumple (2a) | `matches-actions.test.ts`, `stats-view.test.ts` |
| Marcador = suma de eventos de gol; W.O. y «por secretaría» manuales | Cumple (2a) | Integración con datos aleatorios |
| 30 fotos de 12 MP seguidas desde un celular | Cumple en las pruebas; **falta repetirlo en un celular real** | e2e a 360 px (2a). Memoria del contenedor: ver «Imagen Docker y memoria» |
| Menores: sin ficha, sin apellido ni fecha de nacimiento en ninguna página, DTO, **JSON-LD ni sitemap** | Cumple | 2a (páginas y DTO) + `seo.spec.ts`: ningún menor en el sitemap de ninguna de las dos instancias ni en el JSON-LD de plantel, partido y goleadores juveniles; `seo-sitemap.test.ts` (menor por edad, juvenil sin fecha, juvenil inscrito además en una serie adulta) |
| Con JavaScript deshabilitado, las páginas muestran su contenido y los filtros funcionan | Cumple | e2e sin JS: deporte (2a), noticias (listado, filtros, detalle), historia (relato, línea de tiempo, filtro por década, subpáginas) y los 404 |
| Sitemap y JSON-LD válidos; `robots.txt`, canonical y `og:url` cambian con `SITE_URL` usando la misma build | Cumple | `seo.spec.ts`: Playwright levanta **la misma build dos veces** (puertos 3100 y 3101, con distinto `SITE_URL` y `SITE_ENV`) y compara canonical, `og:url`, `robots.txt`, sitemap y JSON-LD en 10 páginas |

### Verificación

| Comando | Resultado |
|---|---|
| `pnpm check` | En verde |
| `pnpm test` | **190** pruebas en 20 archivos; cobertura de `src/features/*/lib` ≈ 99 % |
| `pnpm test:integration` | **141** pruebas en 17 archivos |
| `pnpm build` | En verde, también contra una base inexistente |
| `pnpm test:e2e` | **122** pruebas (61 por viewport), todas en verde y ninguna omitida, en ≈ 16 min |
| `pnpm lighthouse` (portada, móvil) | Accesibilidad, buenas prácticas y SEO sobre la meta. Rendimiento **59–67 en esta máquina** (ver «Lighthouse») |
| `pnpm audit --prod` | Sin vulnerabilidades conocidas |

## La página 404 (pedido adicional)

Se midió antes de construir el resto, sobre el build de producción:

| Petición | Estado | Encabezado y pie |
|---|---|---|
| `/no-existe` | 404 | Sí |
| `/partidos/no-existe`, `/noticias/no-existe`, `/jugadores/no-existe`, `/plantel/no-existe` | 404 | Sí |
| La ficha de un menor de edad | 404 | Sí |
| `/no-existe` con la base caída | 404 | Sí, con los datos de respaldo (nunca 500) |

Funcionó el plan A: el 404 de la raíz lee los datos del club en runtime y usa el mismo marco que el resto del
sitio; el estado lo fija el enrutador antes del render, así que no cambia. **El proxy no se tocó** y no hizo
falta un ADR. La respuesta llega en un solo bloque y se ve completa sin JavaScript. Costo: un 404 ya no es un
archivo estático; lee `getSite()`, que está cacheado por tags. Quedó anotado al final del ADR 0008.

## Lighthouse

| Categoría | Meta | Resultado local |
|---|---|---|
| Rendimiento | ≥ 90 | **59–67** (5 corridas) |
| Accesibilidad | ≥ 95 | Cumple |
| Buenas prácticas | ≥ 95 | Cumple |
| SEO | ≥ 95 | Cumple |

El rendimiento en esta máquina depende de su carga, igual que en la Fase 1 (ahí osciló entre 42 y 84 en local y
dio 94 en el CI): el tiempo de bloqueo fue de 1,1 a 1,7 s con el LCP en ≈ 3 s y solo 375 KB de página. **No lo
doy por cumplido:** el número que vale es el del job «Lighthouse móvil de la portada» del CI, que corre al abrir
el PR. Si ahí baja de 90, lo reviso antes de pedir la aprobación.

Un cambio en la medición: fuera de producción todo el sitio lleva `noindex` a propósito, y Lighthouse lo contaba
como una falla de SEO (69). La auditoría `is-crawlable` se excluye de `lighthouserc.cjs`; que producción sí se
deja indexar lo comprueba `seo.spec.ts`.

## Imagen Docker y memoria

Antes de construir había 16,6 GB libres en C: (sobre el umbral de 10 GB acordado), así que no hizo falta avisar.

`docker build` terminó sin acceso a la base. La imagen pesa **391 MB** (373 MB en la 2a; objetivo ≤ 250 MB en
la Fase 5). Con el límite de e2-micro (`--memory=512m`, heap de Node de 320 MB) y la base de desarrollo:

| Momento | Memoria del contenedor `app` |
|---|---|
| En reposo, recién iniciado | 69 MiB |
| **Máximo** durante 8 rondas de 60 peticiones simultáneas a 15 direcciones (portada, noticias, partidos, plantel, historia, sitemap, RSS, 404 y login) | **137 MiB** |
| Al terminar | 96 MiB |

Sin reinicios ni OOM, y sin errores en el log. Dentro del contenedor respondieron 200 las páginas nuevas y
`sitemap.xml`, `robots.txt` y `rss.xml`; `/no-existe` y `/partidos/no-existe` respondieron 404. Es una
comprobación de humo, no la prueba de carga de la sección 10 (esa es de la Fase 5). La imagen se borró después
de medir para no ocupar disco.

## Dependencias nuevas

| Paquete | Para qué | Justificación |
|---|---|---|
| `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image` 3.31.4 | Editor de noticias y de textos | **Del stack** (2.1). Solo se descarga en las pantallas con un campo de texto enriquecido: 126 KB comprimidos en un archivo aparte; el sitio público no lo carga |
| `uqr` 0.1.3 | Código QR de la verificación en dos pasos | **Fuera del stack** (aprobada al revisar el plan). Sin dependencias, licencia MIT, 27 KB, del proyecto UnJS. Se usa solo en el servidor: genera un SVG que viaja como imagen `data:`, sin pedir nada a terceros. La plataforma no trae un generador de QR y escribir uno propio (Reed-Solomon, máscaras) es más riesgo que una librería pequeña y probada |

Todas con más de 7 días de publicadas (`minimumReleaseAge`).

## Qué falta

1. **La prueba guiada** con una persona no técnica y **la subida de 30 fotos desde un celular real**.
2. **Abrir el PR.** No tengo `gh` en esta máquina: la rama está subida y el PR se abre desde
   <https://github.com/Felipe-Martinez-Contreras/web-cachorros/pull/new/fase-2b-contenido-y-sistema>. El CI solo
   corre con el PR abierto, así que **todavía no ha corrido sobre esta rama**.
3. **Noticias programadas sin intervención:** la tarea `tick` existe y está probada, pero quien la llama cada
   5 minutos es el contenedor `ops` de la Fase 5. Hasta entonces se dispara a mano (comando en el README).
4. **`X-Robots-Tag` en staging:** hoy van `<meta name="robots">` en cada página y un `robots.txt` que bloquea
   todo. La cabecera en todas las respuestas queda para el Caddyfile (Fase 5); está marcada `[VERIFICAR]`.
5. **`og:image`:** usa la foto de la noticia (o la imagen por defecto de Configuración) en WebP de ≈ 1.440 px. La
   especificación pide JPEG o PNG de hasta 300 KB: llega con las tarjetas generadas de la Fase 4.
6. **Tipo «galería»** y álbum de una noticia: se eligen entre los álbumes del seed; su panel es de la Fase 3.
7. Los textos de formativas, socios, donaciones y privacidad ya se editan; sus páginas son de la Fase 3.

## Desviaciones y ADRs

No hubo ADRs nuevos. Cambios respecto de lo literal de la especificación:

- **Tag de caché `pages`** para los textos de páginas (la lista de 3.4 no lo trae).
- **Lo que cambia la cookie de sesión no es una Server Action.** Activar o desactivar los dos pasos y verificar
  el código los hace el navegador contra `/api/auth`, porque Better Auth reemplaza la cookie. Se auditan en los
  *hooks* de `src/lib/auth/index.ts`. Invitar, desactivar, cambiar la contraseña y cerrar sesiones sí son
  Server Actions con el patrón de 3.5.
- **Las pantallas de acceso (`/admin/login` y las de contraseña) dejaron de prerenderizarse:** los metadatos del
  layout raíz dependen de `SITE_URL` en runtime y Next no permite metadatos dinámicos en una página estática.

## Decisiones que tomé (defaults)

Las diez del plan se aplicaron tal cual, con el cambio que pediste en la segunda (QR además del enlace y la
clave). Las que aparecieron al construir:

1. **Publicar toma lo último guardado.** El botón «Publicar ahora» lo dice en su confirmación; un borrador se
   guarda solo a los 4 segundos de dejar de escribir.
2. **La dirección de una noticia no cambia sola** al corregir el título: solo si se edita el campo.
3. **Volver a publicar conserva la fecha original** de una noticia que ya estuvo publicada.
4. **Una noticia publicada o programada no se elimina:** se archiva o se pasa a borrador primero.
5. **«Más noticias»** muestra primero las de la misma categoría y completa con las más recientes.
6. **Hitos sin fecha confirmada:** si el hito está «por confirmar» y solo se sabe el año, el sitio muestra «¿?» y
   «Fecha por confirmar» en vez del año provisional del seed.
7. **Salón de la fama sin enlace a la ficha del jugador** (la columna existe; el formulario no la ofrece todavía).
8. **Los marcadores `[COMPLETAR: …]` se aceptan en los formularios** de Configuración: el dato sigue en los
   pendientes en vez de perderse. Los datos bancarios se guardan completos o no se guardan.
9. **La auditoría no guarda valores sensibles:** de Configuración anota qué sección cambió, no los datos.
10. **`pnpm admin:create --restablecer` también quita los dos pasos:** es la salida de quien perdió el celular y
    los códigos de respaldo.
11. **No existe «el último administrador» que desactivar:** nadie puede desactivarse a sí mismo, así que siempre
    queda al menos uno activo.
12. **Inicio** muestra además los partidos de la última semana que quedaron sin resultado.
13. **Los datos estructurados omiten lo pendiente:** un `[COMPLETAR]` nunca sale en el JSON-LD.
14. **El sitemap lista solo las secciones ya construidas.**

## Hallazgos corregidos en el camino

- El editor se quedaba en «Cargando el editor…» al crearlo de forma diferida: ahora se crea en el primer render
  (ya se carga solo en el navegador).
- Los valores iniciales de un formulario estaban en un módulo de cliente y la página del servidor no podía
  leerlos («Algo salió mal» al abrir «Nuevo hito»).
- Una noticia sin otras de su categoría no mostraba «Más noticias».
- Los metadatos en runtime hacían fallar el build en las pantallas de acceso.
- Lighthouse marcaba como error de SEO el `noindex` intencional de los entornos que no son producción.
- La prueba de migraciones contaba 52 tablas; ahora son 53.

## Formularios: nada se pierde antes de que la pantalla esté lista

**El problema.** El HTML del panel llega antes que su JavaScript. En ese intervalo los campos ya se veían y se
podía escribir, pero el formulario todavía no los controlaba: al activarse reponía los valores guardados (lo
tecleado se perdía o quedaba pegado al valor anterior, como se vio en la e2e) y un «Enter» podía enviar el
formulario como uno nativo, por GET y sin validar (en el login, eso pondría la contraseña en la dirección). Afectaba a todos los formularios del panel.

**La solución: los campos esperan.** Todo formulario envuelve sus campos y botones en `<FormBody>`
(`src/components/admin/form-body.tsx`), un `<fieldset disabled>` con el aviso «Preparando el formulario…»
que se habilita cuando React termina de tomar el control. No existe un momento en que se pueda escribir algo
que después no se guarde, ni enviar antes de tiempo.

**Por qué esta y no «tomar del DOM lo ya escrito».** La evalué y la descarté porque no puede garantizar el
«nunca»:

- Solo sirve para campos simples. Las casillas controladas (series de una noticia), las filas de la tabla de
  posiciones y de la jornada, la nómina del resultado, el selector de imágenes y el editor de texto no tienen un
  valor en el DOM que se pueda rescatar: antes de la hidratación sus botones no hacen nada o quedan desalineados
  con el estado.
- No resuelve el envío nativo antes de tiempo.
- Depende de detalles internos de React y de react-hook-form (el orden en que cada uno escribe el valor del
  campo), que pueden cambiar con una actualización.
- En una pantalla de edición, el HTML del servidor trae los campos vacíos (react-hook-form los llena al
  activarse): la persona estaría escribiendo sobre un campo en blanco que en realidad tiene un valor.

Deshabilitar es una sola regla, igual para todos los formularios (el genérico `EntityForm`, jornada, tabla de
posiciones, medios y subida de fotos, carga de resultados completa, dos pasos y las tres pantallas de acceso), y
no depende de ninguna librería. El costo: en una red lenta la persona ve el formulario atenuado con el aviso
durante el instante que tarda en cargar, en vez de poder escribir de inmediato.

**La prueba** (`tests/e2e/formularios.spec.ts`, 360 px y 1280 px) retiene los scripts de la página para alargar
ese intervalo:

1. Con la hidratación retenida, los campos y «Guardar» están deshabilitados y se ve el aviso; aunque se toque
   el campo, se escriba y se pulse Enter, no entra nada y la página no se envía. Al soltarla, los campos traen
   los valores guardados, se escribe, se guarda y el dato queda.
2. Tres cargas completas seguidas escribiendo apenas se puede: lo guardado es exactamente lo tecleado.
3. Login, jornada, configuración, tabla de posiciones y «Mi cuenta» también esperan; la contraseña nunca viaja
   en la dirección.

Además, la e2e de noticias ya no espera a que el editor aparezca antes de escribir (era el parche que tapaba
este problema).

## Prueba guiada

_Pendiente. Completar con la tabla de [`docs/pruebas-usabilidad.md`](../pruebas-usabilidad.md)._

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm i
pnpm db:migrate
pnpm db:seed
pnpm dev
```

1. <http://localhost:3000/admin> → **Inicio**: accesos rápidos y partidos de la semana.
2. **Nueva noticia:** título, foto principal (súbela ahí mismo), texto → «Guardar borrador» → «Vista previa» →
   «Publicar ahora». Mírala en <http://localhost:3000> y en <http://localhost:3000/noticias>.
3. **Historia → Nuevo hito** y revisa <http://localhost:3000/historia>. Prueba el filtro por década.
4. **Textos de páginas → Historia · relato del club:** cambia el texto y recarga `/historia`.
5. **Configuración → Contacto y avisos:** cambia el WhatsApp y mira el pie del sitio.
6. **Usuarios → Invitar a un administrador:** el correo llega a Mailpit (<http://localhost:8025>).
7. **Mi cuenta → Activar los dos pasos:** escanea el QR con una app autenticadora, cierra sesión y vuelve a entrar.
8. **Actividad:** todo lo anterior quedó anotado.
9. <http://localhost:3000/sitemap.xml>, `/robots.txt`, `/noticias/rss.xml`.
10. Con JavaScript desactivado: <http://localhost:3000/partidos/no-existe> (404 con encabezado y pie),
    `/noticias` y `/historia`.

Verificación completa:

```powershell
pnpm check
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

## Capturas

| | 360 px | 1280 px |
|---|---|---|
| Página 404 | ![Página 404 a 360 px](capturas/fase-2b/pagina-404-360.png) | ![Página 404 a 1280 px](capturas/fase-2b/pagina-404-1280.png) |
| Noticias | ![Noticias a 360 px](capturas/fase-2b/noticias-360.png) | ![Noticias a 1280 px](capturas/fase-2b/noticias-1280.png) |
| Detalle de una noticia | ![Noticia a 360 px](capturas/fase-2b/noticia-detalle-360.png) | ![Noticia a 1280 px](capturas/fase-2b/noticia-detalle-1280.png) |
| Historia | ![Historia a 360 px](capturas/fase-2b/historia-360.png) | ![Historia a 1280 px](capturas/fase-2b/historia-1280.png) |
| Salón de la fama | ![Salón de la fama a 360 px](capturas/fase-2b/salon-de-la-fama-360.png) | ![Salón de la fama a 1280 px](capturas/fase-2b/salon-de-la-fama-1280.png) |
| Panel · Inicio | ![Inicio a 360 px](capturas/fase-2b/panel-inicio-360.png) | ![Inicio a 1280 px](capturas/fase-2b/panel-inicio-1280.png) |
| Panel · noticias | ![Panel de noticias a 360 px](capturas/fase-2b/panel-noticias-360.png) | ![Panel de noticias a 1280 px](capturas/fase-2b/panel-noticias-1280.png) |
| Panel · editor de una noticia | ![Editor a 360 px](capturas/fase-2b/panel-noticia-editor-360.png) | ![Editor a 1280 px](capturas/fase-2b/panel-noticia-editor-1280.png) |
| Panel · historia | ![Panel de historia a 360 px](capturas/fase-2b/panel-historia-360.png) | ![Panel de historia a 1280 px](capturas/fase-2b/panel-historia-1280.png) |
| Panel · textos de páginas | ![Textos a 360 px](capturas/fase-2b/panel-textos-360.png) | ![Textos a 1280 px](capturas/fase-2b/panel-textos-1280.png) |
| Panel · configuración | ![Configuración a 360 px](capturas/fase-2b/panel-configuracion-360.png) | ![Configuración a 1280 px](capturas/fase-2b/panel-configuracion-1280.png) |
| Panel · contacto y avisos | ![Contacto a 360 px](capturas/fase-2b/panel-configuracion-contacto-360.png) | ![Contacto a 1280 px](capturas/fase-2b/panel-configuracion-contacto-1280.png) |
| Panel · usuarios | ![Usuarios a 360 px](capturas/fase-2b/panel-usuarios-360.png) | ![Usuarios a 1280 px](capturas/fase-2b/panel-usuarios-1280.png) |
| Panel · mi cuenta | ![Mi cuenta a 360 px](capturas/fase-2b/panel-cuenta-360.png) | ![Mi cuenta a 1280 px](capturas/fase-2b/panel-cuenta-1280.png) |
| Panel · actividad | ![Actividad a 360 px](capturas/fase-2b/panel-actividad-360.png) | ![Actividad a 1280 px](capturas/fase-2b/panel-actividad-1280.png) |

En las capturas de página completa a 360 px la barra inferior aparece a media página: es un efecto de la captura
con elementos fijos, no del sitio.

Se regeneran con `$env:CAPTURAS = 'fase-2b'; pnpm test:e2e capturas`.

## Notas para la Fase 3

- Rama nueva desde `main` una vez aprobado este PR.
- Los formularios públicos (socios, auspicios, contacto) ya tienen dónde leer sus destinatarios:
  `site_settings.notify_recipients`, editable en Configuración → Contacto y avisos.
- `/contacto?tema=historia` ya está enlazado desde Historia.
- Los textos de formativas, socios, donaciones y privacidad se leen con `getPageBlock()` y se dibujan con
  `<RichText>`.
- `/api/cron/tick` ya existe: ahí se suma el reintento de notificaciones pendientes.
- Una sección pública nueva se agrega a `getSitemapEntries()` y, si tiene páginas de detalle, a `DETAIL_ROUTES`.
