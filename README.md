# Club Deportivo Los Cachorros — sitio web

Sitio web (propuesta de web oficial) del **Club Deportivo Los Cachorros**, club de fútbol amateur ANFA fundado el
1 de abril de 1934 en Sagrada Familia, Región del Maule, Chile. Incluye el sitio público y un panel de
administración propio, pensado para usarse desde el celular.

- **Especificación (fuente de verdad):** [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md)
- **Reglas para quien programe (personas o agentes):** [`AGENTS.md`](AGENTS.md)
- **Decisiones de arquitectura:** [`docs/adr/`](docs/adr/)
- **Avance por fases:** [`docs/fases/`](docs/fases/)

> **Estado:** Fase 2a (panel deportivo y secciones de partidos y plantel). Ya funcionan la portada, el panel
> para programar partidos, cargar resultados, tablas, plantel y medios, y las páginas públicas de Partidos y
> Plantel. Noticias, historia, configuración y SEO llegan en la Fase 2b; el resto, en las fases siguientes.

## Qué necesitas

| Herramienta | Versión | Cómo instalarla en Windows |
|---|---|---|
| Node.js | 24 LTS | `winget install OpenJS.NodeJS.LTS` |
| pnpm | la que fija `package.json` | `corepack enable` (viene con Node) |
| Docker Desktop | reciente, con WSL 2 | `winget install Docker.DockerDesktop` |
| Git | reciente | `winget install Git.Git` |

Los comandos de este README están escritos para **PowerShell**, uno por línea. En Linux o macOS son los mismos.

## Correr el proyecto en tu computador

Desde un clon limpio toma menos de 15 minutos.

```powershell
# 1. Dependencias
corepack enable
pnpm i

# 2. Variables de entorno: copia el ejemplo (ya trae los valores para desarrollo local)
Copy-Item .env.example .env
```

Genera el secreto de autenticación y pégalo en `.env`, en la línea `BETTER_AUTH_SECRET=`:

```powershell
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

(En Linux o macOS: `openssl rand -base64 32`.)

```powershell
# 3. Base de datos (PostgreSQL 18) y bandeja de correo de pruebas (Mailpit)
docker compose -f compose.dev.yaml up -d

# 4. Crear las tablas
pnpm db:migrate

# 5. Cargar los datos de ejemplo (partidos, noticias, imágenes…). Tarda cerca de medio minuto
pnpm db:seed

# 6. Crear tu usuario administrador (te pregunta nombre, correo y contraseña de 12+ caracteres)
pnpm admin:create

# 7. Levantar el sitio
pnpm dev
```

Listo:

| Qué | Dónde |
|---|---|
| Sitio | <http://localhost:3000> |
| Panel | <http://localhost:3000/admin> |
| Correos de prueba (Mailpit) | <http://localhost:8025> |
| Estado del servicio | <http://localhost:3000/api/health> |

En desarrollo no se envía ningún correo real: todos quedan en Mailpit. Ahí llega, por ejemplo, el enlace de
«Olvidé mi contraseña».

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción (no necesita base de datos) |
| `pnpm start` | Arranca el build de producción en local |
| `pnpm check` | Revisa formato, lint y tipos (Biome + TypeScript) |
| `pnpm check:fix` | Corrige formato y lint automáticamente |
| `pnpm test` | Pruebas unitarias |
| `pnpm test:integration` | Pruebas contra PostgreSQL real (usa una base aparte, `cachorros_test`) |
| `pnpm test:e2e` | Pruebas de navegador a 360 px y 1280 px contra el build (puerto 3100). Requiere `pnpm build` antes |
| `pnpm db:generate` | Genera una migración SQL a partir de los cambios en `src/db/schema` |
| `pnpm db:migrate` | Aplica las migraciones pendientes |
| `pnpm db:seed` | Carga los datos de ejemplo. Se puede repetir: no duplica nada |
| `pnpm db:seed --en-vivo` | Lo mismo, dejando un partido de Honor en curso para ver la franja EN VIVO |
| `pnpm db:reset` | **Borra todo** (base e imágenes procesadas) y recrea la base (solo desarrollo) |
| `pnpm content:pending` | Lista lo que falta completar y regenera `docs/pendientes-contenido.md` |
| `pnpm lighthouse` | Mide la portada con Lighthouse móvil (puerto 3210). Requiere `pnpm build` y el seed cargado |
| `pnpm admin:create` | Crea un administrador |
| `pnpm admin:create --restablecer` | Cambia la contraseña de un administrador que ya existe |
| `pnpm build:scripts` | Empaqueta los scripts de consola para la imagen Docker |

La primera vez que corras las pruebas de navegador instala Chromium: `pnpm exec playwright install chromium`.

## Variables de entorno

Todas están explicadas en [`.env.example`](.env.example). Las que la app exige hoy para arrancar:

| Variable | Para qué |
|---|---|
| `SITE_ENV` | `development`, `staging` o `production` |
| `SITE_URL` | URL pública del sitio |
| `DATABASE_URL` | Conexión de la app (rol restringido `cachorros_app`) |
| `DATABASE_ADMIN_URL` | Conexión de administración: solo la usan las migraciones |
| `BETTER_AUTH_SECRET` | Secreto de las sesiones (32+ caracteres) |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | Envío de correos |

Si falta alguna o tiene un formato incorrecto, **la app no arranca** y dice en español cuál revisar.

Los datos del club (WhatsApp, redes, datos bancarios, dirección) **no** van en `.env`: se editan en el panel.

## Crear o restablecer un administrador

No existe registro público. Las cuentas se crean desde la consola:

```powershell
pnpm admin:create
```

Si la persona olvidó su contraseña y no le llega el correo de recuperación:

```powershell
pnpm admin:create --restablecer
```

Para automatizarlo (sin preguntas), define `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de correrlo.

