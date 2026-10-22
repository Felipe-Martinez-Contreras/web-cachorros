#!/usr/bin/env bash
# Escaneo de vulnerabilidades de una imagen local con Trivy (especificación 3.10 y 12.5): falla con CRITICAL.
# Solo cuenta las que tienen arreglo publicado (--ignore-unfixed): las otras no se pueden corregir subiendo
# versiones y se revisan en el resumen de Renovate.
#   bash .github/scripts/trivy.sh <imagen>
set -euo pipefail

TRIVY_VERSION=0.76.0
image=${1:?Uso: trivy.sh <imagen>}
mkdir -p "$HOME/.cache/trivy"

docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$HOME/.cache/trivy:/root/.cache/trivy" \
  "aquasec/trivy:${TRIVY_VERSION}" image \
  --scanners vuln --severity CRITICAL,HIGH --ignore-unfixed --no-progress --format table "$image"

docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$HOME/.cache/trivy:/root/.cache/trivy" \
  "aquasec/trivy:${TRIVY_VERSION}" image \
  --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 --no-progress --quiet "$image"
echo "Trivy: ${image} sin vulnerabilidades CRITICAL con arreglo disponible."
