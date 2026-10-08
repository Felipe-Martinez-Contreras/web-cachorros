# Fase 2a — Panel deportivo y secciones públicas de partidos y plantel · reporte parcial

- **Rama:** `fase-2a-panel-deportivo`
- **Fecha:** 8 de octubre de 2026
- **Alcance:** hitos 0 a 5 del plan de la Fase 2. La Fase 2 se cierra con el PR 2b (hitos 6 a 10: noticias,
  historia, textos de páginas, configuración, usuarios, auditoría, SEO base e Inicio del panel).

## Qué quedó hecho

| Hito | Entregable | Dónde |
|---|---|---|
| 0 | Medición del estado HTTP de las páginas de detalle y **ADR 0008 (propuesto)**; dependencias; permisos | `docs/adr/0008-…md`, `src/lib/permissions.ts` |
| 1 | Base del panel: shell móvil (barra inferior + hoja «Más», menú lateral en escritorio), avisos, confirmaciones, listas, formulario genérico, slugs con redirección | `src/components/admin/`, `src/lib/{entity-action,form-schemas,slug-redirects}.ts` |
| 2 | Biblioteca de medios: subida secuencial con redimensión en el navegador, validación por firma, cola de 1, texto alternativo obligatorio, punto focal, «contiene menores», dónde se usa y bloqueo de eliminación | `src/features/media/`, `src/app/api/admin/media/`, `/admin/medios` |
| 3 | Catálogos: series (orden con botones), temporadas (con copia de plantel y cuerpo técnico), competencias, rivales, canchas (ubicación desde un enlace de mapa), jugadores, inscripciones, estadísticas históricas, cuerpo técnico | `src/features/{series,teams,players,staff}/`, `/admin/{series,temporadas,competencias,rivales,canchas,jugadores,cuerpo-tecnico}` |
| 4 | Partidos: un partido y «Programar jornada»; postergar / suspender / cancelar; carga de resultado (nómina, goles, tarjetas, cambios, cierre); tabla de posiciones manual y calculada | `src/features/{matches,standings}/`, `/admin/{partidos,posiciones}` |
| 5 | Público: `/partidos` (fixture y resultados), `/partidos/[slug]`, `/partidos/posiciones`, `/partidos/goleadores`, `.ics` por partido, `/plantel/[serie]`, `/jugadores/[slug]`; compuerta única de menores | `src/app/(public)/{partidos,plantel,jugadores}/`, `src/features/players/public.ts`, `src/app/api/ics/` |

El panel suma 31 pantallas nuevas; el sitio, 7 páginas que antes decían «Próximamente».

## Criterios de aceptación de la Fase 2 (los que tocan a la 2a)

| Criterio | Resultado | Evidencia |
|---|---|---|
| Cargar un resultado completo en ≤ 3 min | **Parcial** | La e2e a 360 px programa el partido, copia la nómina, registra 3 goles y 1 tarjeta y finaliza en **≈ 25 s**. Falta la prueba guiada con una persona (queda a tu cargo; el guion `docs/pruebas-usabilidad.md` se entrega en la 2b junto con la de noticias) |
| Un cambio del panel se ve en el sitio en la siguiente carga | Cumple (deporte) | e2e: el resultado recién cargado aparece en la portada; al corregirlo cambia; un juvenil inscrito en Honor desde el panel aparece en `/plantel/honor`. Noticias: 2b |
| La vista de estadísticas entrega los totales exactos, suma ajustes y excluye partidos no finalizados | Cumple | `tests/integration/matches-actions.test.ts` (de punta a punta por las acciones) y `stats-view.test.ts` |
| Marcador = suma de eventos de gol (datos aleatorios); W.O. y «por secretaría» con marcador manual | Cumple | 40 altas y bajas al azar con el marcador verificado en cada paso; W.O. → secretaría → normal → penales |
| 30 fotos de 12 MP seguidas desde un celular | **Parcial** | e2e a 360 px: 30 fotos de 4000 × 3000 con ruido (varios MB cada una), reducidas en el navegador a 2560 px, subidas de a una, sin EXIF/GPS (integración), `alt` obligatorio. La memoria del contenedor: ver «Memoria» abajo. Falta repetirlo en un celular real |
| Menores: sin ficha, sin apellido ni fecha de nacimiento en ninguna página ni DTO | Cumple (páginas y DTO) | Integración sobre los DTO serializados y e2e que busca «nombre apellido» en el HTML completo, incluido un juvenil inscrito en una serie adulta. JSON-LD y sitemap: 2b |
| Con JavaScript deshabilitado, las páginas muestran su contenido y los filtros funcionan | Cumple (deporte) | e2e sin JS: fixture, cambio de serie y de temporada, posiciones, goleadores, detalle, plantel y ficha |
| Sitemap, JSON-LD, robots, canonical con `SITE_URL` en runtime | 2b | Hito 9 |

