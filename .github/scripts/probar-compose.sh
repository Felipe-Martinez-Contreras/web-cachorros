#!/usr/bin/env bash
# Simula la VM en el CI (especificación 12.3 a 12.5): compose.yaml y el Caddyfile reales, con certificados de
# prueba firmados por una CA propia que hace de Origin CA y de CA de Authenticated Origin Pulls. Las imágenes
# son las del CI, etiquetadas como ci.local/cachorros-{web,ops}:ci-1 y :ci-2.
# Verifica: caddy validate, cabeceras de seguridad, AOP (sin certificado de cliente no entra), /media servido
# por Caddy, /api/cron cerrado desde afuera, tareas por la red interna, deploy.sh (ida, respaldo previo,
# rollback y vuelta automática ante una versión rota), persistencia de PostgreSQL 18 y restore.sh local.
set -euo pipefail

SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/stdout}
CERTS=deploy/certs
CLIENT=$PWD/cliente-ci
results=()
ok() { results+=("| $1 | ok |"); echo "ok: $1"; }
fail() {
  echo "FALLÓ: $*" >&2
  docker compose ps >&2 || true
  docker compose logs --tail 40 >&2 || true
  exit 1
}

# --- Certificados de prueba -------------------------------------------------------------------------------
mkdir -p "$CERTS" "$CLIENT"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj '/CN=CA de prueba' \
  -keyout "$CLIENT/ca.key" -out "$CLIENT/ca.pem" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj '/CN=localhost' -keyout "$CERTS/origin.key" -out "$CLIENT/origin.csr" 2>/dev/null
openssl x509 -req -in "$CLIENT/origin.csr" -CA "$CLIENT/ca.pem" -CAkey "$CLIENT/ca.key" -CAcreateserial -days 2 \
  -extfile <(printf 'subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth') -out "$CERTS/origin.pem" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj '/CN=Cloudflare de prueba' -keyout "$CLIENT/cliente.key" \
  -out "$CLIENT/cliente.csr" 2>/dev/null
openssl x509 -req -in "$CLIENT/cliente.csr" -CA "$CLIENT/ca.pem" -CAkey "$CLIENT/ca.key" -CAcreateserial -days 2 \
  -extfile <(printf 'extendedKeyUsage=clientAuth') -out "$CLIENT/cliente.pem" 2>/dev/null
