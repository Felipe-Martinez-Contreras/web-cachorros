#!/bin/sh
# Restauración real (especificación 12.8). La orquesta deploy/restore.sh desde la VM con la app detenida:
#   restore-run.sh <AAAA-MM-DD|latest|local> [--con-imagenes]
# - fecha / latest: descarga el volcado cifrado de GCS y lo descifra con la clave PRIVADA, que llega por la
#   entrada estándar y solo vive en /tmp del contenedor (que se borra al terminar, `run --rm`).
# - local: usa /srv/ops/latest.dump (el último respaldo de esta misma VM).
# - --con-imagenes: además trae las imágenes desde gcs:<bucket>/uploads.
set -eu
# shellcheck source=SCRIPTDIR/../lib/common.sh
. /usr/local/lib/ops/common.sh

source_arg="${1:?Uso: restore-run.sh <AAAA-MM-DD|latest|local> [--con-imagenes]}"
with_images=false
[ "${2:-}" = '--con-imagenes' ] && with_images=true
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077

remote="gcs:${BACKUP_GCS_BUCKET:-}"
need_bucket() { : "${BACKUP_GCS_BUCKET:?Falta BACKUP_GCS_BUCKET}"; }

if [ "$source_arg" = 'local' ]; then
  dump="${OPS_DIR}/latest.dump"
  [ -s "$dump" ] || { log 'No hay un respaldo local en esta VM.'; exit 1; }
else
  need_bucket
  if [ "$source_arg" = 'latest' ]; then
    name=$(rclone lsf "${remote}/db/diario/" | sort | tail -n 1)
    [ -n "$name" ] || { log 'No hay respaldos en el bucket.'; exit 1; }
    object="${remote}/db/diario/${name}"
  else
    case "$source_arg" in
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
      *) log "Fecha no válida: ${source_arg} (usa AAAA-MM-DD)." && exit 2 ;;
    esac
    object="${remote}/db/diario/${source_arg}.dump.age"
    rclone lsf "$object" >/dev/null 2>&1 || object="${remote}/db/mensual/${source_arg}.dump.age"
  fi
  log "Descargando ${object}."
  rclone copyto "$object" "${work}/respaldo.dump.age"
  log 'Pega la clave privada (o llega por la entrada estándar).'
  cat >"${work}/clave.txt"
  age -d -i "${work}/clave.txt" -o "${work}/respaldo.dump" "${work}/respaldo.dump.age"
  rm -f "${work}/clave.txt"
  dump="${work}/respaldo.dump"
fi

pg_restore --list "$dump" >/dev/null
log 'Restaurando la base (reemplaza los datos actuales).'
# Sin dueños (todo queda del administrador); los permisos del rol de la app vienen en el volcado y
# `migrate` ya lo creó o actualizó antes de esta ejecución.
pg_restore --clean --if-exists --no-owner --exit-on-error -d "$DATABASE_ADMIN_URL" "$dump"
log "Base restaurada. Conteos: $(table_counts "$DATABASE_ADMIN_URL")"

if [ "$with_images" = true ]; then
  need_bucket
  log 'Restaurando las imágenes.'
  mkdir -p "$UPLOADS_SOURCE"
  rclone sync "${remote}/uploads" "$UPLOADS_SOURCE"
  log 'Imágenes restauradas.'
fi
log 'Restauración terminada.'
