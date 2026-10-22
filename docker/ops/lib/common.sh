# shellcheck shell=sh
# Funciones comunes de los scripts de ops (se cargan con `. /usr/local/lib/ops/common.sh`).
# Usan DATABASE_ADMIN_URL: ops se conecta como administrador (especificación 12.3 y 9.7).

: "${DATABASE_ADMIN_URL:?Falta DATABASE_ADMIN_URL}"
: "${OPS_DIR:=/srv/ops}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

# Tablas que se cuentan al respaldar y al probar una restauración (siempre en este orden).
COUNT_TABLES='matches match_events players news media_assets members membership_requests contact_messages events products'

# Conteo de filas de las tablas clave como JSON, en la base de la URL dada.
table_counts() {
  sql="select json_build_object("
  sep=''
  for table in $COUNT_TABLES; do
    sql="${sql}${sep}'${table}', (select count(*) from ${table})"
    sep=', '
  done
  psql "$1" -v ON_ERROR_STOP=1 -At -c "${sql})"
}

# La misma URL de conexión, apuntando a otra base (cambia el último segmento de la ruta).
url_with_db() {
  printf '%s' "$1" | sed -E "s#/[^/?]*(\\?.*)?\$#/$2\\1#"
}

# Registra una ejecución terminada en ops_runs (lo lee el panel → Estado del sistema).
# record_run <tipo> <ok|error> <inicio ISO> <detalles JSON>
record_run() {
  psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -q \
    -v kind="$1" -v status="$2" -v started="$3" -v details="$4" <<'SQL'
insert into ops_runs (kind, status, started_at, finished_at, details)
values (:'kind'::ops_run_kind, :'status'::ops_run_status, :'started'::timestamptz, now(), :'details'::jsonb);
SQL
}

# Aviso al monitor de respaldos («dead man's switch»), si está configurado. ping_monitor [fail] [mensaje]
ping_monitor() {
  [ -n "${BACKUP_HEALTHCHECK_URL:-}" ] || return 0
  url="$BACKUP_HEALTHCHECK_URL"
  [ "${1:-}" = 'fail' ] && url="${url%/}/fail"
  curl -fsS -m 15 --retry 3 --data-raw "${2:-}" "$url" >/dev/null || log "No se pudo avisar al monitor."
}

# Texto JSON seguro (sin comillas ni saltos de línea sin escapar).
json_string() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '
}

now_iso() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}
