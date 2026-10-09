# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Fase 2b — Noticias, historia, configuración, usuarios y SEO

- Noticias: editor de texto enriquecido (Tiptap) con lista blanca de nodos, fotos de la biblioteca y videos
  detrás de una fachada; borradores con autoguardado, vista previa, programación, destacada, categorías y
  dirección editable con redirección 301. Sitio: listado con filtros y paginación, detalle, compartir y RSS.
- Tarea `tick` (`GET /api/cron/tick`) que publica las noticias programadas.
- Historia: línea de tiempo con filtro por década y anclas por año, títulos, salón de la fama y camisetas,
  administrados desde el panel. Textos de páginas editables.
- Configuración del club por secciones: contacto y avisos, redes, dirección y mapa, datos bancarios, portada,
  serie destacada y buscadores.
- Usuarios: invitar y desactivar administradores, cambiar la contraseña, cerrar sesiones y verificación en dos
  pasos (TOTP con código QR y códigos de respaldo; migración `0003`). «Actividad» muestra la auditoría con filtros.
- SEO base generado en runtime desde `SITE_URL`: canonical, Open Graph, JSON-LD (`SportsTeam`, `WebSite`,
  `BreadcrumbList`, `NewsArticle`, `SportsEvent`), `sitemap.xml` y `robots.txt`; `noindex` fuera de producción.
- Inicio del panel con los partidos de la semana, lo que falta por cargar y accesos rápidos.
- La página 404 lleva el encabezado y el pie del sitio, también en las páginas de detalle.

### Fase 2a — Panel deportivo y secciones de partidos y plantel

- Base del panel (shell móvil, listas, formulario genérico, avisos, confirmaciones) y biblioteca de medios.
- Catálogos deportivos, partidos y «Programar jornada», carga de resultados y tablas de posiciones.
- Sitio: Partidos (fixture, detalle, posiciones, goleadores, `.ics`), Plantel y fichas de jugadores, con la
  compuerta única para menores de edad.
- 404 y 301 reales en las páginas de detalle, resueltos en `proxy.ts` (ADR 0008).

### Fase 1 — Modelo de datos, seed, sistema de diseño y portada

- Modelo de datos completo (52 tablas): deporte, contenido, club y comunidad y biblioteca de medios, con sus
  restricciones y unicidades, y la vista de estadísticas `v_player_season_stats`.
- Reglas de dominio como lógica pura y probada: marcador derivado, tabla calculada, reloj del partido, cuenta
  regresiva en `America/Santiago` e `isMinor`. Formatos chilenos (fechas, CLP, teléfonos, RUT) y slugs.
- Núcleo del pipeline de imágenes con sharp (master, variantes WebP, LQIP, rasterizado de SVG) y `<ClubImage>`.
- `pnpm db:seed` (idempotente, determinista, con fechas relativas a hoy y opción `--en-vivo`) y
  `pnpm content:pending`, que regenera `docs/pendientes-contenido.md`.
- Sistema de diseño: tokens con el naranja del escudo y test de contraste, componentes base, de partidos y de
  contenido, íconos propios de fútbol y la página `/admin/sistema-de-diseno`.
- Layout público (encabezado, barra inferior con la hoja «Más», pie) y portada completa con los datos del seed,
  legible sin JavaScript; páginas «Próximamente» para las secciones que vienen.
- `pnpm lighthouse` para medir la portada en móvil.

### Fase 0 — Cimientos

- Proyecto Next.js 16 (App Router, Cache Components, `output: 'standalone'`) con TypeScript estricto y Tailwind v4.
- Calidad: Biome, lefthook, commitlint y Renovate (con antigüedad mínima de 7 días para nuevas versiones).
- Variables de entorno validadas al arrancar, con mensajes en español; logs en JSON con pino; `GET /api/health`.
- PostgreSQL 18 + Drizzle: primera migración (tablas de Better Auth, `audit_log`, `site_settings`, `ops_runs`) y
  rol restringido para la app.
- Panel: login, cierre de sesión y recuperación de contraseña por correo; layout `/admin` protegido; permisos en
  código; `pnpm admin:create`.
- Pruebas unitarias, de integración (PostgreSQL real) y e2e (Playwright + axe) a 360 px y 1280 px.
- `Dockerfile` multi-stage y CI en GitHub Actions (lint, tipos, pruebas, build sin base de datos, imagen).
- `AGENTS.md`, `CLAUDE.md`, ADRs 0001–0006 y README inicial.
