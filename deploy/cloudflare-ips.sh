#!/usr/bin/env bash
# Regenera deploy/cloudflare-trusted-proxies.caddy con los rangos vigentes de Cloudflare y recarga Caddy si
# cambiaron. Se programa mensual en la VM (cron del sistema). SOLO toca Caddy: la regla de firewall de Google
# Cloud se actualiza desde tu PC (docs/despliegue.md) o con el workflow mensual de GitHub; nunca desde la VM,
# cuya cuenta de servicio solo puede usar el bucket de respaldos (mínimo privilegio).
set -euo pipefail

cd "$(dirname "$0")/.."
target=deploy/cloudflare-trusted-proxies.caddy

v4=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)
v6=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)
ranges=$(printf '%s\n%s\n' "$v4" "$v6" | tr -d '\r' | sed '/^$/d')

# Solo rangos con forma de CIDR: una respuesta rara nunca llega a la configuración.
if printf '%s\n' "$ranges" | grep -Evq '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$|^[0-9a-f:]+/[0-9]{1,3}$'; then
  echo 'La lista de Cloudflare tiene algo que no es un rango CIDR: no se cambia nada.' >&2
  exit 1
fi
count=$(printf '%s\n' "$ranges" | wc -l)
(( count >= 10 )) || { echo "La lista de Cloudflare tiene solo $count rangos: no se cambia nada." >&2; exit 1; }

new=$(mktemp)
{
  echo '# Generado por deploy/cloudflare-ips.sh (rangos de https://www.cloudflare.com/ips). No editar a mano.'
  echo "# Actualizado: $(date -u '+%Y-%m-%d')"
  echo "trusted_proxies static $(printf '%s\n' "$ranges" | paste -sd ' ')"
} >"$new"

if diff -q <(tail -n 1 "$target" 2>/dev/null) <(tail -n 1 "$new") >/dev/null; then
  rm -f "$new"
  echo 'Los rangos de Cloudflare no cambiaron.'
  exit 0
fi
# Se reescribe en su lugar (no con mv): Caddy lo ve por un bind mount de archivo, atado al inodo.
cat "$new" >"$target"
rm -f "$new"
echo 'Rangos de Cloudflare actualizados.'
if [[ -n "$(docker compose ps -q caddy 2>/dev/null)" ]]; then
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  echo 'Caddy recargado.'
fi
echo 'Recuerda: si cambiaron los rangos IPv4, actualiza también el firewall desde tu PC (docs/despliegue.md).'
