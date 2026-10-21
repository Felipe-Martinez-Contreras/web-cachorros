#!/usr/bin/env bash
# Medición de memoria de la imagen (especificación 10 y 12): el contenedor `app` ya corre con --memory=512m.
# Carga el seed, recorre la portada y el panel, sube fotos de 12 MP (sharp) y publica el pico de memoria en
# el resumen del job. Falla si el contenedor se quedó sin memoria (OOM) o si una petición no respondió bien.
# Solo corre en el CI (Linux); usa `ci.env` y la red `ci` que deja el paso anterior.
set -euo pipefail

BASE=http://localhost:3000
LIMIT_MB=512
EMAIL=memoria@cachorros.test
PASSWORD=clave-de-la-medicion-ci-2026
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/stdout}
failures=()

# Código HTTP de una petición; «000» si no hubo respuesta (por ejemplo, el contenedor murió por OOM).
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$@" || true; }

check() { # check <descripción> <código esperado> <código obtenido>
  if [[ "$3" != "$2" ]]; then failures+=("$1: respondió $3 (se esperaba $2)"); fi
}

# 1. Datos de ejemplo (con sus imágenes) y un administrador, en el mismo volumen de subidas que la app.
docker run --rm --network ci --env-file ci.env -v uploads:/data/uploads \
  -e SEED_ADMIN_EMAIL="$EMAIL" -e SEED_ADMIN_PASSWORD="$PASSWORD" \
  cachorros-web:ci node scripts/seed.mjs

# 2. Una foto de 4000 × 3000 (12 MP) con ruido: el peor caso para sharp.
docker run --rm --user "$(id -u)" -v "$PWD:/out" -w /app cachorros-web:ci node -e "
  require('sharp')({ create: { width: 4000, height: 3000, channels: 3,
    noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 90 }).toFile('/out/foto.jpg')"

# 3. Portada y páginas públicas, varias veces (la primera llena las cachés).
for round in 1 2 3; do
  for path in / /noticias /partidos /historia /socios /auspiciadores; do
    code=$(status "$BASE$path")
    check "GET $path (vuelta $round)" 200 "$code"
  done
done

# 4. Panel: entrar, recorrer pantallas y subir 3 fotos.
code=$(status -c cookies.txt -H "Origin: $BASE" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "$BASE/api/auth/sign-in/email")
check 'Entrar al panel' 200 "$code"
for path in /admin /admin/noticias /admin/jugadores /admin/socios /admin/medios; do
  code=$(status -b cookies.txt "$BASE$path")
  check "GET $path" 200 "$code"
done
for i in 1 2 3; do
  code=$(status -b cookies.txt -H "Origin: $BASE" \
    -F file=@foto.jpg -F "altText=Foto de la medición de memoria $i" -F kind=photo "$BASE/api/admin/media")
  check "Subir foto de 12 MP ($i)" 201 "$code"
done

# 5. Tarjetas para redes (Satori + sharp): las 4 de un partido del seed, una tras otra, con su tiempo.
match_id=$(docker exec db psql -U cachorros_admin -d cachorros -tAc   "select id from matches where status = 'finalizado' and club_side <> 'ninguno' order by kickoff_at desc limit 1")
card_times=()
for format in cuadrado vertical historia og; do
  start=$(date +%s%3N)
  code=$(status -L "$BASE/api/share/resultado/$match_id/$format")
  card_times+=("$format: $(( $(date +%s%3N) - start )) ms")
  check "Tarjeta resultado $format" 200 "$code"
done

# 6. Resultado: pico de memoria del cgroup del contenedor y si hubo OOM.
peak_bytes=$(docker exec app cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo '')
current=$(docker stats --no-stream --format '{{.MemUsage}}' app || echo 'sin datos')
oom=$(docker inspect app --format '{{.State.OOMKilled}}')
running=$(docker inspect app --format '{{.State.Running}}')
oom_events=$(docker exec app sh -c "grep '^oom_kill ' /sys/fs/cgroup/memory.events | cut -d' ' -f2" 2>/dev/null || echo '?')
oom_events=${oom_events:-?}
peak_mb=$([[ -n "$peak_bytes" ]] && echo $((peak_bytes / 1024 / 1024)) || echo '?')

{
  echo '### Memoria de la imagen con `--memory=512m`'
  echo
  echo '| Medida | Valor |'
  echo '|---|---|'
  echo "| Pico de memoria (cgroup \`memory.peak\`) | **${peak_mb} MB** de ${LIMIT_MB} MB |"
  echo "| Uso al terminar | ${current} |"
  echo "| Procesos terminados por OOM | ${oom_events} |"
  echo "| Contenedor terminado por OOM | ${oom} |"
  echo "| Contenedor sigue corriendo | ${running} |"
  echo
  echo 'Carga: seed, 3 vueltas a 6 páginas públicas, 5 pantallas del panel, 3 fotos de 12 MP y 4 tarjetas para redes.'
  echo
  echo "Primera generación de cada tarjeta (meta ≤ 3 s en la VM): ${card_times[*]}"
  if ((${#failures[@]} > 0)); then
    echo
    echo '**Peticiones que fallaron:**'
    printf -- '- %s\n' "${failures[@]}"
  fi
} >>"$SUMMARY"

if [[ "$oom" == 'true' || "$running" != 'true' || ("$oom_events" != '0' && "$oom_events" != '?') ]]; then
  echo "El contenedor se quedó sin memoria (OOM) o se detuvo." >&2
  docker logs --tail 50 app >&2 || true
  exit 1
fi
if ((${#failures[@]} > 0)); then
  printf 'Falló: %s\n' "${failures[@]}" >&2
  docker logs --tail 50 app >&2 || true
  exit 1
fi
echo "Pico de memoria: ${peak_mb} MB de ${LIMIT_MB} MB."
echo "Tarjetas: ${card_times[*]}"
