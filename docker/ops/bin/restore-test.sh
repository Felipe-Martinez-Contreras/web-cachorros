#!/bin/sh
# Prueba de restauración semanal (especificación 12.8): restaura /srv/ops/latest.dump en una base temporal,
# compara los conteos de filas con los registrados al respaldar, borra la base temporal y deja el resultado
# en ops_runs. La legibilidad de las copias cifradas en GCS se prueba en el simulacro trimestral.
set -eu
# shellcheck source=SCRIPTDIR/../lib/common.sh
. /usr/local/lib/ops/common.sh

started=$(now_iso)
temp_db='cachorros_prueba_restauracion'
temp_url=$(url_with_db "$DATABASE_ADMIN_URL" "$temp_db")
step='inicio'

drop_temp() {
  psql "$DATABASE_ADMIN_URL" -q -c "drop database if exists ${temp_db} with (force)" >/dev/null 2>&1 || true
}

finish() {
  code=$?
  drop_temp
  [ "$code" -eq 0 ] && return 0
  log "La prueba de restauración falló en el paso «${step}»."
  record_run prueba_restauracion error "$started" "{\"paso\": \"$(json_string "$step")\"}" || true
}
trap finish EXIT

step='buscar el último respaldo'
[ -s "${OPS_DIR}/latest.dump" ] && [ -s "${OPS_DIR}/latest.counts.json" ] || {
  log 'No hay un respaldo local para probar.'
  exit 1
}
expected=$(cat "${OPS_DIR}/latest.counts.json")

step='crear la base temporal'
drop_temp
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "create database ${temp_db}"

step='restaurar'
pg_restore --no-owner --no-acl --exit-on-error -d "$temp_url" "${OPS_DIR}/latest.dump"

step='comparar conteos'
actual=$(table_counts "$temp_url")
if [ "$actual" != "$expected" ]; then
  log "Los conteos no coinciden. Esperado: ${expected} · Restaurado: ${actual}"
  exit 1
fi

step='registro'
record_run prueba_restauracion ok "$started" "{\"counts\": ${actual}}"
log 'Prueba de restauración correcta: los conteos coinciden.'
