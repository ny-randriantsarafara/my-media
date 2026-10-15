# The Media CI/CD on the `vps-services` platform

Date: 11 October 2026. Status: decisions validated by the owner (Q&A session 11/10/2026); implemented 11/10/2026 (plan `docs/superpowers/plans/2026-10-11-cicd.md`).

## 1. Expected outcome

Every proposed change, especially from an agent, is tested automatically then visible on a public preview before merge. `main` stays green and runs in staging. Production receives, by human decision, exactly the images already validated in staging.

The setup stays simple: GitHub Actions, GHCR, and the `ny.vps.app` role on the platform. No third-party service, no deploy daemon. One person must be able to understand and maintain it.

## 2. Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Deployment model | The Media adopts the `vps-services` contract: images built in CI, published to GHCR, passed by digest to `vpsctl`. No build on the VPS, no app-level Caddy. |
| 2 | Environments | CI on each PR and on `main`, preview per PR, automatic staging on `main`, manual production. |
| 3 | Visibility | `my-media` becomes public (history scanned: no secrets). GHCR images public, pulled without auth. |
| 4 | Domain | `apps.nyhasinavalona.com`, wildcard DNS `*.apps` to the VPS, no Cloudflare proxy. |
| 5 | CI tests | Two required checks: “Checks” (types, unit, builds, ShellCheck) and “Integration” (real Postgres + Directus, provision, CMS tests, Playwright). |
| 6 | Two hostnames | The platform accepts multiple routes per instance: `<instance>.<domain>` and `<prefix>.<instance>.<domain>` (§4). |
| 7 | Promotion | Staging after green CI on `main`. Production: manual workflow, required approval, same digests as staging. |
| 8 | Previews | Automatic for each non-draft PR on this repo; destroyed on close. A refused slot fails a non-required check. |
| 9 | Data | Previews and staging: schema + demo loaded only if database is empty. Production: never demo. |
| 10 | Secrets | GitHub environments `nonprod` (staging and previews) and `production` (approval, branch `main`). |
| 11 | Existing data | None: the media was never live. |
| 12 | Backups | Separate work, **blocking before opening production to the public**. |
| 13 | `main` protection | Ruleset: PR required, both checks required, no force push, no bypass. |
| 14 | Resources | Platform caps kept; measured on first delivery, adjusted via platform PR if needed. |
| 15 | Prod domain | `my-media.apps.nyhasinavalona.com` and `cms.my-media.apps.nyhasinavalona.com`. Brand domain later. |
| 16 | Old tooling | Removed: deploy scripts, bootstrap, Caddyfile, production Compose, restic backup/restore (Git history). |
| 17 | Rollback | Re-run “Deploy production” with an older `main` run id. |
| 18 | Maintenance | Dependabot monthly groups (Actions, Docker images, npm); immediate security fixes. Collection `ny.vps` bumped manually. |

### Assumed gap vs session

The session had chosen names `<instance>-<suffix>` (`my-media-pr-42-cms`). Reading the site shows draft preview reads the Directus session cookie on the site domain, so that cookie must cover site **and** CMS. With side-by-side names, the only shared parent is `apps.nyhasinavalona.com`: production’s session cookie would be sent to all previews, whose code is not reviewed yet. Nested `cms.my-media-pr-42.apps…` mirrors the old `example.fr` / `cms.example.fr` pair: the cookie is set on the instance site domain and does not leave that instance. It is also collision-free by construction. Cloudflare wildcard `*.apps` covers multiple levels, so one DNS record suffices.

## 3. Overview

```text
PR (non-draft, same repo)
  ├─ ci.yml        Checks + Integration                      (required to merge)
  └─ preview.yml   images → apply my-media-pr-<n> → smoke    (not required)
                   close → destroy

push main
  └─ ci.yml        Checks + Integration → images → apply my-media-staging → smoke
                   → “release” artifact (digests)

manual
  └─ production.yml  approval → “release” artifact from a main run
                     → apply my-media-prod → smoke
```