## Imagen Docker

La imagen se construye sin base de datos ni variables de entorno, y la misma sirve para staging y producción.

```powershell
docker build -t cachorros-web:local .
```

Dentro de la imagen quedan los scripts `node scripts/migrate.mjs`, `node scripts/create-admin.mjs`,
`node scripts/seed.mjs` y `node scripts/content-pending.mjs`.
El despliegue completo (VM, Caddy, Cloudflare, respaldos) se documenta en la Fase 5.

## Datos de ejemplo

`pnpm db:seed` deja el sitio como una demo completa: 8 series, 11 rivales **ficticios**, planteles, 11 fechas por
serie (unas 7 jugadas y 4 por jugar), tablas, noticias, eventos, tienda, auspiciadores y directiva de ejemplo.

- Las fechas son **relativas a hoy**: la demo siempre tiene partidos jugados y por jugar. Para fijar el día,
  `pnpm db:seed --hoy=2026-10-10`.
- Es idempotente: correrlo de nuevo actualiza los mismos datos y vuelve a procesar las imágenes.
- No inventa datos del club: lo que no está confirmado queda como `[COMPLETAR: …]` y aparece en
  `docs/pendientes-contenido.md` (`pnpm content:pending`).
- En producción se niega a correr si la base ya tiene contenido.
- Con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` crea además un administrador de demostración.
- En staging: `docker compose run --rm app node scripts/seed.mjs`.

Para empezar de cero en desarrollo:

```powershell
pnpm db:reset
pnpm db:seed
pnpm admin:create
```

### Reemplazar el escudo y las fotos de ejemplo

Deja los archivos del club en [`public/placeholder/`](public/placeholder/README.md) (`escudo.svg` o `escudo.png`,
`hero.jpg` y, opcional, `hero-movil.jpg`) y vuelve a correr `pnpm db:seed`. Si no están, el seed usa un escudo
genérico y una imagen de ejemplo. El resto de las imágenes se reemplazará desde el panel (Fase 2).

Las imágenes procesadas quedan en `data/uploads/` (fuera del repositorio). En desarrollo las sirve la propia app
en `/media/…`; en staging y producción las sirve Caddy y esa ruta de la app responde 404.

## Despliegue, respaldos y cambio de dominio

Todavía no existen: llegan con la Fase 5 (producción). Este README se completa en cada fase.

## Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| `La configuración no es válida. Revisa estas variables…` | Falta o está mal una variable en `.env`. El mensaje dice cuál. |
| `pnpm db:migrate` no conecta | Revisa que Docker Desktop esté abierto y corre `docker compose -f compose.dev.yaml up -d`. |
| `ports are not available … 5439` | Otro programa usa ese puerto. Cambia `5439` en `compose.dev.yaml` y en las dos URLs de `.env`. |
| No llega el correo de recuperación | En local los correos quedan en <http://localhost:8025>, no en tu casilla. |
| `pnpm` no se reconoce | Corre `corepack enable` y abre una terminal nueva. |
| pnpm rechaza instalar una versión «demasiado nueva» | Es a propósito: no se instalan versiones publicadas hace menos de 7 días (`pnpm-workspace.yaml`). |
| `docker build` falla descargando la fuente | El build necesita internet: `next/font` descarga la tipografía Archivo al compilar. |
| Las pruebas e2e no parten | Corre `pnpm build` antes de `pnpm test:e2e`. |
