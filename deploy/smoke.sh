#!/usr/bin/env bash
# Public checks after a delivery.
# Usage: deploy/smoke.sh <site-url> <cms-url> [--insecure] [--wait <seconds>]
# --wait gives a new instance time to get its certificates before the checks start.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage : $0 <adresse-du-site> <adresse-du-cms> [--insecure] [--wait <secondes>]" >&2
  exit 2
fi

SITE_URL="${1%/}"
CMS_URL="${2%/}"
readonly SITE_URL CMS_URL
shift 2

CURL_OPTIONS=(--silent --output /dev/null --write-out '%{http_code}' --max-time 20)
wait_seconds=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --insecure) CURL_OPTIONS+=(--insecure); shift ;;
    --wait) wait_seconds="${2:?--wait attend un nombre de secondes}"; shift 2 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done
readonly CURL_OPTIONS wait_seconds

wait_until_up() {
  local deadline=$((SECONDS + wait_seconds))
  until [[ "$(curl "${CURL_OPTIONS[@]}" "$SITE_URL/" || true)" == 200 \
    && "$(curl "${CURL_OPTIONS[@]}" "$CMS_URL/server/ping" || true)" == 200 ]]; do
    if ((SECONDS >= deadline)); then
      echo "Pas de réponse HTTPS après ${wait_seconds} s : les vérifications continuent." >&2
      return
    fi
    sleep 10
  done
}

if ((wait_seconds > 0)); then
  wait_until_up
fi

readonly PRIVATE_COLLECTIONS=(articles article_references article_images verification_points review_remarks materials watch_sources editorial_line)

failures=0

check_status() {
  local description="$1"
  local expected="$2"
  local method="$3"
  local url="$4"
  local actual
  actual="$(curl "${CURL_OPTIONS[@]}" --request "$method" "$url" || true)"
  if [[ " $expected " == *" $actual "* ]]; then
    echo "ok     $description ($actual)"
    return
  fi
  echo "ÉCHEC  $description : attendu $expected, reçu $actual" >&2
  failures=$((failures + 1))
}

check_status "accueil du site" "200" GET "$SITE_URL/"
check_status "page inconnue du site" "404" GET "$SITE_URL/page-inexistante-verification"
check_status "image publique inexistante" "404" GET "$SITE_URL/media/00000000-0000-4000-8000-000000000000.webp"
check_status "Directus répond" "200" GET "$CMS_URL/server/ping"
check_status "versions publiées, lecture anonyme" "200" GET "$CMS_URL/items/published_articles?limit=1"
for collection in "${PRIVATE_COLLECTIONS[@]}"; do
  check_status "données privées refusées : $collection" "403" GET "$CMS_URL/items/$collection?limit=1"
done
check_status "fichiers privés refusés" "403" GET "$CMS_URL/files?limit=1"
check_status "utilisateurs refusés" "403" GET "$CMS_URL/users?limit=1"
check_status "flows refusés" "403" GET "$CMS_URL/flows?limit=1"
check_status "MCP refusé sans authentification" "401 403" POST "$CMS_URL/mcp"

if ((failures > 0)); then
  echo "$failures vérification(s) en échec." >&2
  exit 1
fi
echo "Toutes les vérifications sont passées."