cp "$CLIENT/ca.pem" "$CERTS/cloudflare-aop-ca.pem"
chmod 644 "$CERTS"/*

# --- .env de la «VM» ----------------------------------------------------------------------------------------
keys=$(docker run --rm ci.local/cachorros-ops:ci-1 age-keygen 2>&1)
public_key=$(printf '%s\n' "$keys" | sed -n 's/^# public key: //p' | head -n 1)
cat >.env <<EOF
SITE_ENV=staging
SITE_URL=https://localhost
SITE_DOMAIN=localhost
GHCR_NAMESPACE=ci.local
APP_VERSION=
POSTGRES_DB=cachorros
POSTGRES_USER=cachorros_admin
POSTGRES_PASSWORD=clave-admin-ci
DATABASE_ADMIN_URL=postgres://cachorros_admin:clave-admin-ci@db:5432/cachorros
DATABASE_URL=postgres://cachorros_app:clave-app-ci@db:5432/cachorros
BETTER_AUTH_SECRET=secreto-solo-para-ci-sin-valor-real-0123456789abcdef
SMTP_HOST=localhost
SMTP_PORT=587
MAIL_FROM=Club <no-responder@cachorros.test>
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
IP_HASH_SALT=sal-solo-para-ci-sin-valor-real-0123456789abcdef
CRON_SECRET=secreto-de-tareas-solo-para-ci-0123456789abcdef
UPLOADS_DIR=/data/uploads
SHARE_CACHE_DIR=/data/cache/share
RCLONE_CONFIG_GCS_TYPE=local
BACKUP_GCS_BUCKET=/srv/ops/bucket-ci
BACKUP_AGE_RECIPIENT=${public_key}
EOF
chmod 600 .env

docker compose config -q || fail 'docker compose config'
ok 'docker compose config'
docker run --rm -e SITE_DOMAIN=localhost -e SITE_ENV=staging \
  -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v "$PWD/deploy/cloudflare-trusted-proxies.caddy:/etc/caddy/cloudflare-trusted-proxies.caddy:ro" \
  -v "$PWD/$CERTS:/etc/caddy/certs:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile \
  || fail 'caddy validate'
ok 'caddy validate del Caddyfile real'

export DEPLOY_SKIP_PULL=1
export SMOKE_CURL_OPTS="--cacert $CLIENT/ca.pem --cert $CLIENT/cliente.pem --key $CLIENT/cliente.key"
site() { curl -sS --cacert "$CLIENT/ca.pem" --cert "$CLIENT/cliente.pem" --key "$CLIENT/cliente.key" "$@"; }

# --- Primer despliegue --------------------------------------------------------------------------------------
./deploy/deploy.sh ci-1 || fail 'deploy.sh ci-1'
ok 'Primer despliegue (migrate antes que la app, espera «healthy» y prueba por el dominio)'

# Datos de ejemplo (con imágenes en el volumen app_data).
docker compose run --rm app node scripts/seed.mjs >/dev/null || fail 'seed'

# --- Caddy: cabeceras, AOP, /media y /api/cron --------------------------------------------------------------
headers=$(site -D - -o /dev/null https://localhost/)
for header in 'x-content-type-options: nosniff' 'x-frame-options: DENY' \
  'referrer-policy: strict-origin-when-cross-origin' 'permissions-policy: camera=()' \
  'x-robots-tag: noindex, nofollow' 'content-security-policy'; do
  grep -qi "^${header}" <<<"$headers" || fail "falta la cabecera ${header}"
done
grep -qi '^server:' <<<"$headers" && fail 'Caddy no debe anunciar Server'
ok 'Cabeceras de seguridad y X-Robots-Tag en staging'

if curl -sS --cacert "$CLIENT/ca.pem" -o /dev/null https://localhost/ 2>/dev/null; then
  fail 'sin certificado de cliente (Authenticated Origin Pulls) no debería entrar'
fi
ok 'Sin el certificado de cliente de Cloudflare no se puede conectar (AOP)'

[[ "$(site -o /dev/null -w '%{http_code}' https://localhost/api/cron/tick)" == 404 ]] || fail '/api/cron abierto desde afuera'
ok '/api/cron/* responde 404 desde afuera'

media=$(docker compose exec -T db psql -U cachorros_admin -d cachorros -tAc \
  "select variants->'webp'->0->>'path' from media_assets where variants is not null limit 1")
media_headers=$(site -D - -o /dev/null "https://localhost/media/${media}")
grep -q '^HTTP/2 200' <<<"$media_headers" || fail "/media/${media} no responde 200"
grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$media_headers" || fail '/media sin caché inmutable'
ok '/media servido por Caddy desde el volumen, con caché inmutable'

docker compose exec -T ops cron-call.sh tick >/dev/null || fail 'cron-call.sh tick desde ops'
ok 'ops llama a /api/cron/tick por la red interna'

# --- Segundo despliegue (con respaldo previo), rollback y versión rota ----------------------------------------
./deploy/deploy.sh ci-2 || fail 'deploy.sh ci-2'
docker compose exec -T db psql -U cachorros_admin -d cachorros -tAc \
  "select count(*) from ops_runs where kind = 'respaldo' and status = 'ok'" | grep -q '^1$' || fail 'no hubo respaldo previo'
ok 'Segundo despliegue con respaldo previo registrado'

./deploy/deploy.sh rollback || fail 'deploy.sh rollback'
grep -q '^APP_VERSION=ci-1$' .env || fail 'el rollback no volvió a ci-1'
ok 'Rollback a la versión anterior'

if DEPLOY_SKIP_BACKUP=1 ./deploy/deploy.sh ci-no-existe; then fail 'una versión rota no debía quedar desplegada'; fi
grep -q '^APP_VERSION=ci-1$' .env || fail 'no volvió sola a ci-1 tras la versión rota'
[[ "$(site -o /dev/null -w '%{http_code}' https://localhost/api/health)" == 200 ]] || fail 'el sitio no quedó arriba'
ok 'Una versión rota vuelve sola a la anterior y el sitio sigue arriba'

# --- PostgreSQL 18: los datos sobreviven a recrear los contenedores (trampa 11) ------------------------------
name_before=$(docker compose exec -T db psql -U cachorros_admin -d cachorros -tAc 'select club_name from site_settings')
docker compose down
docker compose up -d --wait app
name_after=$(docker compose exec -T db psql -U cachorros_admin -d cachorros -tAc 'select club_name from site_settings')
[[ -n "$name_before" && "$name_before" == "$name_after" ]] || fail 'los datos no sobrevivieron a down/up'
ok 'Los datos de PostgreSQL 18 sobreviven a recrear los contenedores'

# --- Restauración local -------------------------------------------------------------------------------------
docker compose exec -T db psql -U cachorros_admin -d cachorros -c \
  "update site_settings set club_name = 'Cambio después del respaldo'" >/dev/null
printf 'si\n' | ./deploy/restore.sh local || fail 'restore.sh local'
[[ "$(docker compose exec -T db psql -U cachorros_admin -d cachorros -tAc 'select club_name from site_settings')" == "$name_before" ]] \
  || fail 'restore.sh local no devolvió los datos del respaldo'
ok 'restore.sh local devuelve la base al último respaldo y el sitio vuelve a responder'

{
  echo '### VM simulada con compose.yaml y el Caddyfile real'
  echo
  echo '| Prueba | Resultado |'
  echo '|---|---|'
  printf '%s\n' "${results[@]}"
  echo
  echo 'Memoria de cada servicio al terminar:'
  echo
  echo '```'
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'
  echo '```'
} >>"$SUMMARY"
docker compose down
