#!/usr/bin/env bash
# Crea /opt/cachorros/.env (permisos 600) para la VM (especificación 12.11). Genera los secretos al azar y
# pregunta solo lo que es tuyo (dominio, claves de Turnstile, SMTP, bucket, clave pública de respaldos…).
# No sobrescribe un .env existente.
#   ./deploy/generar-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."
[[ -e .env ]] && { echo 'Ya existe .env: no se toca. Edítalo con «nano .env» si necesitas cambiar algo.' >&2; exit 1; }

ask() { # ask <variable> <pregunta> [valor por defecto]
  local answer
  read -r -p "$2${3:+ [$3]}: " answer
  printf -v "$1" '%s' "${answer:-${3:-}}"
}
secret() { openssl rand -hex "${1:-32}"; }

echo 'Datos del sitio (Enter acepta el valor entre corchetes):'
ask site_env 'Entorno (staging o production)' 'staging'
ask site_domain 'Dominio' 'cachorros.fmartinez.xyz'
ask ghcr 'Imágenes en GHCR (ghcr.io/<dueño del repositorio>)' 'ghcr.io/felipe-martinez-contreras'
ask turnstile_site 'Turnstile: clave del sitio'
ask turnstile_secret 'Turnstile: clave secreta'
ask smtp_host 'SMTP: servidor' 'smtp-relay.brevo.com'
ask smtp_user 'SMTP: usuario'
ask smtp_password 'SMTP: contraseña (clave SMTP de Brevo)'
ask mail_from 'Remitente' "Club Deportivo Los Cachorros <no-responder@${site_domain}>"
ask bucket 'Bucket de respaldos en Cloud Storage'
ask age_recipient 'Clave PÚBLICA de respaldos (age1…)'
ask analytics 'Token de Cloudflare Web Analytics (opcional)'
ask healthcheck 'URL de ping de healthchecks.io (opcional)'
two_factor=false
[[ "$site_env" == 'production' ]] && two_factor=true

[[ "$age_recipient" == age1* ]] || { echo 'La clave pública debe empezar con age1.' >&2; exit 1; }

pg_password=$(secret 24)
app_password=$(secret 24)

umask 077
cat >.env <<EOF
# Generado por deploy/generar-env.sh el $(date -u '+%Y-%m-%d'). Permisos 600; nunca al repositorio.

# General
SITE_ENV=${site_env}
SITE_URL=https://${site_domain}
SITE_DOMAIN=${site_domain}
GHCR_NAMESPACE=${ghcr}
APP_VERSION=
LOG_LEVEL=info

# Base de datos (hex: no hay que escapar nada en las URL)
POSTGRES_DB=cachorros
POSTGRES_USER=cachorros_admin
POSTGRES_PASSWORD=${pg_password}
DATABASE_ADMIN_URL=postgres://cachorros_admin:${pg_password}@db:5432/cachorros
DATABASE_URL=postgres://cachorros_app:${app_password}@db:5432/cachorros
DB_POOL_MAX=5

# Autenticación
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
AUTH_REQUIRE_2FA=${two_factor}

# Email (puerto 587: GCP bloquea el 25)
SMTP_HOST=${smtp_host}
SMTP_PORT=587
SMTP_USER=${smtp_user}
SMTP_PASSWORD=${smtp_password}
MAIL_FROM="${mail_from}"

# Anti-spam
TURNSTILE_SITE_KEY=${turnstile_site}
TURNSTILE_SECRET_KEY=${turnstile_secret}
IP_HASH_SALT=$(secret 32)

# Tareas internas
CRON_SECRET=$(secret 32)

# Analítica (opcional)
CF_WEB_ANALYTICS_TOKEN=${analytics}

# Medios
UPLOADS_DIR=/data/uploads
SHARE_CACHE_DIR=/data/cache/share
MAX_UPLOAD_MB=12

# Recursos — perfil e2-micro (e2-small: 768m · 512 · 384m · 128MB · 512MB)
APP_MEMORY_LIMIT=512m
APP_NODE_HEAP_MB=320
DB_MEMORY_LIMIT=256m
PG_SHARED_BUFFERS=64MB
PG_EFFECTIVE_CACHE_SIZE=256MB

# Respaldos
BACKUP_GCS_BUCKET=${bucket}
BACKUP_AGE_RECIPIENT=${age_recipient}
BACKUP_HEALTHCHECK_URL=${healthcheck}
EOF
chmod 600 .env
echo
echo '.env creado (permisos 600). Revísalo con «nano .env» antes del primer despliegue.'
