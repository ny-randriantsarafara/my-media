# Média indépendant — Plan 3 : hébergement et exploitation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the CMS and the public site on one small VPS over HTTPS, with off-site backups, a tested restore, uptime monitoring and a documented go-live, for well under 30 € per month.

**Architecture:** One VPS runs Docker Compose: Postgres, Directus (image with the `editorial` extension baked in), the Astro site, and Caddy for automatic HTTPS. Directus and the site share a `public-media` volume (read-write for Directus, read-only for the site). Releases are built on the server from a `git archive` of the committed tree sent over SSH. A systemd timer runs restic every night to an S3-compatible bucket in another region and pings Healthchecks.io; UptimeRobot watches both domains.

**Tech Stack:** OVHcloud VPS (Debian 13), Docker Engine with the Compose plugin, Caddy 2, Postgres 17, Directus 12.5.0, Node 24, restic, systemd, OVHcloud Object Storage (S3 API), Healthchecks.io and UptimeRobot (free plans), ShellCheck.

**Spec:** `docs/superpowers/specs/2026-10-10-media-independant-design.md` (sections 11, 12 and 13). Research: `docs/recherche-hebergement.md`.

**Depends on:** plan 1 (`2026-10-10-media-01-cms-editorial.md`), including the evidence record `docs/validation/2026-10-mcp-clients.md` (decision on `AI_APP_ACCESS`, observed OAuth domains); plan 2 (`2026-10-10-media-02-public-site.md`).

## Global Constraints

- "L'utilisateur a choisi un petit serveur à maintenir. Directus, la base, le site et le stockage des fichiers doivent tenir dans une installation proportionnée au lancement."
- "HTTPS, sauvegarde de la base et des médias, procédure de restauration et surveillance de disponibilité font partie de l'exploitation."
- Budget: "moins de 30 €/mois de dépenses supplémentaires, hors abonnements IA déjà possédés", including "serveur, sauvegardes et stockage supplémentaires éventuels, ainsi que le domaine réparti sur l'année".
- "L'hébergeur sera sélectionné à partir du coût total et des conditions de renouvellement, sans se limiter à un tarif d'appel."
- "La licence et la version Directus compatibles avec le MCP OAuth seront recontrôlées avant installation."
- Acceptance (§12, "Exploitation"): "Coût total conforme au plafond retenu et restauration fonctionnelle", proved by "Chiffrage des conditions réelles et essai de restauration".
- "Les essais locaux sur des comptes de test ne valent pas preuve de connexion des abonnements réels." The production MCP connection is tested with the real Claude and ChatGPT accounts.
- "Les données de démonstration ne sont pas automatiquement publiées sur le futur média."
- Production never sets `EDITOR_TOKEN` or `AI_TOKEN`: the assistant connects through MCP OAuth only (plan 1 provisioning removes absent tokens).
- Anything that spends money (ordering the VPS, the domain, the bucket) or publishes (pushing to a remote, pointing DNS) is done by the project owner or with their explicit approval at that step.
- Scripts: Bash with `set -euo pipefail`, French operator messages, ShellCheck clean, no secret printed to the terminal or committed.

---

## File structure

```text
Dockerfile                       # targets: directus, site, provision
.dockerignore
ops/
├── compose.production.yaml      # postgres, directus, site, caddy, provision (tools profile)
├── Caddyfile
├── production.env.example
├── backup.env.example
├── scripts/
│   ├── lib.sh                   # shared helpers (env file values, volume names)
│   ├── compose-production.sh    # docker compose wrapper for the production project
│   ├── smoke.sh                 # public HTTP checks (site, CMS, anonymous refusals)
│   ├── bootstrap-server.sh      # one-time server hardening and Docker install
│   ├── deploy.sh                # laptop: send the committed tree and release it
│   ├── server-release.sh        # server: build, start, provision, smoke
│   ├── backup.sh                # nightly restic backup
│   └── restore.sh               # restore a snapshot into a stack (destructive)
└── systemd/
    ├── media-backup.service
    └── media-backup.timer
docs/
├── adr/0002-hebergement.md
├── exploitation/
│   ├── mise-en-production.md
│   ├── sauvegarde-et-restauration.md
│   └── surveillance-et-mises-a-jour.md
└── validation/
    ├── restauration.md
    └── mise-en-service.md
```

On the server: `/opt/my-media/releases/<commit>` (one directory per release), `/opt/my-media/current` (symlink to the running release), `/opt/my-media/shared/production.env` (secrets, mode 600), `/etc/my-media/backup.env` (backup credentials, mode 600).

---

### Task 1: Hosting decision and budget

**Files:**
- Create: `docs/adr/0002-hebergement.md`

**Interfaces:**
- Consumes: `docs/recherche-hebergement.md`, spec §11.
- Produces: the chosen offer and the monthly cost table used by the go-live sign-off (Task 8).

- [ ] **Step 1: Re-check the offers on the day of the decision**

Open `https://www.ovhcloud.com/fr/vps/` and the Object Storage price page (`https://www.ovhcloud.com/fr/public-cloud/object-storage/`), and a `.fr` domain price at the chosen registrar. For each, note: monthly price TTC, commitment length, renewal price, region. The research note dates from 10 October 2026; offers change.

- [ ] **Step 2: Write the decision record**

`docs/adr/0002-hebergement.md`:

```markdown
# ADR 0002 — Hébergement de la V1

Statut : proposé — à valider par la personne qui commande.
Date : 2026-10-10.

## Contexte

Le média tourne sur un petit serveur maintenu par l’utilisateur (spec §11) : Directus 12.5.0 et son extension, Postgres, le site Astro et les fichiers. Le plafond est de 30 €/mois de dépenses nouvelles, domaine et sauvegardes compris. Les photos de téléphone (jusqu’à 50 Mpx) sont converties à la publication ; le décodage d’une telle image demande plusieurs centaines de Mo de mémoire. Les images Docker sont construites sur le serveur.

## Décision

- Serveur : OVHcloud VPS-2 (4 vCores, 8 Go de RAM, 75 Go de stockage), Debian 13, datacenter en France, sans engagement.
- Sauvegardes hors serveur : restic vers OVHcloud Object Storage (API S3), dans une autre région que le VPS.
- HTTPS : Caddy avec certificats Let’s Encrypt.
- Surveillance : UptimeRobot (disponibilité) et Healthchecks.io (sauvegarde nocturne), offres gratuites.
- Domaine : un `.fr` ; le site sur le domaine nu, le CMS sur `cms.` du même domaine (nécessaire au cookie de prévisualisation partagé).

Le VPS-1 (2 vCores, 4 Go, 4,57 € TTC) suffirait au fonctionnement courant mais laisse peu de marge pour la construction des images et la conversion de grandes photos. Il reste l’option de repli si le budget l’exige ; le passage de l’un à l’autre se fait sans changer l’installation.

## Coût mensuel estimé

| Poste | Offre | € TTC/mois |
| --- | --- | --- |
| Serveur | OVHcloud VPS-2, mensuel | 8,65 (tarif d’appel relevé le 10/10/2026) |
| Domaine | `.fr`, prix annuel de renouvellement / 12 | à relever à la commande (ordre de grandeur : 1) |
| Stockage des sauvegardes | Object Storage, environ 20 Go | moins de 1 |
| Certificats, surveillance | Let’s Encrypt, UptimeRobot, Healthchecks.io | 0 |
| **Total estimé** | | **environ 11 (plafond 30)** |

La sauvegarde quotidienne incluse dans le VPS (dernières 24 h) est un complément, pas la sauvegarde du média : elle disparaît avec le serveur et ne permet pas de revenir plusieurs jours en arrière.

## Conditions à vérifier avant la commande

- Prix de renouvellement après la période promotionnelle, durée d’engagement et frais d’installation.
- Région du VPS et région du bucket (différentes).
- Prix de renouvellement du domaine (pas seulement la première année).
- Facturation de la sortie de données de l’Object Storage en cas de restauration.

## Relevé à la commande

| Poste | Prix TTC/mois réellement payé | Engagement | Renouvellement | Date |
| --- | --- | --- | --- | --- |
| Serveur | | | | |
| Domaine | | | | |
| Stockage | | | | |

## Alternatives écartées

- Hetzner CX23/CX33 : tarifs comparables mais offres indiquées indisponibles lors de la consultation, IPv4 et TVA en sus.
- Directus Cloud ou un hébergement géré : au-dessus du plafond pour ce niveau d’usage, et le MCP OAuth y dépend de l’offre.
- Site statique séparé (CDN) : inutile au lancement, le site est rendu par le même serveur.

## Conséquences

- La maintenance (mises à jour, surveillance, restauration) est documentée dans `docs/exploitation/`.
- Les secrets de production et le mot de passe restic sont aussi conservés hors du serveur (gestionnaire de mots de passe de l’utilisateur).
```

The "Relevé à la commande" table is filled in Task 4 Step 1 with the real invoice values.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0002-hebergement.md
git diff --cached --check
git commit -m "docs(adr): choose the V1 hosting and budget"
```

---

### Task 2: Container images

**Files:**
- Create: `Dockerfile`, `.dockerignore`

**Interfaces:**
- Consumes: the workspace from plans 1 and 2 (`pnpm-lock.yaml`, `directus-extension-editorial`, `@my-media/site`, `@my-media/cms-provision`).
- Produces: build targets `directus` (Directus 12.5.0 with the extension in `/directus/extensions/editorial`, writable `/directus/public-media`), `site` (Astro server on port 4321, user `node`), `provision` (runs `node src/main.ts` in `cms/provision`).

- [ ] **Step 1: Run the checks to see them fail**

Run: `docker build --target site -t my-media/site:check .`
Expected: FAIL with `failed to read dockerfile: open Dockerfile: no such file or directory`.

- [ ] **Step 2: Write the Dockerfile**

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS workspace
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile

FROM workspace AS extension-build
RUN pnpm --filter directus-extension-editorial build

FROM workspace AS site-build
RUN pnpm --filter @my-media/site build \
  && pnpm --filter @my-media/site deploy --legacy --prod /out/site

FROM directus/directus:12.5.0 AS directus
USER root
RUN mkdir -p /directus/public-media && chown node:node /directus/public-media
USER node
COPY --from=extension-build --chown=node:node /workspace/cms/extensions/editorial/package.json /directus/extensions/editorial/package.json
COPY --from=extension-build --chown=node:node /workspace/cms/extensions/editorial/dist /directus/extensions/editorial/dist

FROM node:24-alpine AS site
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
WORKDIR /app
COPY --from=site-build --chown=node:node /out/site/node_modules ./node_modules
COPY --from=site-build --chown=node:node /workspace/site/dist ./dist
COPY --chown=node:node site/package.json ./package.json
USER node
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]

FROM workspace AS provision
WORKDIR /workspace/cms/provision
USER node
CMD ["node", "src/main.ts"]
```

`pnpm deploy --prod` gives the site only its runtime dependencies; `dist/` is copied separately because it is gitignored and therefore not part of what `deploy` copies. The `public-media` directory is created in the Directus image so that the named volume mounted there inherits the `node` owner on first use.

`.dockerignore`:

```text
.git
.env
ops/*.env
**/node_modules
**/dist
**/.astro
**/test-results
**/playwright-report
.data
.superpowers
docs
```

- [ ] **Step 3: Build the three targets and inspect them**

Run:

```bash
docker build --target directus -t my-media/directus:check .
docker build --target site -t my-media/site:check .
docker build --target provision -t my-media/provision:check .
docker run --rm --entrypoint ls my-media/directus:check /directus/extensions/editorial/dist
docker run --rm --entrypoint stat my-media/directus:check -c '%U' /directus/public-media
docker run --rm --entrypoint id my-media/site:check -un
```

Expected: three successful builds; `ls` lists `api.js` (or the entry named in the extension manifest); `stat` prints `node`; `id` prints `node`.

Run the site image on its own and request a media file name that does not exist (this route reads no CMS data, so it shows that the server starts):

```bash
docker run -d --name site-check -p 4399:4321 -e DIRECTUS_URL=http://127.0.0.1:9 -e DIRECTUS_PUBLIC_URL=http://127.0.0.1:9 -e PUBLIC_MEDIA_DIR=/tmp my-media/site:check
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4399/media/00000000-0000-4000-8000-000000000000.webp
docker rm -f site-check
```

Expected: `404`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git diff --cached --check
git commit -m "build: add production images for Directus, the site and provisioning"
```

---

### Task 3: Production stack and smoke checks, rehearsed locally

**Files:**
- Create: `ops/compose.production.yaml`, `ops/Caddyfile`, `ops/production.env.example`
- Create: `ops/scripts/lib.sh`, `ops/scripts/compose-production.sh`, `ops/scripts/smoke.sh`
- Modify: `.gitignore`, `package.json` (root script `lint:ops`)

**Interfaces:**
- Consumes: the images from Task 2; plan 1 provisioning variables.
- Produces:
  - `ops/scripts/compose-production.sh <compose arguments…>`: runs `docker compose` on project `my-media-production` with `MEDIA_ENV_FILE` (default `/opt/my-media/shared/production.env`).
  - `ops/scripts/smoke.sh <site-url> <cms-url> [--insecure]`: exit 0 when every public check passes, 1 otherwise.
  - `lib.sh`: `read_env_value <file> <name>`, `media_volume_name <short-name>`.
  - Volumes `my-media-production_database`, `_uploads`, `_public-media`, `_caddy-data`, `_caddy-config`.

- [ ] **Step 1: Write the smoke checks**

`ops/scripts/smoke.sh`:

```bash
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
```

Run: `chmod +x ops/scripts/smoke.sh && ops/scripts/smoke.sh https://site.localhost https://cms.localhost --insecure`
Expected: FAIL: every check prints `reçu 000` (nothing listens yet) and the script exits 1.

- [ ] **Step 2: Write the shared helpers and the compose wrapper**

`ops/scripts/lib.sh`:

