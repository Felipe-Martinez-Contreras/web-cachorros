#!/usr/bin/env bash
# Restauración real (especificación 12.8). Se ejecuta en /opt/cachorros:
#   ./deploy/restore.sh local                          # el último respaldo de esta VM (sin clave)
#   ./deploy/restore.sh latest --con-imagenes          # el último de Cloud Storage, con las imágenes
#   ./deploy/restore.sh 2026-10-20 --clave ~/clave.txt # el de esa fecha, con la clave en un archivo
# Con «latest» o una fecha hace falta la clave PRIVADA de age: se pega cuando se pide (no se ve en pantalla)
# o se indica con --clave. Nunca se guarda en el servidor: llega al contenedor por la entrada estándar.
# Pasos: detiene la app y ops → migrate (asegura el rol de la app) → restore → inicia todo → verifica.
set -euo pipefail

cd "$(dirname "$0")/.."

die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }

[[ $# -ge 1 ]] || die 'Uso: ./deploy/restore.sh <local|latest|AAAA-MM-DD> [--con-imagenes] [--clave archivo]'
source_arg=$1
shift
images=()
key_file=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --con-imagenes) images=(--con-imagenes) ;;
    --clave) key_file=${2:?Falta el archivo de la clave}; shift ;;
    *) die "Opción desconocida: $1" ;;
  esac
  shift
done

key=''
if [[ "$source_arg" != 'local' ]]; then
  if [[ -n "$key_file" ]]; then
    key=$(cat "$key_file")
  else
    read -r -s -p 'Pega la clave privada de los respaldos (AGE-SECRET-KEY-…) y presiona Enter: ' key
    echo
  fi
  [[ "$key" == AGE-SECRET-KEY-* ]] || die 'Eso no parece una clave privada de age.'
fi

printf 'Esto REEMPLAZA los datos actuales del sitio con el respaldo «%s». ¿Seguir? (escribe «si»): ' "$source_arg"
read -r answer
[[ "$answer" == 'si' || "$answer" == 'sí' ]] || die 'Cancelado.'

started=$(date +%s)
say 'Deteniendo la app y las tareas programadas'
docker compose stop app ops
say 'Asegurando la base y el rol de la app'
docker compose run --rm migrate
say 'Restaurando'
printf '%s\n' "$key" | docker compose run --rm -T restore "$source_arg" "${images[@]}"
unset key
say 'Iniciando el sitio'
docker compose up -d
for _ in $(seq 1 60); do
  id=$(docker compose ps -q app)
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" == 'healthy' ]] && break
  sleep 3
done
docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health || die 'La app no responde después de restaurar.'
echo
say "Restauración terminada en $(( ($(date +%s) - started) / 60 )) min."
