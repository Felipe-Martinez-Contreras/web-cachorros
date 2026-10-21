#!/usr/bin/env bash
# Prepara una VM Debian nueva (especificación 12.6, pasos 3 a 6). Se ejecuta una vez, con sudo:
#   sudo ./deploy/bootstrap-vm.sh
# Instala Docker Engine y el plugin Compose desde el repositorio oficial de Docker, deja la rotación de logs,
# crea 2 GB de swap, activa las actualizaciones automáticas de seguridad y prepara /opt/cachorros.
# Se puede volver a correr sin romper nada.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo 'Córrelo con sudo.' >&2; exit 1; }
user=${SUDO_USER:-$(logname 2>/dev/null || echo root)}
say() { printf '\n== %s\n' "$*"; }

say 'Paquetes base'
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg openssl unattended-upgrades

if ! command -v docker >/dev/null; then
  say 'Docker Engine y Compose (repositorio oficial de Docker)'
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091 # /etc/os-release existe en Debian.
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${codename} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

say 'Rotación de logs de Docker (trampa 16)'
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{"log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}}
EOF
systemctl enable --now docker
systemctl restart docker
[[ "$user" != root ]] && usermod -aG docker "$user"

if ! swapon --show | grep -q /swapfile; then
  say 'Swap de 2 GB'
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
printf 'vm.swappiness=10\nvm.vfs_cache_pressure=50\n' >/etc/sysctl.d/99-cachorros.conf
sysctl --system >/dev/null

say 'Actualizaciones automáticas de seguridad'
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades

say 'Carpeta de la aplicación'
mkdir -p /opt/cachorros/deploy/certs
chown -R "$user":"$user" /opt/cachorros
chmod 700 /opt/cachorros/deploy/certs

say 'Listo'
free -h
docker --version
docker compose version
echo
echo "Cierra la sesión y vuelve a entrar para usar docker sin sudo (usuario ${user})."