```bash
#!/usr/bin/env bash
# Helpers shared by the operation scripts. Source this file; do not run it.

readonly MEDIA_PROJECT=my-media-production

# Prints the value of NAME from a dotenv file (last definition wins).
read_env_value() {
  local file="$1"
  local name="$2"
  grep -E "^${name}=" "$file" | tail -n 1 | cut -d '=' -f 2-
}

# Prints the Docker volume name of a production volume, for example "uploads".
media_volume_name() {
  echo "${MEDIA_PROJECT}_$1"
}
```

`ops/scripts/compose-production.sh`:

```bash
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
```

- [ ] **Step 3: Write the production stack**

`ops/compose.production.yaml`:

```yaml
name: my-media-production

services:
  database:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: directus
      POSTGRES_USER: directus
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - database:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U directus -d directus"]
      interval: 10s
      timeout: 5s
      retries: 20
    networks:
      - backend

  directus:
    build:
      context: ..
      target: directus
    image: my-media/directus:${RELEASE:-local}
    restart: unless-stopped
    depends_on:
      database:
        condition: service_healthy
    volumes:
      - uploads:/directus/uploads
      - public-media:/directus/public-media
    environment:
      SECRET: ${DIRECTUS_SECRET:?DIRECTUS_SECRET is required}
      PUBLIC_URL: https://${CMS_DOMAIN:?CMS_DOMAIN is required}
      DB_CLIENT: pg
      DB_HOST: database
      DB_PORT: "5432"
      DB_DATABASE: directus
      DB_USER: directus
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      ADMIN_EMAIL: ${ADMIN_EMAIL:?ADMIN_EMAIL is required}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}
      ADMIN_TOKEN: ${ADMIN_TOKEN:?ADMIN_TOKEN is required}
      CACHE_ENABLED: "false"
      WEBSOCKETS_ENABLED: "false"
      EXTENSIONS_AUTO_RELOAD: "false"
      TELEMETRY: "false"
      LOG_LEVEL: info
      IP_TRUST_PROXY: "true"
      SESSION_COOKIE_SECURE: "true"
      REFRESH_TOKEN_COOKIE_SECURE: "true"
      SESSION_COOKIE_DOMAIN: ${COOKIE_DOMAIN:-}
      CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC: "'self',https://${SITE_DOMAIN:?SITE_DOMAIN is required}"
      ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION: "12000"
      PUBLIC_MEDIA_PATH: /directus/public-media
      AI_ROLE_ID: ${AI_ROLE_ID:?AI_ROLE_ID is required}
      MCP_OAUTH_ENABLED: ${MCP_OAUTH_ENABLED:-false}
      MCP_OAUTH_CIMD_ENABLED: ${MCP_OAUTH_CIMD_ENABLED:-false}
      MCP_OAUTH_DCR_ENABLED: ${MCP_OAUTH_DCR_ENABLED:-false}
      MCP_OAUTH_CIMD_ALLOWED_DOMAINS: ${MCP_OAUTH_CIMD_ALLOWED_DOMAINS:-}
      MCP_OAUTH_ALLOWED_REDIRECT_DOMAINS: ${MCP_OAUTH_ALLOWED_REDIRECT_DOMAINS:-}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8055/server/ping || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s
    networks:
      - backend
      - edge

  site:
    build:
      context: ..
      target: site
    image: my-media/site:${RELEASE:-local}
    restart: unless-stopped
    depends_on:
      directus:
        condition: service_healthy
    environment:
      DIRECTUS_URL: http://directus:8055
      DIRECTUS_PUBLIC_URL: https://${CMS_DOMAIN}
      PUBLIC_MEDIA_DIR: /srv/public-media
    volumes:
      - public-media:/srv/public-media:ro
    read_only: true
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4321/').then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 10s
    networks:
      - edge

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      site:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    environment:
      SITE_DOMAIN: ${SITE_DOMAIN}
      CMS_DOMAIN: ${CMS_DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL:?ACME_EMAIL is required}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - edge

  provision:
    build:
      context: ..
      target: provision
    image: my-media/provision:${RELEASE:-local}
    profiles:
      - tools
    depends_on:
      directus:
        condition: service_healthy
    environment:
      DIRECTUS_URL: http://directus:8055
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      SITE_URL: https://${SITE_DOMAIN}
      EDITOR_EMAIL: ${EDITOR_EMAIL:?EDITOR_EMAIL is required}
      EDITOR_PASSWORD: ${EDITOR_PASSWORD:?EDITOR_PASSWORD is required}
      EDITOR_ROLE_ID: ${EDITOR_ROLE_ID:?EDITOR_ROLE_ID is required}
      AI_EMAIL: ${AI_EMAIL:?AI_EMAIL is required}
      AI_PASSWORD: ${AI_PASSWORD:?AI_PASSWORD is required}
      AI_ROLE_ID: ${AI_ROLE_ID}
      AI_APP_ACCESS: ${AI_APP_ACCESS:-false}
      MCP_OAUTH_ENABLED: ${MCP_OAUTH_ENABLED:-false}
      MCP_OAUTH_CIMD_ENABLED: ${MCP_OAUTH_CIMD_ENABLED:-false}
      MCP_OAUTH_DCR_ENABLED: ${MCP_OAUTH_DCR_ENABLED:-false}
    networks:
      - edge

volumes:
  database:
  uploads:
  public-media:
  caddy-data:
  caddy-config:

networks:
  backend:
    internal: true
  edge:
```

Notes for the reviewer:
- Only Caddy publishes ports. The database sits on an internal network with no internet access; Directus is on both networks because it fetches OAuth client metadata (CIMD) and imports files from URLs.
- `SESSION_COOKIE_DOMAIN` is the shared parent domain (`example.fr`), so the Directus session cookie set on `cms.example.fr` reaches the site's `/apercu/…` route (plan 2, Task 7).
- `CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC` lets the Studio's split-screen preview frame the site; Directus reads comma-separated values as a list.
- The site runs on a read-only filesystem with the media volume mounted read-only: it cannot alter a published file.
- `provision` sits in the `tools` profile: `up` never starts it; `run --rm provision` does. It receives no `EDITOR_TOKEN` or `AI_TOKEN`, so plan 1 provisioning removes any static token from those accounts.
- `ADMIN_TOKEN` stays in the server's `production.env` (mode 600) because provisioning needs it; it grants full administration, so it is treated like the admin password (see `docs/exploitation/mise-en-production.md`).

`ops/Caddyfile`:

```caddyfile
{
	email {$ACME_EMAIL}
}

{$SITE_DOMAIN} {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Content-Security-Policy "frame-ancestors 'self' https://{$CMS_DOMAIN}"
		-Server
	}
	reverse_proxy site:4321
}

www.{$SITE_DOMAIN} {
	redir https://{$SITE_DOMAIN}{uri} permanent
}

{$CMS_DOMAIN} {
	encode zstd gzip
	request_body {
		max_size 100MB
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		-Server
	}
	reverse_proxy directus:8055
}
```

`frame-ancestors` lets only the site itself and the CMS frame the site (Studio live preview).

`ops/production.env.example`:

```dotenv
# Production settings. Copy to /opt/my-media/shared/production.env on the server (chmod 600).
# Generate each secret with: openssl rand -hex 32
SITE_DOMAIN=example.fr
CMS_DOMAIN=cms.example.fr
COOKIE_DOMAIN=example.fr
ACME_EMAIL=contact@example.fr

POSTGRES_PASSWORD=
DIRECTUS_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_TOKEN=

EDITOR_EMAIL=
EDITOR_PASSWORD=
EDITOR_ROLE_ID=2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42

AI_EMAIL=
AI_PASSWORD=
AI_ROLE_ID=6f1d1f4e-2b7a-4c55-9f58-4c1b3e8a9d21
# Value decided in docs/validation/2026-10-mcp-clients.md
AI_APP_ACCESS=false

# Enabled at go-live (Task 8), with the domains observed in docs/validation/2026-10-mcp-clients.md
MCP_OAUTH_ENABLED=false
MCP_OAUTH_CIMD_ENABLED=false
MCP_OAUTH_DCR_ENABLED=false
MCP_OAUTH_CIMD_ALLOWED_DOMAINS=
MCP_OAUTH_ALLOWED_REDIRECT_DOMAINS=
```

Append to `.gitignore`:

```gitignore
ops/*.env
```

Add to the root `package.json` `scripts`:

```json
    "lint:ops": "shellcheck --external-sources ops/scripts/*.sh"
```

- [ ] **Step 4: Validate the configuration files**

Run:

```bash
brew install shellcheck
chmod +x ops/scripts/*.sh
pnpm lint:ops
cp ops/production.env.example ops/rehearsal.env
```

Edit `ops/rehearsal.env`: `SITE_DOMAIN=site.localhost`, `CMS_DOMAIN=cms.localhost`, `COOKIE_DOMAIN=` (empty: browsers refuse a `localhost` cookie domain), `ACME_EMAIL=ops@example.com`, every empty secret and password set to the output of `openssl rand -hex 32`, `ADMIN_EMAIL=admin@example.com`, `EDITOR_EMAIL=redaction@example.com`, `AI_EMAIL=assistant@example.com`.

Run:

```bash
MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/compose-production.sh config --quiet
docker run --rm -v "$PWD/ops/Caddyfile:/etc/caddy/Caddyfile:ro" -e SITE_DOMAIN=site.localhost -e CMS_DOMAIN=cms.localhost -e ACME_EMAIL=ops@example.com caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Expected: ShellCheck prints nothing; `config --quiet` prints nothing and exits 0; Caddy prints `Valid configuration`.

- [ ] **Step 5: Rehearse the production stack locally**

Stop the development stack first (it uses port 8055, not 80/443, but shares the machine's memory): `pnpm cms:down`.

Run:

```bash
MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/compose-production.sh up -d --build --wait
MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/compose-production.sh run --rm provision
ops/scripts/smoke.sh https://site.localhost https://cms.localhost --insecure
```

Expected: all services healthy (Caddy issues local certificates for `*.localhost` from its internal authority); provisioning ends with its final log line; every smoke check prints `ok` and the script ends with `Toutes les vérifications sont passées.`

- [ ] **Step 6: Check publication through the production volumes**

1. Open `https://cms.localhost/admin` (accept the local certificate), sign in with the rehearsal `EDITOR_EMAIL` / `EDITOR_PASSWORD`.
2. Create an article with a title, a slug, a short text and one uploaded photo as image 1 (with alt text), then click "Publier".
3. Open `https://site.localhost/articles/<slug>`.

Expected: the article renders with its photo; the image address is `/media/<uuid>.webp` and loads. This proves the Directus container writes the shared volume and the read-only site container serves it.

The Studio preview is not checked in this rehearsal: browsers refuse a `localhost` cookie domain, so the session cookie of `cms.localhost` is never sent to `site.localhost` and the preview answers "Page introuvable". It is checked in production, where `COOKIE_DOMAIN` is the shared parent domain (Task 8, Step 5).

- [ ] **Step 7: Stop the rehearsal**

Run: `MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/compose-production.sh down`
Expected: containers removed; volumes kept for Task 6.

- [ ] **Step 8: Commit**

```bash
git add ops/compose.production.yaml ops/Caddyfile ops/production.env.example ops/scripts/lib.sh ops/scripts/compose-production.sh ops/scripts/smoke.sh .gitignore package.json
git diff --cached --check
git commit -m "feat(ops): add the production stack and smoke checks"
```

---

### Task 4: Server bootstrap and first deployment

**Files:**
- Create: `ops/scripts/bootstrap-server.sh`, `ops/scripts/deploy.sh`, `ops/scripts/server-release.sh`
- Modify: `docs/adr/0002-hebergement.md` ("Relevé à la commande")

**Interfaces:**
- Consumes: Tasks 2–3; a VPS reachable by SSH with the owner's public key on a sudo-capable administration account (OVHcloud Debian images: `debian`); DNS records.
- Produces: user `media` (Docker group, SSH key only, no sudo), `/opt/my-media/{releases,shared}`; `deploy.sh <ssh-destination>` (run from the laptop on a clean committed tree); `server-release.sh <release-dir>` (run on the server by `deploy.sh`).

- [ ] **Step 1: Order the server and the domain (project owner)**

The project owner orders the VPS chosen in ADR 0002 (Debian 13, French datacenter, their SSH public key installed at creation) and the domain, then fills the "Relevé à la commande" table in `docs/adr/0002-hebergement.md` from the invoices.

At the registrar, create `A` records for `example.fr`, `www.example.fr` and `cms.example.fr` (the real domain) pointing to the VPS IPv4 address. Keep the TTL low (300 s) until go-live.

Run: `dig +short cms.example.fr`
Expected: the VPS address (propagation can take a few minutes).

- [ ] **Step 2: Write the bootstrap script**

`ops/scripts/bootstrap-server.sh`:

```bash
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
```

Two accounts result: the provider's administration account (`debian`, with sudo) for root tasks such as installing the backup, and `media` (no sudo, member of `docker`) for deployments. Docker publishes container ports through its own firewall rules, which ufw does not filter; the stack publishes only 80 and 443 (Caddy), so the two layers agree. SSH is hardened last, after `media` has received the administrator's key. If the provider only gives `root`, first create the administration account: `adduser debian && usermod -aG sudo debian && install -d -m 700 -o debian -g debian /home/debian/.ssh && install -m 600 -o debian -g debian /root/.ssh/authorized_keys /home/debian/.ssh/`.

- [ ] **Step 3: Write the release scripts**

`ops/scripts/deploy.sh`:

```bash
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

echo "Envoi de la version $RELEASE vers $DESTINATION…"
git archive --format=tar HEAD | ssh "$DESTINATION" "mkdir -p '$RELEASE_DIR' && tar -x -C '$RELEASE_DIR'"

echo "Mise en service sur le serveur…"
ssh "$DESTINATION" "RELEASE='$RELEASE' '$RELEASE_DIR/ops/scripts/server-release.sh' '$RELEASE_DIR'"
```

`ops/scripts/server-release.sh`:

