#!/bin/sh
# Llama a una tarea programada de la app (especificación 12.8): `tick` cada 5 min, `daily` de madrugada.
# Va por la red interna de Docker: Caddy responde 404 a /api/cron/* desde afuera.
set -eu
# shellcheck source=SCRIPTDIR/../lib/common.sh
. /usr/local/lib/ops/common.sh

task="${1:?Uso: cron-call.sh tick|daily}"
case "$task" in
  tick | daily) ;;
  *) log "Tarea desconocida: $task" && exit 2 ;;
esac
: "${CRON_SECRET:?Falta CRON_SECRET}"

if body=$(curl -fsS -m 120 -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/${task}"); then
  log "cron ${task}: ${body}"
else
  log "cron ${task}: la app no respondió bien."
  exit 1
fi
