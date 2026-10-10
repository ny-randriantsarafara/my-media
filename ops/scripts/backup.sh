#!/usr/bin/env bash
# Nightly backup: database dump, uploaded files, public media and production settings.
# Run as root by media-backup.service with /etc/my-media/backup.env loaded.
set -euo pipefail
set -o errtrace

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly APP_ROOT=/opt/my-media
readonly COMPOSE="$SCRIPT_DIR/compose-production.sh"
readonly HEALTHCHECK_URL="${HEALTHCHECK_URL:?HEALTHCHECK_URL est obligatoire}"

# shellcheck source=SCRIPTDIR/lib.sh
source "$SCRIPT_DIR/lib.sh"

WORK_DIR="$(mktemp -d /var/tmp/my-media-backup.XXXXXX)"
readonly WORK_DIR

ping_healthcheck() {
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL$1" > /dev/null || true
}

clean_up() {
  rm -rf "$WORK_DIR"
}

report_failure() {
  ping_healthcheck /fail
}

volume_directory() {
  docker volume inspect --format '{{ .Mountpoint }}' "$(media_volume_name "$1")"
}

trap clean_up EXIT
trap report_failure ERR

ping_healthcheck /start
"$COMPOSE" exec -T database pg_dump --username=directus --dbname=directus --format=custom > "$WORK_DIR/directus.dump"
restic backup --tag my-media --host my-media-production \
  "$WORK_DIR/directus.dump" \
  "$(volume_directory uploads)" \
  "$(volume_directory public-media)" \
  "$APP_ROOT/shared/production.env"
restic forget --tag my-media --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
restic check
ping_healthcheck ""