```bash
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
"$COMPOSE" up -d --wait --remove-orphans
"$COMPOSE" run --rm provision
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | tail -n +$((KEPT_RELEASES + 1)) \
  | cut -d ' ' -f 2- \
  | xargs -r rm -rf

"$RELEASE_DIR/ops/scripts/smoke.sh" "https://$SITE_DOMAIN" "https://$CMS_DOMAIN"
echo "Version $RELEASE en service."
```

`git archive` keeps the executable bit of the scripts. Rolling back means checking out an earlier commit on the laptop and running `deploy.sh` again; volumes are untouched by a release.

Run: `chmod +x ops/scripts/*.sh && pnpm lint:ops`
Expected: no output.

- [ ] **Step 4: Bootstrap the server**

Run: `ssh debian@<server-ip> 'sudo bash -s' < ops/scripts/bootstrap-server.sh`
Expected: the firewall status lists `22/tcp (OpenSSH)`, `80/tcp`, `443/tcp`, `443/udp` as `ALLOW IN`, then `Serveur prêt.`

In a second terminal, run: `ssh media@<server-ip> 'docker compose version && id'`
Expected: a Compose v2 version and `groups=…docker…`.

Run: `ssh root@<server-ip> true`
Expected: `Permission denied (publickey)`: root login is closed.

Run: `ssh -o PasswordAuthentication=yes -o PubkeyAuthentication=no media@<server-ip> true`
Expected: `Permission denied (publickey)`: passwords are refused.

- [ ] **Step 5: Install the production settings**

On the laptop, create the real settings from `ops/production.env.example` in the password manager (real domain, contact address, every secret generated with `openssl rand -hex 32`, `AI_APP_ACCESS` from `docs/validation/2026-10-mcp-clients.md`, the three `MCP_OAUTH_*_ENABLED` still `false`). Then:

Run: `ssh media@<server-ip> 'umask 077 && cat > /opt/my-media/shared/production.env' < /path/to/production.env && ssh media@<server-ip> 'stat -c "%a %U" /opt/my-media/shared/production.env'`
Expected: `600 media`.

- [ ] **Step 6: Deploy the first release**

Run: `ops/scripts/deploy.sh media@<server-ip>`
Expected: images built on the server, services healthy, provisioning applied, every smoke check `ok` against `https://example.fr` and `https://cms.example.fr`, then `Version <commit> en service.` Caddy obtains the Let's Encrypt certificates on the first requests (allow a minute).

Run: `curl -sI https://example.fr | grep -i strict-transport-security`
Expected: `strict-transport-security: max-age=31536000`.

- [ ] **Step 7: Commit**

```bash
git add ops/scripts/bootstrap-server.sh ops/scripts/deploy.sh ops/scripts/server-release.sh docs/adr/0002-hebergement.md
git diff --cached --check
git commit -m "feat(ops): bootstrap the server and deploy releases over SSH"
```

---

### Task 5: Off-site backups

**Files:**
- Create: `ops/backup.env.example`, `ops/scripts/backup.sh`, `ops/systemd/media-backup.service`, `ops/systemd/media-backup.timer`

**Interfaces:**
- Consumes: `compose-production.sh`, `media_volume_name` (Task 3); the running production stack.
- Produces: restic snapshots tagged `my-media` with `directus.dump` (Postgres custom format), the `uploads` and `public-media` volume contents and `production.env`; retention 7 daily, 4 weekly, 6 monthly; a Healthchecks.io ping (`/start`, success, `/fail`).

- [ ] **Step 1: Create the bucket and the heartbeat check (project owner)**

1. In the OVHcloud Public Cloud console, create an Object Storage container (S3 API) named `my-media-backups` in a region other than the VPS (for example Strasbourg `sbg` if the VPS is in Gravelines), and an S3 user with read and write access to it only.
2. On Healthchecks.io, create a check "Sauvegarde my-media": period 1 day, grace 2 hours, email alert to the owner. Copy its ping URL.
3. Generate the restic password: `openssl rand -hex 32`. Store it, the S3 keys and the ping URL in the password manager: without the restic password the backups cannot be read.

- [ ] **Step 2: Write the failing check**

Run: `ssh debian@<server-ip> 'restic version && sudo test -f /etc/my-media/backup.env'`
Expected: FAIL: restic prints its version, then `test` exits 1 (no backup settings yet).

- [ ] **Step 3: Write the backup script and units**

`ops/backup.env.example`:

```dotenv
# Copy to /etc/my-media/backup.env on the server (root, chmod 600).
RESTIC_REPOSITORY=s3:https://s3.sbg.io.cloud.ovh.net/my-media-backups
RESTIC_PASSWORD=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=sbg
HEALTHCHECK_URL=
```

`ops/scripts/backup.sh`:

```bash
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

# shellcheck source=lib.sh
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
```

The dump is written under a temporary directory whose name changes every night; restic records its path, and `restore.sh` finds the dump by name.

`ops/systemd/media-backup.service`:

```ini
[Unit]
Description=Sauvegarde du média (base, fichiers, réglages)
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
EnvironmentFile=/etc/my-media/backup.env
Environment=MEDIA_ENV_FILE=/opt/my-media/shared/production.env
ExecStart=/opt/my-media/current/ops/scripts/backup.sh
Nice=10
IOSchedulingClass=idle
```

`ops/systemd/media-backup.timer`:

```ini
[Unit]
Description=Sauvegarde quotidienne du média

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
```

Run: `pnpm lint:ops`
Expected: no output.

- [ ] **Step 4: Commit and deploy the scripts**

```bash
git add ops/backup.env.example ops/scripts/backup.sh ops/systemd
git diff --cached --check
git commit -m "feat(ops): back up the database and media to off-site storage"
ops/scripts/deploy.sh media@<server-ip>
```

Expected: release deployed, smoke checks `ok`.

- [ ] **Step 5: Install the backup on the server**

Run `ssh debian@<server-ip>` then `sudo -i`, and in that root shell:

```bash
install -d -m 700 /etc/my-media
install -m 600 /dev/null /etc/my-media/backup.env
# paste the values from the password manager into /etc/my-media/backup.env
set -a && . /etc/my-media/backup.env && set +a && restic init
install -m 644 /opt/my-media/current/ops/systemd/media-backup.service /etc/systemd/system/
install -m 644 /opt/my-media/current/ops/systemd/media-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now media-backup.timer
systemctl start media-backup.service
```

- [ ] **Step 6: Check the first snapshot**

Run (same root shell): `journalctl -u media-backup.service -n 30 --no-pager && set -a && . /etc/my-media/backup.env && set +a && restic snapshots --tag my-media`
Expected: the service log ends with `no errors were found` (from `restic check`); one snapshot listed with the four paths. Healthchecks.io shows the check as "up" with one ping.

Run (same root shell): `systemctl list-timers media-backup.timer`
Expected: the next run is scheduled between 03:30 and 04:00.

---

### Task 6: Restore script and restore drill

**Files:**
- Create: `ops/scripts/restore.sh`, `docs/exploitation/sauvegarde-et-restauration.md`, `docs/validation/restauration.md`