Totales: **135** pruebas unitarias (cobertura de `src/features/*/lib` ≈ 98 %), **100** de integración y **66** e2e
(33 por viewport), todas en verde y ninguna omitida. `pnpm check` y `pnpm build` en verde; el build se verificó
además apuntando a una base inexistente. `pnpm audit --prod` sin vulnerabilidades conocidas. **El CI todavía no
ha corrido sobre esta rama** (necesita el PR abierto).

## Memoria

Medido sobre la imagen Docker de esta rama, con el límite de e2-micro (`--memory=512m`, heap de Node 320 MB) y
la base de desarrollo:

| Momento | Memoria del contenedor `app` |
|---|---|
| En reposo, recién iniciado | 64 MiB |
| **Máximo** durante 30 subidas seguidas de 2560 px (lo que envía el navegador) y 5 originales de 12 MP sin reducir | **154 MiB** |
| Al terminar | 90 MiB |

Las 35 subidas respondieron 201, sin reinicios ni OOM (69 muestras de `docker stats`). Queda un 70 % de margen
bajo el límite. Las subidas se hicieron con `curl` contra el contenedor; el recorrido completo desde el navegador
a 360 px lo cubre la e2e (contra el build, fuera de Docker).

La imagen pesa **373 MB** (323 MB en la Fase 1; objetivo ≤ 250 MB en la Fase 5).

La construcción de la imagen destapó un defecto que el build local no mostraba: las páginas públicas nuevas
consultaban la base durante `next build` (trampa 2). Quedó corregido y verificado compilando contra una base
inexistente; el CI lo habría detenido en el PR.

## Qué falta

1. **Aprobar o rechazar el ADR 0008.** Mientras tanto, una dirección de detalle inexistente (o la ficha de un menor)
   muestra la página 404 del club pero responde **200 con `noindex`**, y un slug antiguo redirige con
   `<meta refresh>` en vez de 301. La e2e lo deja escrito así; con el ADR aprobado el cambio queda acotado a `proxy.ts` y a una función por dominio.
2. La prueba guiada con una persona no técnica y la subida desde un celular real (por la red local).
3. Fase 2b: noticias, historia, textos de páginas, configuración completa, usuarios y 2FA, auditoría, SEO base,
   Inicio del panel (hoy sigue siendo el de la Fase 0, con el menú nuevo).
4. La edición de un evento ya registrado es «eliminar y volver a registrar» (la edición en línea llega con la
   consola en vivo, Fase 4).

## Desviaciones y ADRs

- **[ADR 0008](../adr/0008-estado-http-en-paginas-de-detalle.md) — propuesto, sin aplicar.** Medido sobre el build:
  con el ADR 0007 una página de detalle no puede responder 404 ni 301. Propongo resolver el slug en `proxy.ts`.
- **Migración `0003` y Tiptap se mueven a la 2b.** La tabla `two_factor` es del hito 8 y el editor del hito 6: no
  tenía sentido agregarlos en este PR. La 2a no trae migraciones.
- **El CI no corre con solo subir la rama** (el workflow se dispara con `pull_request` o con push a `main`).
  Hace falta abrir el PR para que cada push lo ejecute.

## Decisiones que tomé (defaults)

1. **Un patrón común para las mutaciones** (`mutate()`): los seis pasos de la sección 3.5 en un solo lugar.
2. **Texto alternativo por tanda** al subir varias fotos: una descripción para todas, editable foto por foto
   después. Pedir 30 descripciones antes de subir haría inviable la meta de uso en la cancha.
