#!/usr/bin/env bash
# Runs docker compose on the production project defined next to this script.
# Usage: ops/scripts/compose-production.sh <compose arguments...>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${MEDIA_ENV_FILE:-/opt/my-media/shared/production.env}"
readonly SCRIPT_DIR OPS_DIR ENV_FILE

# shellcheck source=SCRIPTDIR/lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier de configuration introuvable : $ENV_FILE" >&2
  exit 1
fi

exec docker compose \
  --project-name "$MEDIA_PROJECT" \
  --project-directory "$OPS_DIR" \
  --file "$OPS_DIR/compose.production.yaml" \
  --env-file "$ENV_FILE" \
  "$@"