**Interfaces:**
- Consumes: restic snapshots (Task 5), `compose-production.sh`, `media_volume_name`.
- Produces: `restore.sh <snapshot-id|latest> --confirm-overwrite` (replaces the database and both volumes of the stack selected by `MEDIA_ENV_FILE`, then restarts it); a dated drill record.

- [ ] **Step 1: Prepare a recognisable drill marker in production**

In the production Studio (editor account), create and publish an article titled `Essai de restauration <date>` with one photo. Then run the backup on demand: `ssh debian@<server-ip> 'sudo systemctl start media-backup.service'`.
Expected: a new snapshot in `restic snapshots --tag my-media`.

- [ ] **Step 2: Write the restore script**

`ops/scripts/restore.sh`:

```bash
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

# shellcheck source=lib.sh
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

echo "Lecture de l’instantané $SNAPSHOT…"
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
```

The volume copy runs inside a throwaway container, so the same script works on the server and on a laptop where Docker volumes live inside a virtual machine. `production.env` is restored separately (see the runbook) because it decides which stack the script targets.

Run: `chmod +x ops/scripts/restore.sh && pnpm lint:ops && ops/scripts/restore.sh latest`
Expected: ShellCheck silent; the script refuses with exit code 2 and the `--confirm-overwrite` message.

- [ ] **Step 3: Run the drill on the laptop rehearsal stack**

The drill restores the production snapshot into the local rehearsal stack from Task 3, so production is never touched.

```bash
brew install restic
set -a && . /path/to/backup.env && set +a          # copy of /etc/my-media/backup.env from the password manager
MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/compose-production.sh up -d --wait
time MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/restore.sh latest --confirm-overwrite
ops/scripts/smoke.sh https://site.localhost https://cms.localhost --insecure
```

Expected: `Base restaurée.`, both `Volume … restauré.` lines, `Restauration terminée.`; smoke checks all `ok`.

Then:
1. Open `https://site.localhost/articles/<slug of the drill article>`: title and photo displayed.
2. Sign in at `https://cms.localhost/admin` with the production editor credentials: the drill article and the other production content are present.
3. Compare counts: `curl -sk "https://site.localhost/recherche"` and the production `https://example.fr/recherche` list the same articles.

- [ ] **Step 4: Write the runbook and the drill record**

`docs/exploitation/sauvegarde-et-restauration.md`:

```markdown
# Sauvegarde et restauration

## Ce qui est sauvegardé

Chaque nuit entre 3 h 30 et 4 h (`media-backup.timer`), `ops/scripts/backup.sh` envoie vers le bucket restic :

- l’export de la base Postgres (`directus.dump`) ;
- les fichiers déposés dans Directus (volume `uploads`) ;
- les copies publiques des images publiées (volume `public-media`) ;
- les réglages de production (`/opt/my-media/shared/production.env`), chiffrés comme le reste par restic.

Rétention : 7 sauvegardes quotidiennes, 4 hebdomadaires, 6 mensuelles. Healthchecks.io alerte par e-mail si la sauvegarde n’a pas réussi depuis 26 heures.

Le mot de passe restic, les clés S3 et le contenu de `backup.env` sont dans le gestionnaire de mots de passe : sans eux, les sauvegardes sont illisibles.

Les commandes « en root » se lancent depuis le compte d’administration : `ssh debian@<serveur>` puis `sudo -i`.

## Lancer une sauvegarde à la demande

En root sur le serveur : `systemctl start media-backup.service`, puis `journalctl -u media-backup.service -n 30`.

## Lister les sauvegardes

En root : `set -a && . /etc/my-media/backup.env && set +a && restic snapshots --tag my-media`.

## Restaurer sur le serveur existant

1. Prévenir : le site et le CMS sont indisponibles pendant l’opération (quelques minutes).
2. En root : charger `backup.env` comme ci-dessus.
3. `MEDIA_ENV_FILE=/opt/my-media/shared/production.env /opt/my-media/current/ops/scripts/restore.sh <instantané|latest> --confirm-overwrite`
4. `/opt/my-media/current/ops/scripts/smoke.sh https://<domaine> https://cms.<domaine>`

## Reconstruire sur un nouveau serveur

1. Commander un VPS, lancer `ssh debian@<nouvelle-adresse> 'sudo bash -s' < ops/scripts/bootstrap-server.sh`, faire pointer le DNS vers la nouvelle adresse.
2. En root, installer `restic` (déjà fait par le script) et `/etc/my-media/backup.env` depuis le gestionnaire de mots de passe.
3. Récupérer les réglages : `restic restore latest --tag my-media --include /opt/my-media/shared/production.env --target /`, puis `chown media:media /opt/my-media/shared/production.env && chmod 600 /opt/my-media/shared/production.env`.
4. Depuis le poste : `ops/scripts/deploy.sh media@<nouvelle-adresse>` (le premier déploiement crée une base vide).
5. En root : restaurer comme ci-dessus (étapes 2 à 4 de la section précédente), puis réinstaller le timer de sauvegarde (plan 3, Task 5, Step 5).

## Essai de restauration

Refaire l’essai au moins une fois par trimestre, sur la répétition locale (`ops/rehearsal.env`), et le consigner dans `docs/validation/restauration.md`.
```

`docs/validation/restauration.md`:

```markdown
# Essai de restauration

| Date | Instantané | Cible | Durée de `restore.sh` | Article témoin visible | Images visibles | Contenu identique à la production | Vérifications `smoke.sh` | Opérateur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | répétition locale | | | | | | |

Écarts constatés et corrections : …
```

Fill the first row from Step 3 (snapshot id from `restic snapshots`, duration from `time`).

- [ ] **Step 5: Stop the rehearsal and commit**

Run: `MEDIA_ENV_FILE=ops/rehearsal.env ops/scripts/compose-production.sh down -v`
Expected: containers and rehearsal volumes removed (they hold a copy of production data).

```bash
git add ops/scripts/restore.sh docs/exploitation/sauvegarde-et-restauration.md docs/validation/restauration.md
git diff --cached --check
git commit -m "feat(ops): restore backups and record the first restore drill"
```

---

### Task 7: Monitoring and maintenance

**Files:**
- Create: `docs/exploitation/surveillance-et-mises-a-jour.md`

**Interfaces:**
- Consumes: the production domains, the Healthchecks.io check (Task 5).
- Produces: two UptimeRobot monitors with email alerts, a tested alert, and the maintenance procedure.

- [ ] **Step 1: Create the monitors (project owner)**

On UptimeRobot (free plan), create:
1. Keyword monitor "Site" — `https://example.fr/`, keyword: the media name, interval 5 min.
2. Keyword monitor "CMS" — `https://cms.example.fr/server/ping`, keyword `pong`, interval 5 min (Directus 12 refuses `/server/health` to anonymous callers).

Alert contact: the owner's email for both.

- [ ] **Step 2: Test an alert**

Run: `ssh media@<server-ip> '/opt/my-media/current/ops/scripts/compose-production.sh stop site'`
Expected: within 10 minutes, an UptimeRobot "Site down" email.

