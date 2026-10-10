#!/usr/bin/env bash
# Helpers shared by the operation scripts. Source this file; do not run it.

readonly MEDIA_PROJECT=my-media-production

# Prints the value of NAME from a dotenv file (last definition wins).
read_env_value() {
  local file="$1"
  local name="$2"
  local line
  line="$(grep -E "^${name}=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo "Réglage $name absent de $file." >&2
    return 1
  fi
  echo "${line#*=}"
}

# Prints the Docker volume name of a production volume, for example "uploads".
media_volume_name() {
  echo "${MEDIA_PROJECT}_$1"
}
