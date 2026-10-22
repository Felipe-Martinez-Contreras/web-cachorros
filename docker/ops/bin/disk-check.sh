#!/bin/sh
# Chequeo semanal de disco (especificación 12.8): registra el uso en ops_runs y, sobre el 80 %, avisa por el
# monitor de respaldos (el aviso queda en «falla» hasta el próximo respaldo correcto).
set -eu
# shellcheck source=SCRIPTDIR/../lib/common.sh
. /usr/local/lib/ops/common.sh

limit="${DISK_ALERT_PERCENT:-80}"
started=$(now_iso)
# El volumen de ops vive en el disco de la VM: su uso es el del disco.
read -r size used avail percent <<EOF
$(df -Pk "$OPS_DIR" | awk 'NR == 2 { gsub("%", "", $5); print $2, $3, $4, $5 }')
EOF

details=$(printf '{"percent": %s, "used_kb": %s, "size_kb": %s, "avail_kb": %s, "limit": %s}' \
  "$percent" "$used" "$size" "$avail" "$limit")
if [ "$percent" -ge "$limit" ]; then
  record_run disco error "$started" "$details"
  ping_monitor fail "El disco de la VM está al ${percent} % (límite ${limit} %)."
  log "Disco al ${percent} %: sobre el límite de ${limit} %."
  exit 1
fi
record_run disco ok "$started" "$details"
log "Disco al ${percent} %."