Run: `ssh media@<server-ip> '/opt/my-media/current/ops/scripts/compose-production.sh start site'`
Expected: an "up" email at the next check.

- [ ] **Step 3: Write the monitoring and maintenance runbook**

`docs/exploitation/surveillance-et-mises-a-jour.md`:

```markdown
# Surveillance et mises à jour

## Alertes

| Alerte | Source | Première action |
| --- | --- | --- |
| « Site down » | UptimeRobot, toutes les 5 min | `ssh media@<serveur>` puis `/opt/my-media/current/ops/scripts/compose-production.sh ps` et `… logs --tail 100 site` |
| « CMS down » | UptimeRobot, toutes les 5 min | même chose avec `directus`, puis `database` |
| « Sauvegarde my-media » en retard ou en échec | Healthchecks.io, quotidien | `ssh debian@<serveur>` puis `sudo journalctl -u media-backup.service -n 50` |

Redémarrer un service : `compose-production.sh restart <service>`. Ne jamais lancer `down -v` en production : l’option supprime les volumes.

## Mises à jour automatiques

Les correctifs de sécurité Debian s’installent chaque jour (`unattended-upgrades`). Si `/var/run/reboot-required` existe, redémarrer à une heure creuse : les conteneurs repartent seuls (`restart: unless-stopped`).

## Revue mensuelle (15 minutes)

1. `df -h /` : alerte si plus de 80 % utilisés ; nettoyer avec `docker image prune -a --filter "until=720h"`.
2. `restic snapshots --tag my-media` (root, voir ci-dessous) : une sauvegarde par jour.
3. Notes de version et avis de sécurité Directus (`https://github.com/directus/directus/releases`, `https://github.com/directus/directus/security/advisories`).
4. `apt list --upgradable` puis `apt full-upgrade` (root) si des paquets attendent.

Les commandes « root » se lancent depuis le compte d’administration : `ssh debian@<serveur>` puis `sudo -i`. Le compte `media` sert aux déploiements et n’a pas de droits root.

## Mettre à jour Directus

1. Lire les notes de version entre 12.5.0 et la cible ; repérer les changements sur le MCP, les flows, les permissions et la licence Core (3 sièges, 25 collections, 5 flows).
2. Sur une branche : remplacer `directus/directus:12.5.0` dans `compose.yaml` et `Dockerfile`, et la version attendue dans `cms/tests/src/server.test.ts`.
3. En local : `pnpm cms:up && pnpm provision && pnpm test && pnpm test:cms && pnpm test:e2e`.
4. Lancer une sauvegarde à la demande en production, puis `ops/scripts/deploy.sh media@<serveur>`.
5. Refaire un essai de connexion MCP depuis Claude et ChatGPT.

## Mettre à jour Postgres, Caddy, Node

`postgres:17-alpine`, `caddy:2-alpine` et `node:24-alpine` suivent leurs correctifs : chaque déploiement (`deploy.sh`) récupère leur dernière version (`pull` et `build --pull` dans `server-release.sh`). Changer de version majeure de Postgres demande un export et une restauration : suivre `docs/exploitation/sauvegarde-et-restauration.md`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/exploitation/surveillance-et-mises-a-jour.md
git diff --cached --check
git commit -m "docs(ops): document monitoring and maintenance"
```

---

### Task 8: Go-live

**Files:**
- Create: `docs/exploitation/mise-en-production.md`, `docs/validation/mise-en-service.md`

**Interfaces:**
- Consumes: everything above; `docs/validation/2026-10-mcp-clients.md` (OAuth domains, `AI_APP_ACCESS`); the real editorial settings from the owner (spec §13).
- Produces: production MCP OAuth enabled and tested with the real Claude and ChatGPT accounts; a sign-off record against every §12 acceptance row.

- [ ] **Step 1: Enter the real editorial settings (project owner)**

In the production Studio as the editor: "Réglages du média" (name, contact email, presentation, legal notice with the publication director and the host's name and address), "Ligne éditoriale", rubriques, watch sources. The demo content from development is not imported (spec §13).

Run: `curl -s https://example.fr/a-propos | grep -c 'Mentions légales'`
Expected: `1` or more, and the page shows the legal notice text.

- [ ] **Step 2: Enable MCP OAuth with allowlists**

In the password manager copy of `production.env`, set:

```dotenv
MCP_OAUTH_ENABLED=true
MCP_OAUTH_CIMD_ENABLED=true
MCP_OAUTH_DCR_ENABLED=true
MCP_OAUTH_CIMD_ALLOWED_DOMAINS=<domains observed for Claude in docs/validation/2026-10-mcp-clients.md, comma-separated>
MCP_OAUTH_ALLOWED_REDIRECT_DOMAINS=<redirect domains observed for Claude and ChatGPT, comma-separated>
```

Directus accepts exact names and `*.domain` patterns in both lists. Install it and redeploy:

```bash
ssh media@<server-ip> 'umask 077 && cat > /opt/my-media/shared/production.env' < /path/to/production.env
ops/scripts/deploy.sh media@<server-ip>
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://cms.example.fr/mcp
```

Expected: release deployed, smoke checks `ok`; the MCP request answers `401`.

- [ ] **Step 3: Check that no static token remains**

In the Studio as admin, open the "Rédaction" and "Assistant IA" users: the token field is empty for both (provisioning removed them because `production.env` has no `EDITOR_TOKEN` or `AI_TOKEN`).

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <EDITOR_TOKEN from the local .env>" https://cms.example.fr/users/me`
Expected: `401`.

- [ ] **Step 4: Connect the real assistants to production**

1. Claude: remove the test connector from plan 1, add `https://cms.example.fr/mcp`, sign in as the production assistant account, approve.
2. ChatGPT: same with its connector (if the Plus plan allowed it in plan 1, Task 9).
3. With each client: "Lis le protocole de la rédaction et la ligne éditoriale, puis prépare un brouillon de test intitulé « Essai de connexion production » avec une source." Check the draft in the Studio.
4. With each client: "Publie ce brouillon." Expected: refusal or tool error; no published version created.
5. Delete the test drafts in the Studio.

If a connection fails with `redirect_uri domain is not in the allowlist` or a CIMD domain refusal, read the domain in `ssh media@<server-ip> '/opt/my-media/current/ops/scripts/compose-production.sh logs --tail 200 directus'`, add it to the matching list, redeploy and retry; record the change.

- [ ] **Step 5: Check the preview and the site in production**

1. In the Studio as the editor, open a draft and its preview: the draft renders on `https://example.fr/apercu/<id>` with the banner, both in a new tab and in the split-screen panel.
2. In a private window, open the same address: "Page introuvable".
3. On a phone (real device, mobile network): home, a rubrique, the search, an article and its sources, the about page.

Expected: as described. If the preview shows "Page introuvable" while signed in, check that `COOKIE_DOMAIN` equals the site domain and that the cookie `directus_session_token` in the browser has `Domain=example.fr`.

- [ ] **Step 6: Re-check the Directus licence and version**

