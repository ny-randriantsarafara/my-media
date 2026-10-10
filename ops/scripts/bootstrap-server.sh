#!/usr/bin/env bash
# One-time preparation of a fresh Debian or Ubuntu server.
# Run with sudo from the administration account created by the provider (OVHcloud: "debian"):
#   ssh debian@<server> 'sudo bash -s' < ops/scripts/bootstrap-server.sh
set -euo pipefail

readonly DEPLOY_USER=media
readonly APP_ROOT=/opt/my-media

if [[ "$(id -u)" -ne 0 || -z "${SUDO_USER:-}" || "${SUDO_USER}" == "root" ]]; then
  echo "Lancez ce script avec sudo depuis le compte d’administration (pas directement en root)." >&2
  exit 1
fi

ADMIN_KEYS="$(getent passwd "$SUDO_USER" | cut -d ':' -f 6)/.ssh/authorized_keys"
readonly ADMIN_KEYS

if [[ ! -s "$ADMIN_KEYS" ]]; then
  echo "Aucune clé SSH dans $ADMIN_KEYS : ajoutez la vôtre avant de durcir SSH." >&2
  exit 1
fi

install_base_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get -y full-upgrade
  apt-get -y install ca-certificates curl gnupg ufw unattended-upgrades restic jq
}

enable_automatic_security_updates() {
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
}

install_docker() {
  # shellcheck source=/dev/null
  source /etc/os-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
  systemctl restart docker
}

add_swap() {
  if swapon --show | grep -q '/swapfile'; then
    return
  fi
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
}

create_deploy_user() {
  if ! id "$DEPLOY_USER" > /dev/null 2>&1; then
    adduser --disabled-password --gecos '' "$DEPLOY_USER"
  fi
  usermod -aG docker "$DEPLOY_USER"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ADMIN_KEYS" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_ROOT" "$APP_ROOT/releases"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_ROOT/shared"
}

harden_ssh() {
  cat > /etc/ssh/sshd_config.d/10-my-media.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
  sshd -t
  systemctl reload ssh
}

configure_firewall() {
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
  ufw --force enable
}

install_base_packages
enable_automatic_security_updates
install_docker
add_swap
create_deploy_user
configure_firewall
harden_ssh

ufw status verbose
echo "Serveur prêt. Vérifiez dans un AUTRE terminal : ssh ${DEPLOY_USER}@<serveur> avant de fermer cette session."
