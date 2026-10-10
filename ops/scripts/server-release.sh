#!/usr/bin/env bash
# Builds, starts and provisions a release on the server, then runs the smoke checks.
# Usage (on the server, called by deploy.sh): server-release.sh <release-dir>
set -euo pipefail

readonly RELEASE_DIR="${1:?Usage : server-release.sh <dossier-de-version>}"
readonly APP_ROOT=/opt/my-media
readonly ENV_FILE="$APP_ROOT/shared/production.env"
readonly KEPT_RELEASES=5
readonly COMPOSE="$RELEASE_DIR/ops/scripts/compose-production.sh"

# shellcheck source=SCRIPTDIR/lib.sh
source "$RELEASE_DIR/ops/scripts/lib.sh"

: "${RELEASE:?RELEASE doit être défini}"

SITE_DOMAIN="$(read_env_value "$ENV_FILE" SITE_DOMAIN)"
CMS_DOMAIN="$(read_env_value "$ENV_FILE" CMS_DOMAIN)"
readonly SITE_DOMAIN CMS_DOMAIN

"$COMPOSE" pull database caddy
"$COMPOSE" --profile tools build --pull
"$COMPOSE" up -d --wait database directus
"$COMPOSE" run --rm provision
"$COMPOSE" up -d --wait --remove-orphans
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | tail -n +$((KEPT_RELEASES + 1)) \
  | cut -d ' ' -f 2- \
  | xargs -r rm -rf

"$RELEASE_DIR/ops/scripts/smoke.sh" "https://$SITE_DOMAIN" "https://$CMS_DOMAIN"
echo "Version $RELEASE en service."