Repeat plan 1 Task 10 Step 3 on today's date (latest release, security advisories since 12.5.0, licence terms, Core limits and current usage: collections, flows, active users). If a security fix applies to 12.5.0, follow the Directus update procedure in `docs/exploitation/surveillance-et-mises-a-jour.md` before announcing the site.

- [ ] **Step 7: Write the production runbook**

`docs/exploitation/mise-en-production.md`:

```markdown
# Mise en production et déploiements

## Architecture

Un VPS (voir `docs/adr/0002-hebergement.md`) fait tourner, avec Docker Compose (`ops/compose.production.yaml`) :

- Caddy : HTTPS automatique pour `<domaine>` (site), `www.<domaine>` (redirection) et `cms.<domaine>` (Directus) ;
- le site Astro, en lecture seule ;
- Directus 12.5.0 avec l’extension `editorial` ;
- Postgres 17, sur un réseau interne sans accès à Internet.

Fichiers sur le serveur : `/opt/my-media/current` (version en service), `/opt/my-media/releases/` (5 dernières versions), `/opt/my-media/shared/production.env` (secrets, 600), `/etc/my-media/backup.env` (sauvegarde, root, 600).

Comptes sur le serveur : `media` (clé SSH, groupe `docker`, sans sudo) pour déployer ; `debian` (clé SSH, sudo) pour l’administration système. Connexion root et mots de passe SSH refusés. Préparer un nouveau serveur : `ssh debian@<adresse> 'sudo bash -s' < ops/scripts/bootstrap-server.sh`.

## Déployer une nouvelle version

Depuis le poste, sur un dépôt sans modification en cours :

    ops/scripts/deploy.sh media@<serveur>

Le script envoie le code commité, construit les images sur le serveur, redémarre ce qui a changé, applique `pnpm provision` (schéma, accès, flow « Publier », réglages MCP) et lance les vérifications publiques. Revenir en arrière : se placer sur le commit précédent et relancer la même commande.

## Modifier un réglage de production

Modifier la copie de `production.env` du gestionnaire de mots de passe, l’envoyer (`ssh media@<serveur> 'umask 077 && cat > /opt/my-media/shared/production.env' < production.env`), puis redéployer.

## Secrets

- `ADMIN_TOKEN` donne tous les droits sur Directus ; il ne quitte jamais le serveur et le gestionnaire de mots de passe. En cas de doute, en générer un nouveau dans le Studio (compte admin) et mettre à jour `production.env`.
- Les comptes « Rédaction » et « Assistant IA » n’ont pas de jeton statique en production ; l’assistant se connecte par OAuth MCP.
- Les deux comptes humains et l’assistant occupent au plus 3 sièges (limite Directus Core).

## Connecter un assistant

Adresse MCP : `https://cms.<domaine>/mcp`, connexion avec le compte « Assistant IA ». Les domaines autorisés sont dans `MCP_OAUTH_CIMD_ALLOWED_DOMAINS` et `MCP_OAUTH_ALLOWED_REDIRECT_DOMAINS`. Un nouveau client refusé apparaît dans les journaux Directus avec le domaine à ajouter.

## Voir aussi

- `docs/exploitation/sauvegarde-et-restauration.md`
- `docs/exploitation/surveillance-et-mises-a-jour.md`
```

- [ ] **Step 8: Write the go-live sign-off**

`docs/validation/mise-en-service.md`:

```markdown
# Mise en service — <date>

Version déployée : <commit>. Domaine : <domaine>.

| Critère (spec §12) | Résultat | Preuve |
| --- | --- | --- |
| Parcours manuel | | `docs/validation/2026-10-parcours-manuel.md` |
| Parcours MCP | | `docs/validation/2026-10-mcp-clients.md` ; connexion production (étape 4) |
| Images par assistant | | `docs/validation/2026-10-mcp-clients.md` |
| Refus de publication IA | | tests `cms/tests` (`access`, `publication`, `mcp`) ; refus en production (étape 4) |
| Liberté du publieur humain | | test « publie malgré des points ouverts » ; parcours manuel |
| Confidentialité | | tests `access` et site (`article`, `navigation`, `preview`) ; `smoke.sh` en production |
| Correction | | tests « brouillon de révision isolé » et « republication » |
| Reprise | | tests de clé de création ; scénario de reprise des clients |
| Erreur de publication | | test de retour arrière ; parcours manuel, étape 5 |
| Sources publiques | | test site `article` ; vérification sur téléphone (étape 5) |
| Présentation | | `docs/validation/2026-10-site-public.md` ; vérification sur téléphone (étape 5) |
| Exploitation | | `docs/adr/0002-hebergement.md` (relevé réel) ; `docs/validation/restauration.md` |

## Coût mensuel réel

Total TTC : … € (plafond 30 €).

## Licence et version

Vérifiées le … : …

## Réserves

- …

Décision de mise en ligne : prise par … le …
```

Fill every cell with "Conforme" or the observed gap, the real total from the ADR table, and the licence check result. The site is announced only after the owner writes the decision line.

- [ ] **Step 9: Final verification and commit**

Run:

```bash
pnpm lint:ops
ops/scripts/smoke.sh https://example.fr https://cms.example.fr
git diff --check
```

Expected: ShellCheck silent; all smoke checks `ok`; no whitespace error.

```bash
git add docs/exploitation/mise-en-production.md docs/validation/mise-en-service.md
git diff --cached --check
git commit -m "docs(ops): record the production go-live"
```

---

## Self-review

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| §11 small server holding Directus, database, site and files | 1 (ADR), 2–4 |
| §11 HTTPS | 3 (Caddy), 4 (certificates checked) |
| §11 backups of database and media, restore procedure | 5, 6 |
| §11 uptime monitoring | 5 (backup heartbeat), 7 |
| §11 budget under 30 €/month with renewal conditions | 1, 4 (real invoice), 8 (sign-off) |
| §11 licence and version recheck before installation | 8 (plan 1 Task 10 did the first check) |
| §7 no secret in the site, anonymous refusals | 3 (site holds no token; `smoke.sh` checks anonymous 403 on every private collection, files, users, flows and MCP) |
| §7 assistant connects with its dedicated account through OAuth | 8 (no static tokens, real clients) |
| §6 authenticated preview in production | 3 (cookie domain, frame policy), 8 |
| §12 "Exploitation" acceptance | 1, 4, 6, 8 |
| §12 the full acceptance table | 8 (sign-off referencing plans 1 and 2 evidence) |
| §13 real settings entered by the owner, demo content not imported | 8 |

**Placeholder scan:** commands and files are complete. Angle-bracket values (`<server-ip>`, the real domain, observed OAuth domains) and the blank cells in the evidence records are values only known at execution time; each step says where they come from. `example.fr` stands for the real domain throughout.

**Consistency:** project name `my-media-production` is set once in `compose.production.yaml` and once in `lib.sh` (`MEDIA_PROJECT`), and volume names in `backup.sh` and `restore.sh` go through `media_volume_name`. `MEDIA_ENV_FILE` is the only switch between production and the local rehearsal. The cookie name `directus_session_token` matches plan 2. The variables required by `compose.production.yaml` are exactly those listed in `production.env.example`.