3. **Imagen «contiene menores»:** no se puede asignar a nada visible, y una imagen en uso no se puede marcar
   (se valida al escribir, no al leer). Los menores usan la silueta en el plantel.
4. **Slug automático** desde el nombre en series, rivales, jugadores y partidos; al cambiar queda la redirección.
5. **Jugador nuevo con inscripción inmediata** en la temporada actual (un paso menos).
6. **Quien participa en un evento queda en la nómina** como «jugó» (si no, tendría goles sin partidos jugados).
7. **El período se deduce del minuto** y de la duración del tiempo de la serie al cargar después del partido.
8. **Cambiar equipos o serie** de un partido con nómina o eventos está bloqueado; un partido con resultado no se
   elimina (se cancela o se corrige).
9. **Copiar plantel** no copia las bajas y no pisa lo ya inscrito (se puede repetir).
10. **Tabla calculada:** en la grilla solo se guardan el ajuste de puntos y la posición manual por equipo.
11. **Goleadores:** a igual cantidad de goles comparten posición; se listan primero quienes los hicieron en menos
    partidos.
12. **`.ics`:** duración = dos tiempos de la serie + 20 min; `SEQUENCE` = `share_version`.
13. **Parámetro `?temporada=`** es el año (`2026`), no un id.
14. **Seed:** ahora reemplaza las filas de sus tablas de posiciones (fallaba al repetirse después de guardar una
    tabla desde el panel).
15. **Pruebas e2e:** lo que crean se limpia al inicio de la corrida siguiente (`scripts/e2e-clean.ts`).

## Hallazgos corregidos en el camino

- SVG con declaración `<?xml …?>` rechazados por la validación de firma (los exporta así la mayoría de los
  programas).
- `ON DELETE RESTRICT` responde con el código 23001, no 23503: el mensaje «tiene datos asociados» no aparecía.
- Un rechazo por campo se mostraba dos veces (arriba y junto al campo).
- La vista previa de la tabla del panel no se alcanzaba con teclado (axe *serious*).
- Tablas públicas anchas ensanchaban la página a 360 px.
- Las páginas públicas nuevas consultaban la base durante el build (lo mostró `docker build`).
- Un apellido largo sin espacios ensanchaba la página del plantel a 360 px.
- El fallo al procesar una imagen subida no dejaba la causa en el log.
- El build rastreaba todo el proyecto por la carpeta de subidas (el output standalone bajó de 84 a 74 MB).
- `crypto.randomUUID` no existe por HTTP en la red local: la carga de eventos fallaría en la prueba con celular.
- Una expresión regular de la e2e de la portada no aceptaba días con tilde («sábado»).

## Cómo probarlo

```powershell
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm db:seed
pnpm admin:create
pnpm dev
```

1. <http://localhost:3000/admin> → menú nuevo (en el celular: barra inferior y «Más»).
2. **Partidos → Programar jornada:** rival, día, marca Honor y Segunda → «Programar 2 partidos».
3. **Partidos → Cargar resultado** de un partido: «Usar nómina del partido anterior», «Gol nuestro», «Gol rival»,
   «Finalizar partido». Abre <http://localhost:3000> y <http://localhost:3000/partidos>: ya está.
