#!/usr/bin/env bash
# Public checks after a deployment or a restore.
# Usage: ops/scripts/smoke.sh <site-url> <cms-url> [--insecure]
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage : $0 <adresse-du-site> <adresse-du-cms> [--insecure]" >&2
  exit 2
fi

SITE_URL="${1%/}"
CMS_URL="${2%/}"
readonly SITE_URL CMS_URL

CURL_OPTIONS=(--silent --output /dev/null --write-out '%{http_code}' --max-time 20)
if [[ "${3:-}" == "--insecure" ]]; then
  CURL_OPTIONS+=(--insecure)
fi
readonly CURL_OPTIONS

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
