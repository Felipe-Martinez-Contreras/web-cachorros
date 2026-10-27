#!/usr/bin/env bash
# Prueba de la imagen ops (especificación 12.8) en el CI, después de medir la memoria: usa la red `ci`, la base
# `db`, la app `app`, el volumen `uploads` con las imágenes del seed y `ci.env`. Cloud Storage se reemplaza por
# una carpeta local (remoto rclone `local`) y la clave age es una de prueba generada aquí.
# Verifica: tarea tick, respaldo cifrado (y que se descifra), copia de imágenes, prueba de restauración,
# chequeo de disco, registro de un respaldo fallido, una restauración real con imágenes y un respaldo con
# miles de imágenes dentro del límite de memoria de ops (el de compose.yaml, sin swap).
set -euo pipefail

BUCKET_DIR="$PWD/bucket-ci"
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/stdout}
mkdir -p "$BUCKET_DIR"
chmod 777 "$BUCKET_DIR"

fail() {
  echo "FALLÓ: $*" >&2
  docker logs --tail 30 app >&2 || true
  exit 1
}

sql() { docker exec db psql -U cachorros_admin -d cachorros -tAc "$1"; }

# Clave age de prueba: la pública va al contenedor; la privada solo se usa para descifrar en la prueba.
keys=$(docker run --rm cachorros-ops:ci age-keygen 2>&1)
public_key=$(printf '%s\n' "$keys" | sed -n 's/^# public key: //p; s/^Public key: //p' | head -n 1)
private_key=$(printf '%s\n' "$keys" | grep '^AGE-SECRET-KEY-')
[[ "$public_key" == age1* ]] || fail "no se obtuvo la clave pública de prueba"