4. **Posiciones → Segunda:** cambia un PG y guarda; revisa <http://localhost:3000/partidos/posiciones?serie=segunda>.
5. **Jugadores → Nuevo jugador** inscrito en Honor → <http://localhost:3000/plantel/honor>.
6. **Medios → Subir fotos:** varias fotos del celular de una vez.
7. <http://localhost:3000/plantel/juvenil>: nombres con inicial y sin enlaces.
8. Desactiva JavaScript y recorre <http://localhost:3000/partidos>.

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
| Partidos (fixture y resultados) | ![Partidos (fixture y resultados) a 360 px](capturas/fase-2a/partidos-360.png) | ![Partidos (fixture y resultados) a 1280 px](capturas/fase-2a/partidos-1280.png) |
| Detalle de un partido | ![Detalle de un partido a 360 px](capturas/fase-2a/partido-detalle-360.png) | ![Detalle de un partido a 1280 px](capturas/fase-2a/partido-detalle-1280.png) |
| Tabla de posiciones | ![Tabla de posiciones a 360 px](capturas/fase-2a/posiciones-360.png) | ![Tabla de posiciones a 1280 px](capturas/fase-2a/posiciones-1280.png) |
| Goleadores | ![Goleadores a 360 px](capturas/fase-2a/goleadores-360.png) | ![Goleadores a 1280 px](capturas/fase-2a/goleadores-1280.png) |
| Plantel | ![Plantel a 360 px](capturas/fase-2a/plantel-360.png) | ![Plantel a 1280 px](capturas/fase-2a/plantel-1280.png) |
| Plantel juvenil (menores) | ![Plantel juvenil (menores) a 360 px](capturas/fase-2a/plantel-juvenil-360.png) | ![Plantel juvenil (menores) a 1280 px](capturas/fase-2a/plantel-juvenil-1280.png) |
| Ficha de un jugador | ![Ficha de un jugador a 360 px](capturas/fase-2a/jugador-360.png) | ![Ficha de un jugador a 1280 px](capturas/fase-2a/jugador-1280.png) |
| Panel · partidos | ![Panel · partidos a 360 px](capturas/fase-2a/panel-partidos-360.png) | ![Panel · partidos a 1280 px](capturas/fase-2a/panel-partidos-1280.png) |
| Panel · programar jornada | ![Panel · programar jornada a 360 px](capturas/fase-2a/panel-jornada-360.png) | ![Panel · programar jornada a 1280 px](capturas/fase-2a/panel-jornada-1280.png) |
| Panel · cargar resultado | ![Panel · cargar resultado a 360 px](capturas/fase-2a/panel-resultado-360.png) | ![Panel · cargar resultado a 1280 px](capturas/fase-2a/panel-resultado-1280.png) |
| Panel · tablas | ![Panel · tablas a 360 px](capturas/fase-2a/panel-posiciones-360.png) | ![Panel · tablas a 1280 px](capturas/fase-2a/panel-posiciones-1280.png) |
| Panel · editar una tabla | ![Panel · editar una tabla a 360 px](capturas/fase-2a/panel-tabla-360.png) | ![Panel · editar una tabla a 1280 px](capturas/fase-2a/panel-tabla-1280.png) |
| Panel · jugadores | ![Panel · jugadores a 360 px](capturas/fase-2a/panel-jugadores-360.png) | ![Panel · jugadores a 1280 px](capturas/fase-2a/panel-jugadores-1280.png) |
| Panel · series | ![Panel · series a 360 px](capturas/fase-2a/panel-series-360.png) | ![Panel · series a 1280 px](capturas/fase-2a/panel-series-1280.png) |
| Panel · rivales | ![Panel · rivales a 360 px](capturas/fase-2a/panel-rivales-360.png) | ![Panel · rivales a 1280 px](capturas/fase-2a/panel-rivales-1280.png) |
| Panel · biblioteca de medios | ![Panel · biblioteca de medios a 360 px](capturas/fase-2a/panel-medios-360.png) | ![Panel · biblioteca de medios a 1280 px](capturas/fase-2a/panel-medios-1280.png) |
| Panel · menú «Más» en el celular | ![Menú del panel a 360 px](capturas/fase-2a/panel-menu-360.png) | — |

En las capturas de página completa a 360 px la barra inferior aparece a media página: es un efecto de la
captura con elementos fijos, no del sitio.

Se regeneran con `$env:CAPTURAS = 'fase-2a'; pnpm test:e2e capturas`.

## Notas para la Fase 2b

- Rama nueva desde `main` una vez aprobado este PR.
- El editor de noticias reutiliza `EntityForm`, `MediaPicker` y `mutate()`; `SlugEntity` ya incluye `news`.
- `getSportsNav()` y `loadMinorIds()` son las fuentes para el sitemap y el JSON-LD.
- Inicio del panel: `listClubMatchesBetween()` ya entrega los partidos de hoy y del fin de semana.
