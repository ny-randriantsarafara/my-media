#!/usr/bin/env bash
# Writes the repository .env for a CI run: .env.example with every "change-me" value replaced
# by a random secret. Never used outside a disposable CI runner.
# Usage: scripts/ci/write-env.sh [output-file]
set -euo pipefail

cd "$(dirname "$0")/../.."
readonly OUTPUT="${1:-.env}"

if [[ -e "$OUTPUT" ]]; then
  echo "$OUTPUT already exists; nothing was overwritten." >&2
  exit 1
fi

umask 077
while IFS= read -r line; do
  if [[ "$line" =~ ^([A-Z_]+)=change-me ]]; then
    echo "${BASH_REMATCH[1]}=$(openssl rand -hex 32)"
  else
    echo "$line"
  fi
done < .env.example > "$OUTPUT"

echo "$OUTPUT written from .env.example."
