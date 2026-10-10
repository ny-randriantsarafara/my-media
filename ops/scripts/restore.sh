#!/usr/bin/env bash
# Restores a restic snapshot into the stack selected by MEDIA_ENV_FILE. DESTRUCTIVE.
# Usage: ops/scripts/restore.sh <snapshot-id|latest> --confirm-overwrite
# Needs the restic variables (RESTIC_REPOSITORY, RESTIC_PASSWORD, AWS_*) in the environment.
set -euo pipefail

readonly SNAPSHOT="${1:?Usage : restore.sh <instantané|latest> --confirm-overwrite}"

if [[ "${2:-}" != "--confirm-overwrite" ]]; then
  echo "La restauration remplace la base et les fichiers actuels. Relancez avec --confirm-overwrite." >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly COMPOSE="$SCRIPT_DIR/compose-production.sh"
readonly SERVER_VOLUMES_ROOT=/var/lib/docker/volumes

# shellcheck source=SCRIPTDIR/lib.sh
source "$SCRIPT_DIR/lib.sh"

WORK_DIR="$(mktemp -d)"
readonly WORK_DIR
trap 'rm -rf "$WORK_DIR"' EXIT

restore_volume() {
  local short_name="$1"
  local volume
  volume="$(media_volume_name "$short_name")"
  local source_directory="$WORK_DIR$SERVER_VOLUMES_ROOT/$volume/_data"
  if [[ ! -d "$source_directory" ]]; then
    echo "Le volume $volume est absent de l’instantané." >&2
    exit 1
  fi
  docker run --rm \
    -v "$volume:/target" \
    -v "$source_directory:/source:ro" \
    busybox:stable \
    sh -c 'find /target -mindepth 1 -delete && cp -a /source/. /target/ && chown -R 1000:1000 /target'
  echo "Volume $volume restauré."
}

echo "Lecture de l’instantané ${SNAPSHOT}…"
restic restore "$SNAPSHOT" --target "$WORK_DIR"
DUMP_FILE="$(find "$WORK_DIR" -name directus.dump -type f | head -n 1)"
readonly DUMP_FILE
if [[ -z "$DUMP_FILE" ]]; then
  echo "Aucun fichier directus.dump dans l’instantané." >&2
  exit 1
fi

"$COMPOSE" stop caddy site directus
"$COMPOSE" up -d --wait database

"$COMPOSE" exec -T database dropdb --username=directus --maintenance-db=postgres --if-exists --force directus
"$COMPOSE" exec -T database createdb --username=directus --maintenance-db=postgres --owner=directus directus
"$COMPOSE" exec -T database pg_restore --username=directus --dbname=directus --no-owner --exit-on-error < "$DUMP_FILE"
echo "Base restaurée."

restore_volume uploads
restore_volume public-media

"$COMPOSE" up -d --wait
echo "Restauration terminée. Lancez ops/scripts/smoke.sh pour vérifier."