| Instance | Site | CMS (Directus) | SSH account |
| --- | --- | --- | --- |
| `my-media-pr-<n>` | `my-media-pr-<n>.apps.nyhasinavalona.com` | `cms.my-media-pr-<n>.apps.nyhasinavalona.com` | `my-media-nonprod` |
| `my-media-staging` | `my-media-staging.apps.nyhasinavalona.com` | `cms.my-media-staging.apps.nyhasinavalona.com` | `my-media-nonprod` |
| `my-media-prod` | `my-media.apps.nyhasinavalona.com` | `cms.my-media.apps.nyhasinavalona.com` | `my-media-prod` |

## 4. Platform evolution (`vps-services`)

Delivered by a PR on `vps-services` and described in its own spec.

- **Multiple routes.** An instance keeps primary hostname `<label>.<domain>` (`label` = instance name, no `-prod` in production). It may also publish `<prefix>.<label>.<domain>`, where `prefix` is a simple DNS word (`[a-z][a-z0-9]*`, at most 32 characters). Each hostname appears at most once per instance. Two instances have distinct labels: hostnames cannot overlap.
- **Readiness.** Loopback and public probes cover all instance routes, not only the primary.
- **Domain.** `vps_domain: apps.nyhasinavalona.com`.
- **Accounts.** `my-media-nonprod` (`staging`, `preview`) and `my-media-prod` (`prod`), each with a dedicated public key.
- **DNS.** `*.apps.nyhasinavalona.com` A and AAAA to the VPS, `proxied: false`: Caddy obtains certificates itself.
- **CICD.md.** Automation described here becomes the approved rule for this application.

## 5. Images

One public GHCR package, `ghcr.io/ny-randriantsarafara/my-media`, with the three `Dockerfile` targets tagged `directus-<sha>`, `site-<sha>`, and `provision-<sha>`. One package: one visibility setting. Build uses Buildx and GitHub Actions cache. Label `org.opencontainers.image.source` links the package to the repo. Deployments use digests only; tags are for humans.

`images.yml` (reusable workflow) builds and pushes the three images. It outputs `release.json`:

```json
{"commit": "<sha>", "directus": "ghcr.io/…@sha256:…", "site": "ghcr.io/…@sha256:…", "provision": "ghcr.io/…@sha256:…"}
```

## 6. Delivery on the platform

Files in `deploy/`:

- `compose.yml.j2`: rendered on the runner by `ny.vps.app`, within the Compose subset the platform accepts:
  - `database`: Postgres 17 by digest, `user: "70:70"`, TCP probe;
  - `directus`: `directus` image;
  - `provision`: `provision` image, `x-vps-init` job, re-run on every delivery, idempotent; creates demo if `DEMO_CONTENT=true`;
  - `site`: `site` image, `public-media` volume read-only.
- `ansible/deploy.yml`: validates inputs, then calls `ny.vps.app`.
- `ansible/environments/{preview,staging,prod}.yml`: SSH account, budgets, routes, demo.
- `ansible/requirements.yml`: collection `ny.vps` pinned to full SHA of a reviewed `vps-services` commit.
- `ansible/inventory.yml` and `ansible/known_hosts`: host and VPS public fingerprint. Connection fails if fingerprint changes.
- `requirements.txt`: pinned `ansible-core`, installed with `--require-hashes`.
- `smoke.sh`: public HTTP checks (former `ops/scripts/smoke.sh`), with initial wait for certificates.

Initial budgets, init job included:

| Service | Preview / staging | Production |
| --- | --- | --- |
| database | 0.1 vCPU / 192 MiB | 0.4 vCPU / 768 MiB |
| directus | 0.7 vCPU / 448 MiB | 0.6 vCPU / 1280 MiB |
| site | 0.1 vCPU / 192 MiB | 0.3 vCPU / 512 MiB |
| provision | 0.1 vCPU / 192 MiB | 0.2 vCPU / 256 MiB |
| **Total** | **1 vCPU / 1024 MiB** | **1.5 vCPU / 2816 MiB** |

