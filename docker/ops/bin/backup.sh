#!/bin/sh
# Respaldo diario (especificación 12.8):
#   1. pg_dump -Fc, verificado con pg_restore --list → /srv/ops/latest.dump (copia local sin cifrar).
#   2. Cifrado con la clave PÚBLICA del club (age); la privada nunca está en el servidor.
#   3. Subida a gcs:<bucket>/db/diario/AAAA-MM-DD.dump.age (y db/mensual/ el día 1), comprobando el hash.
#   4. rclone sync de las imágenes a uploads/, con lo borrado o reemplazado en uploads-historial/<fecha>/.
#   5. Registro en ops_runs y aviso al monitor de respaldos.
set -eu
# shellcheck source=SCRIPTDIR/../lib/common.sh
. /usr/local/lib/ops/common.sh

: "${BACKUP_GCS_BUCKET:?Falta BACKUP_GCS_BUCKET}"
: "${BACKUP_AGE_RECIPIENT:?Falta BACKUP_AGE_RECIPIENT (clave pública age1…)}"

started=$(now_iso)
day=$(date '+%Y-%m-%d')
remote="gcs:${BACKUP_GCS_BUCKET}"
work="${OPS_DIR}/trabajo"
step='inicio'

finish() {
  code=$?
  rm -rf "$work"
  [ "$code" -eq 0 ] && return 0
  message="El respaldo falló en el paso «${step}»."
  log "$message"
  record_run respaldo error "$started" "{\"paso\": \"$(json_string "$step")\"}" || true
  ping_monitor fail "$message"
}
trap finish EXIT

mkdir -p "$work"

step='volcado de la base'
log "Respaldo ${day}: volcando la base."
pg_dump -Fc -d "$DATABASE_ADMIN_URL" -f "${work}/cachorros.dump"
pg_restore --list "${work}/cachorros.dump" >/dev/null
counts=$(table_counts "$DATABASE_ADMIN_URL")
mv "${work}/cachorros.dump" "${OPS_DIR}/latest.dump"
printf '%s\n' "$counts" >"${OPS_DIR}/latest.counts.json"
dump_bytes=$(wc -c <"${OPS_DIR}/latest.dump" | tr -d ' ')

step='cifrado'
age -r "$BACKUP_AGE_RECIPIENT" -o "${work}/${day}.dump.age" "${OPS_DIR}/latest.dump"
encrypted_bytes=$(wc -c <"${work}/${day}.dump.age" | tr -d ' ')
local_md5=$(md5sum "${work}/${day}.dump.age" | cut -d ' ' -f 1)

upload() { # upload <ruta remota>
  rclone copyto "${work}/${day}.dump.age" "$1"
  remote_md5=$(rclone md5sum "$1" | cut -d ' ' -f 1)
  if [ "$remote_md5" != "$local_md5" ]; then
    log "La copia en ${1} no coincide con la local (${remote_md5} ≠ ${local_md5})."
    return 1
  fi
}

step='subida del volcado'
upload "${remote}/db/diario/${day}.dump.age"
monthly=false
if [ "$(date '+%d')" = '01' ]; then
  upload "${remote}/db/mensual/${day}.dump.age"
  monthly=true
fi

step='copia de las imágenes'
uploads=false
if [ -d "$UPLOADS_SOURCE" ]; then
  rclone sync "$UPLOADS_SOURCE" "${remote}/uploads" --backup-dir "${remote}/uploads-historial/${day}"
  uploads=true
fi

step='registro'
details=$(printf '{"dump_bytes": %s, "encrypted_bytes": %s, "counts": %s, "mensual": %s, "imagenes": %s}' \
  "$dump_bytes" "$encrypted_bytes" "$counts" "$monthly" "$uploads")
record_run respaldo ok "$started" "$details"
ping_monitor ok "Respaldo ${day}: ${encrypted_bytes} bytes cifrados."
log "Respaldo ${day} listo: ${dump_bytes} bytes (${encrypted_bytes} cifrados)."