ops() { # ops [opciones de docker run…] -- comando
  local options=()
  while [[ $# -gt 0 && "$1" != '--' ]]; do options+=("$1"); shift; done
  shift
  docker run --rm --network ci --env-file ci.env \
    -e RCLONE_CONFIG_GCS_TYPE=local -e BACKUP_GCS_BUCKET=/bucket \
    -e BACKUP_AGE_RECIPIENT="$public_key" -e DISK_ALERT_PERCENT=99 \
    -v ops_ci:/srv/ops -v "$BUCKET_DIR":/bucket "${options[@]}" cachorros-ops:ci "$@"
}

# 1. Tarea programada por la red interna.
ops -- cron-call.sh tick || fail 'cron-call.sh tick'

# 2. Respaldo: volcado, cifrado, subida y copia de las imágenes.
ops -v uploads:/srv/app-data/uploads:ro -- backup.sh || fail 'backup.sh'
dump=$(find "$BUCKET_DIR/db/diario" -name '*.dump.age' | head -n 1)
[[ -n "$dump" ]] || fail 'no quedó el volcado cifrado en db/diario'
images=$(find "$BUCKET_DIR/uploads" -type f | wc -l)
(( images > 0 )) || fail 'no se copiaron las imágenes'
# El volcado cifrado se descifra con la clave privada y es un volcado válido.
printf '%s\n' "$private_key" | docker run --rm -i -v "$BUCKET_DIR":/bucket cachorros-ops:ci sh -c \
  "cat > /tmp/clave && age -d -i /tmp/clave '/bucket/db/diario/$(basename "$dump")' | pg_restore --list >/dev/null" \
  || fail 'el volcado cifrado no se pudo descifrar o no es válido'

# 3. Prueba de restauración y chequeo de disco.
ops -- restore-test.sh || fail 'restore-test.sh'
ops -- disk-check.sh || fail 'disk-check.sh'

# 4. Un respaldo que falla queda registrado como error (clave pública inválida).
if ops -e BACKUP_AGE_RECIPIENT=age1invalida -- backup.sh; then fail 'backup.sh debía fallar con una clave inválida'; fi

runs=$(sql "select kind || ':' || status from ops_runs order by started_at, created_at")
expected=$'respaldo:ok\nprueba_restauracion:ok\ndisco:ok\nrespaldo:error'
[[ "$runs" == "$expected" ]] || fail "ops_runs no es el esperado: $(echo "$runs" | tr '\n' ' ')"

# 5. Restauración real con la app detenida: se cambia un dato y una imagen, y vuelven a como estaban.
original_name=$(sql 'select club_name from site_settings where id = 1')
sql "update site_settings set club_name = 'Nombre cambiado después del respaldo' where id = 1" >/dev/null
first_image=$(docker run --rm -v uploads:/u alpine sh -c 'find /u -type f -name "*.webp" | head -n 1')
docker run --rm -v uploads:/u alpine rm -f "$first_image"
docker stop app >/dev/null
docker run --rm --network ci --env-file ci.env cachorros-web:ci node scripts/migrate.mjs >/dev/null
printf '%s\n' "$private_key" | ops -i -v uploads:/srv/app-data/uploads -- restore-run.sh latest --con-imagenes \
  || fail 'restore-run.sh'
docker start app >/dev/null
for _ in $(seq 1 30); do curl -fsS http://localhost:3000/api/health >/dev/null && break; sleep 2; done
[[ "$(sql 'select club_name from site_settings where id = 1')" == "$original_name" ]] \
  || fail 'la base no volvió al estado del respaldo'
docker run --rm -v uploads:/u alpine test -f "$first_image" || fail 'la imagen borrada no se restauró'
[[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)" == 200 ]] \
  || fail 'la portada no responde después de restaurar'

# 6. Respaldo con muchas imágenes y el límite de memoria de ops (el default de compose.yaml) sin swap: si rclone
#    no cabe, el kernel lo mata («Killed») y el respaldo falla, como pasó en la VM. 4.000 fotos chicas en 40
#    carpetas y 30 grandes (8 MB): ejercitan la lista de archivos y los búferes de las transferencias.
ops_limit=$(sed -n 's/.*OPS_MEMORY_LIMIT:-\([0-9]*[mg]\).*/\1/p' compose.yaml)
[[ -n "$ops_limit" ]] || fail 'no se encontró el límite de memoria de ops en compose.yaml'
many_files=4030
# shellcheck disable=SC2016
docker run --rm -v uploads_muchas:/u alpine sh -c '
  for d in $(seq 1 40); do
    mkdir -p "/u/$d"
    for f in $(seq 1 100); do head -c 30000 /dev/urandom >"/u/$d/$f.webp"; done
  done
  mkdir -p /u/grandes
  for f in $(seq 1 30); do head -c 8000000 /dev/urandom >"/u/grandes/$f.jpg"; done
  chown -R 1001:1001 /u' || fail 'no se pudieron generar las imágenes de prueba'
# Al terminar, el pico de memoria del contenedor (cgroup v2; incluye la caché de archivos, que se libera sola).
# Las comillas simples son a propósito (aquí y arriba): lo expande el shell del contenedor.
# shellcheck disable=SC2016
peak=$(ops --memory "$ops_limit" --memory-swap "$ops_limit" -e BACKUP_GCS_BUCKET=/bucket/muchas \
  -v uploads_muchas:/srv/app-data/uploads:ro -- \
  sh -c 'backup.sh >&2 || exit 1; cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0') \
  || fail "backup.sh con ${many_files} imágenes no cupo en ${ops_limit} (revisa las opciones de rclone del Dockerfile de ops)"
copied=$(find "$BUCKET_DIR/muchas/uploads" -type f | wc -l)
(( copied == many_files )) || fail "se copiaron ${copied} de ${many_files} imágenes con el límite de memoria"
peak_mb=$(( ${peak:-0} / 1024 / 1024 ))
docker volume rm uploads_muchas >/dev/null || true

# Las comillas invertidas son Markdown, no comandos.
# shellcheck disable=SC2016
{
  echo '### Imagen ops: respaldos y restauración'
  echo
  echo '| Prueba | Resultado |'
  echo '|---|---|'
  echo '| Tarea `tick` por la red interna | ok |'
  echo "| Respaldo cifrado con age, descifrado y verificado | ok ($(wc -c <"$dump") bytes) |"
  echo "| Copia de imágenes | ok (${images} archivos) |"
  echo '| Prueba de restauración (conteos) | ok |'
  echo '| Chequeo de disco | ok |'
  echo '| Respaldo fallido registrado en `ops_runs` | ok |'
  echo '| Restauración real (base + imágenes) con la app detenida | ok |'
  echo "| Respaldo de ${many_files} imágenes con \`--memory ${ops_limit}\` sin swap | ok (pico ${peak_mb} MB, con caché de archivos) |"
} >>"$SUMMARY"
echo 'Imagen ops: todas las pruebas pasaron.'