Measurement 11/10/2026, with controller-normalized Compose and same limits: Directus takes more than 120 s to start at 0.2 vCPU, exceeding platform timeout, and 21 s at 0.7 vCPU. Memory stays around 205 MiB. As planned in decision 14, a platform PR moves previews and staging to 1 vCPU without changing memory.

Delivery generation: `run_id × 100 + run_attempt`, increasing across runs and retries. Preview deliveries pass `app_reopen: true`: an expired or closed then reopened preview is recreated. A stale delivery is still refused when its generation is below the tombstone.

### Effects of removing app Caddy

Platform Caddy is reverse proxy only. Security headers move into applications:

- the site adds HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and `Content-Security-Policy: frame-ancestors 'self' <CMS>` (Astro middleware);
- Directus enables `HSTS_ENABLED`. `SESSION_COOKIE_DOMAIN` is the instance site hostname.

## 7. Workflows

All actions pinned by full SHA. Permissions are minimal and `persist-credentials: false` is set.

- **`ci.yml`** (`pull_request`, `push` on `main`, manual)
  - `Checks`: `pnpm install --frozen-lockfile`, `typecheck`, `test`, extension and site build, ShellCheck.
  - `Integration`: `.env` with random secrets (`scripts/ci/write-env.sh`), `pnpm cms:up`, `pnpm provision`, `pnpm test:cms`, Playwright Chromium, `pnpm test:e2e`.
  - On `push` `main` only: `images`, then `staging` (`deploy.yml`, environment `nonprod`), then `release` artifact.
- **`preview.yml`** (`pull_request`: `opened`, `reopened`, `synchronize`, `ready_for_review`, `closed`)
  - Skipped for drafts and forks.
  - Otherwise: `images`, `apply` `my-media-pr-<n>`, smoke, single PR comment with URLs.
  - On close: `destroy`.
  - Concurrency per PR, without canceling an in-flight delivery.
- **`production.yml`** (manual, optional `run_id` input)
  - Finds latest successful `ci.yml` run on `main`, or the requested one, and downloads its `release` artifact.
  - `apply` `my-media-prod` in `production` environment (approval), then smoke.
- **`deploy.yml`** (reusable): Python, `ansible-core`, collection, SSH key in `0600` file under `RUNNER_TEMP`, secrets JSON `0600`, playbook, smoke, cleanup.

## 8. Secrets

| GitHub environment | Secrets | Variables |
| --- | --- | --- |
| `nonprod` (all branches) | `VPS_SSH_PRIVATE_KEY`, `POSTGRES_PASSWORD`, `DIRECTUS_SECRET`, `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `EDITOR_PASSWORD`, `AI_PASSWORD` | `ADMIN_EMAIL`, `EDITOR_EMAIL`, `AI_EMAIL` |
| `production` (`main`, reviewer required) | same names, different values | same names |

The same `nonprod` secrets exist as Dependabot secrets: Dependabot PRs do not get environment secrets. Values generated once (`openssl rand -hex 32`). Readable copy for human login stays on the owner machine, outside Git, at `0600`. `EDITOR_TOKEN` and `AI_TOKEN` are never set on the VPS.

## 9. Guarantees and limits

- `main` only receives PRs with both checks green.
- An unreviewed PR never reaches production: prod workflow runs only from `main`, with approval.
- Code from a repo PR runs with `nonprod` secrets. Accepted: those secrets protect demo data only.
- An agent with the owner’s GitHub token could technically approve a deploy. Ruleset and environment protect mistakes, not a compromised token.
- Without backups (decision 12), production must host only disposable content.
- At most two previews on the whole VPS. A third PR gets a red preview check: close or draft another PR, then re-run.

## 10. Delivery phases

1. `my-media`: spec, plan, CI, `AGENTS.md`. Merge, go public, ruleset.
2. `vps-services`: multiple routes, domain, accounts. Merge, wildcard DNS, `make platform`.
3. `my-media`: images, `deploy/`, demo, headers, previews and staging; remove old tooling.
4. `my-media`: production workflow and first production deploy.

Each step is verified on real services: GitHub run, `vpsctl status`, public HTTP.
