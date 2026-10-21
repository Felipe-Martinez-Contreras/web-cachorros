#!/usr/bin/env bash
# Despliegue en la VM (especificación 12.5). Se ejecuta en /opt/cachorros:
#   ./deploy/deploy.sh sha-1a2b3c4     # despliega esa versión de las imágenes publicadas en GHCR
#   ./deploy/deploy.sh rollback        # vuelve a la versión anterior que quedó funcionando
# Pasos: respaldo previo → APP_VERSION en .env → pull → up -d (migrate corre antes que la app) → espera
# «healthy» → prueba por el dominio público → registro en .deploy-history. Si la versión nueva no queda sana,
# vuelve sola a la anterior (las migraciones son expand/contract: la versión anterior sigue funcionando).
#
# Variables opcionales (las usa el CI): DEPLOY_SKIP_PULL=1, DEPLOY_SKIP_BACKUP=1, SMOKE_URL, SMOKE_CURL_OPTS.
set -euo pipefail

cd "$(dirname "$0")/.."
HISTORY=.deploy-history
ENV_FILE=.env

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || die "No existe $ENV_FILE. Créalo con ./deploy/generar-env.sh."
[[ $# -eq 1 ]] || die 'Uso: ./deploy/deploy.sh <versión>   o   ./deploy/deploy.sh rollback'

current_version() { sed -n 's/^APP_VERSION=//p' "$ENV_FILE" | tail -n 1; }
# Versiones que quedaron funcionando, de la más antigua a la más reciente.
ok_versions() { [[ -f "$HISTORY" ]] && awk '$3 == "ok" { print $2 }' "$HISTORY" || true; }

set_version() {
  if grep -q '^APP_VERSION=' "$ENV_FILE"; then
    sed -i "s/^APP_VERSION=.*/APP_VERSION=$1/" "$ENV_FILE"
  else
    printf 'APP_VERSION=%s\n' "$1" >>"$ENV_FILE"
  fi
}

record() { printf '%s %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" "$2" >>"$HISTORY"; }

app_health() {
  local id
  id=$(docker compose ps -q app)
  [[ -n "$id" ]] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$id"
}

wait_healthy() {
  for _ in $(seq 1 60); do
    [[ "$(app_health)" == 'healthy' ]] && return 0
    sleep 3
  done
  return 1
}

smoke_test() {
  local domain url
  domain=$(sed -n 's/^SITE_DOMAIN=//p' "$ENV_FILE" | tail -n 1)
  url=${SMOKE_URL:-https://${domain}/api/health}
  # shellcheck disable=SC2086 # SMOKE_CURL_OPTS son varias opciones a propósito.
  curl -fsS --max-time 15 --retry 5 --retry-delay 3 --retry-all-errors ${SMOKE_CURL_OPTS:-} "$url" >/dev/null
}

# Cada paso se verifica a mano: dentro de un `if`, `set -e` no corta la función ante un error.
start_version() { # start_version <versión>
  local namespace id
  set_version "$1"
  if [[ "${DEPLOY_SKIP_PULL:-}" != 1 ]]; then
    say "Descargando las imágenes $1"
    docker compose pull app migrate ops || return 1
  fi
  say 'Iniciando (las migraciones corren antes que la app)'
  docker compose up -d --remove-orphans || return 1
  # La app que responde debe ser la versión pedida, no un contenedor anterior que siguió corriendo.
  namespace=$(sed -n 's/^GHCR_NAMESPACE=//p' "$ENV_FILE" | tail -n 1)
  id=$(docker compose ps -q app)
  [[ -n "$id" && "$(docker inspect -f '{{.Config.Image}}' "$id")" == "${namespace}/cachorros-web:$1" ]] || return 1
  say 'Esperando que la app esté sana'
  wait_healthy && smoke_test
}

if [[ "$1" == 'rollback' ]]; then
  previous=$(ok_versions | awk -v current="$(current_version)" '$0 != current' | tail -n 1)
  [[ -n "$previous" ]] || die 'No hay una versión anterior registrada en .deploy-history.'
  target=$previous
else
  target=$1
  [[ "$target" =~ ^[A-Za-z0-9._-]+$ ]] || die "Versión no válida: $target"
fi
before=$(current_version)

if [[ "${DEPLOY_SKIP_BACKUP:-}" != 1 && -n "$(docker compose ps -q ops 2>/dev/null)" ]]; then
  say 'Respaldo previo de la base'
  docker compose exec -T ops backup.sh || die 'El respaldo previo falló: no se despliega. Revisa «docker compose logs ops».'
fi

if start_version "$target"; then
  record "$target" ok
  say "Listo: $target está funcionando."
  exit 0
fi

record "$target" error
docker compose logs --tail 50 app migrate >&2 || true
if [[ -n "$before" && "$before" != "$target" ]]; then
  say "La versión $target no quedó sana: volviendo a $before"
  start_version "$before" || die "Tampoco quedó sana la versión $before. Revisa «docker compose logs»."
  record "$before" ok
  die "$target falló y se volvió a $before."
fi
die "$target no quedó sana. Revisa «docker compose logs app»."
