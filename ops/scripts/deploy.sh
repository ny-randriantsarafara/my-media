#!/usr/bin/env bash
# Sends the committed tree to the server and releases it.
# Usage (from the laptop): ops/scripts/deploy.sh <ssh-destination>, for example media@203.0.113.10
set -euo pipefail

readonly DESTINATION="${1:?Usage : ops/scripts/deploy.sh <utilisateur@serveur>}"
readonly APP_ROOT=/opt/my-media

cd "$(git rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Le dépôt contient des modifications non commitées : commitez-les ou mettez-les de côté avant de déployer." >&2
  exit 1
fi

RELEASE="$(git rev-parse --short=12 HEAD)"
readonly RELEASE
readonly RELEASE_DIR="$APP_ROOT/releases/$RELEASE"

echo "Envoi de la version $RELEASE vers ${DESTINATION}…"
# shellcheck disable=SC2029
git archive --format=tar HEAD | ssh "$DESTINATION" "mkdir -p '$RELEASE_DIR' && tar -x -C '$RELEASE_DIR'"

echo "Mise en service sur le serveur…"
# shellcheck disable=SC2029
ssh "$DESTINATION" "RELEASE='$RELEASE' '$RELEASE_DIR/ops/scripts/server-release.sh' '$RELEASE_DIR'"
