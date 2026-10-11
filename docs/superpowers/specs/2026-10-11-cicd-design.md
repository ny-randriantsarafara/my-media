# CI/CD de The Media sur le socle `vps-services`

Date : 11 octobre 2026. Statut : décisions validées par l'utilisateur (séance de questions du 11/10/2026) ; implémentation autorisée.

## 1. Résultat attendu

Chaque changement proposé, en particulier par un agent, est testé automatiquement puis visible sur une preview publique avant d'être fusionné. `main` est toujours vert et tourne en staging. La production reçoit, sur décision humaine, exactement les images déjà validées en staging.

Le dispositif reste simple : GitHub Actions, GHCR et le rôle `ny.vps.app` du socle. Pas de service tiers, pas de daemon de déploiement. Un humain seul doit pouvoir le comprendre et le maintenir.

## 2. Décisions

| # | Sujet | Décision |
| --- | --- | --- |
| 1 | Modèle de déploiement | The Media adopte le contrat de `vps-services` : images construites en CI, publiées sur GHCR, transmises par digest à `vpsctl`. Aucun build sur le VPS, pas de Caddy applicatif. |
| 2 | Environnements | CI sur chaque PR et sur `main`, preview par PR, staging automatique sur `main`, production manuelle. |
| 3 | Visibilité | `my-media` devient public (historique scanné : aucun secret). Images GHCR publiques, tirées sans authentification. |
| 4 | Domaine | `apps.nyhasinavalona.com`, wildcard DNS `*.apps` vers le VPS, sans proxy Cloudflare. |
| 5 | Tests en CI | Deux checks requis : « Checks » (types, unitaires, builds, ShellCheck) et « Integration » (Postgres + Directus réels, provisionnement, tests CMS, Playwright). |
| 6 | Deux hostnames | Le socle accepte plusieurs routes par instance : `<instance>.<domaine>` et `<préfixe>.<instance>.<domaine>` (§4). |
| 7 | Promotion | Staging après CI verte sur `main`. Production : workflow manuel, approbation obligatoire, mêmes digests que le staging. |
| 8 | Previews | Automatiques pour chaque PR non-draft du dépôt ; détruites à la fermeture. Une place refusée fait échouer un check non requis. |
| 9 | Données | Previews et staging : schéma + jeu de démo chargé seulement si la base est vide. Production : jamais de démo. |
| 10 | Secrets | Environnements GitHub `nonprod` (staging et previews) et `production` (approbation, branche `main`). |
| 11 | Données existantes | Aucune : le média n'a jamais été en ligne. |
| 12 | Sauvegardes | Chantier séparé, **bloquant avant d'ouvrir la production au public**. |
| 13 | Protection de `main` | Ruleset : PR obligatoire, les deux checks requis, pas de force push, aucun contournement. |
| 14 | Ressources | Plafonds du socle conservés ; mesurés à la première livraison, ajustés par PR du socle si nécessaire. |
| 15 | Domaine de prod | `my-media.apps.nyhasinavalona.com` et `cms.my-media.apps.nyhasinavalona.com`. Domaine de marque plus tard. |
| 16 | Ancien outillage | Supprimé : scripts de déploiement, bootstrap, Caddyfile, Compose de production, sauvegarde/restauration restic (historique Git). |
| 17 | Rollback | Relancer « Deploy production » avec l'identifiant d'un ancien run de `main`. |
| 18 | Maintenance | Dependabot mensuel groupé (Actions, images Docker, npm) ; correctifs de sécurité immédiats. Collection `ny.vps` montée à la main. |

### Écart assumé par rapport à la séance

La séance avait retenu des noms `<instance>-<suffixe>` (`my-media-pr-42-cms`). En lisant le site, on constate que l'aperçu des brouillons lit le cookie de session Directus sur le domaine du site, donc ce cookie doit couvrir le site **et** le CMS. Avec des noms côte à côte, le seul parent commun est `apps.nyhasinavalona.com` : le cookie de session de la production serait envoyé à toutes les previews, dont le code n'est pas encore relu. Le schéma imbriqué `cms.my-media-pr-42.apps…` reproduit l'ancien couple `example.fr` / `cms.example.fr` : le cookie est posé sur le domaine du site de l'instance et ne sort pas de cette instance. Il est aussi sans collision par construction. Le wildcard Cloudflare `*.apps` couvre plusieurs niveaux, donc un seul enregistrement DNS suffit.

## 3. Vue d'ensemble

```text
PR (non-draft, même dépôt)
  ├─ ci.yml        Checks + Integration                      (requis pour fusionner)
  └─ preview.yml   images → apply my-media-pr-<n> → smoke    (non requis)
                   fermeture → destroy

push main
  └─ ci.yml        Checks + Integration → images → apply my-media-staging → smoke
                   → artefact « release » (digests)

manuel
  └─ production.yml  approbation → artefact « release » d'un run de main
                     → apply my-media-prod → smoke
```

| Instance | Site | CMS (Directus) | Compte SSH |
| --- | --- | --- | --- |
| `my-media-pr-<n>` | `my-media-pr-<n>.apps.nyhasinavalona.com` | `cms.my-media-pr-<n>.apps.nyhasinavalona.com` | `my-media-nonprod` |
| `my-media-staging` | `my-media-staging.apps.nyhasinavalona.com` | `cms.my-media-staging.apps.nyhasinavalona.com` | `my-media-nonprod` |
| `my-media-prod` | `my-media.apps.nyhasinavalona.com` | `cms.my-media.apps.nyhasinavalona.com` | `my-media-prod` |

## 4. Évolution du socle (`vps-services`)

Porté par une PR du dépôt `vps-services` et décrit dans sa propre spec.

- **Routes multiples.** Une instance garde son hostname principal `<label>.<domaine>` (`label` = nom de l'instance, sans `-prod` en production). Elle peut aussi publier `<préfixe>.<label>.<domaine>`, où `préfixe` est un mot DNS simple (`[a-z][a-z0-9]*`, 32 caractères au plus). Chaque hostname apparaît au plus une fois par instance. Deux instances distinctes ont des labels distincts : leurs hostnames ne peuvent pas se recouvrir.
- **Readiness.** La sonde loopback et la sonde publique couvrent toutes les routes de l'instance, pas seulement la principale.
- **Domaine.** `vps_domain: apps.nyhasinavalona.com`.
- **Comptes.** `my-media-nonprod` (`staging`, `preview`) et `my-media-prod` (`prod`), avec une clé publique dédiée chacun.
- **DNS.** `*.apps.nyhasinavalona.com` en A et AAAA vers le VPS, `proxied: false` : Caddy obtient lui-même les certificats.
- **CICD.md.** L'automatisation décrite ici devient la règle approuvée pour cette application.

## 5. Images

Un seul package GHCR public, `ghcr.io/ny-randriantsarafara/my-media`, avec les trois cibles du `Dockerfile` en tags : `directus-<sha>`, `site-<sha>` et `provision-<sha>`. Un seul package : un seul réglage de visibilité à faire. Le build utilise Buildx et le cache GitHub Actions. Le label `org.opencontainers.image.source` lie le package au dépôt. Les déploiements n'utilisent que les digests ; les tags servent à la lecture humaine.

`images.yml` (workflow réutilisable) construit et pousse les trois images. Il produit `release.json` :

```json
{"commit": "<sha>", "directus": "ghcr.io/…@sha256:…", "site": "ghcr.io/…@sha256:…", "provision": "ghcr.io/…@sha256:…"}
```

## 6. Livraison sur le socle

Fichiers dans `deploy/` :

- `compose.yml.j2` : rendu sur le runner par `ny.vps.app`, dans le sous-ensemble Compose accepté par le socle :
  - `database` : Postgres 17 par digest, `user: "70:70"`, sonde TCP ;
  - `directus` : image `directus` ;
  - `provision` : image `provision`, job `x-vps-init`, relancé à chaque livraison et idempotent ; il crée la démo si `DEMO_CONTENT=true` ;
  - `site` : image `site`, volume `public-media` en lecture seule.
- `ansible/deploy.yml` : vérifie les entrées, puis appelle `ny.vps.app`.
- `ansible/environments/{preview,staging,prod}.yml` : compte SSH, budgets, routes, démo.
- `ansible/requirements.yml` : collection `ny.vps` épinglée au SHA complet d'un commit revu de `vps-services`.
- `ansible/inventory.yml` et `ansible/known_hosts` : hôte et empreinte publique du VPS. La connexion échoue si l'empreinte change.
- `requirements.txt` : `ansible-core` épinglé, installé avec `--require-hashes`.
- `smoke.sh` : contrôles HTTP publics (ancien `ops/scripts/smoke.sh`), avec une attente initiale pour les certificats.

Budgets initiaux, job d'init compris :

| Service | Preview / staging | Production |
| --- | --- | --- |
| database | 0,1 vCPU / 192 Mo | 0,4 vCPU / 768 Mo |
| directus | 0,2 vCPU / 448 Mo | 0,6 vCPU / 1280 Mo |
| site | 0,1 vCPU / 192 Mo | 0,3 vCPU / 512 Mo |
| provision | 0,1 vCPU / 192 Mo | 0,2 vCPU / 256 Mo |
| **Total** | **0,5 vCPU / 1024 Mo** | **1,5 vCPU / 2816 Mo** |

Génération de livraison : `run_id × 100 + run_attempt`, croissante entre les runs et entre les relances. Les livraisons de preview passent `app_reopen: true` : une preview expirée ou fermée puis rouverte renaît. Une livraison en retard reste refusée, puisque sa génération est inférieure au tombstone.

### Effets de la suppression du Caddy applicatif

Le Caddy du socle ne fait que du reverse proxy. Les en-têtes de sécurité passent dans les applications :

- le site ajoute HSTS, `X-Content-Type-Options`, `Referrer-Policy` et `Content-Security-Policy: frame-ancestors 'self' <CMS>` (middleware Astro) ;
- Directus active `HSTS_ENABLED`. `SESSION_COOKIE_DOMAIN` vaut le hostname du site de l'instance.

## 7. Workflows

Toutes les actions sont épinglées par SHA complet. Les permissions sont minimales et `persist-credentials: false` est appliqué.

- **`ci.yml`** (`pull_request`, `push` sur `main`, manuel)
  - `Checks` : `pnpm install --frozen-lockfile`, `typecheck`, `test`, build de l'extension et du site, ShellCheck.
  - `Integration` : `.env` aux secrets aléatoires (`scripts/ci/write-env.sh`), `pnpm cms:up`, `pnpm provision`, `pnpm test:cms`, Chromium Playwright, `pnpm test:e2e`.
  - Sur `push` `main` seulement : `images`, puis `staging` (`deploy.yml`, environnement `nonprod`), puis l'artefact `release`.
- **`preview.yml`** (`pull_request` : `opened`, `reopened`, `synchronize`, `ready_for_review`, `closed`)
  - Ignoré pour les drafts et les forks.
  - Sinon : `images`, `apply` de `my-media-pr-<n>`, smoke, commentaire unique sur la PR avec les URL.
  - À la fermeture : `destroy`.
  - Concurrence par PR, sans annuler une livraison en cours.
- **`production.yml`** (manuel, entrée facultative `run_id`)
  - Retrouve le dernier run réussi de `ci.yml` sur `main`, ou celui demandé, et télécharge son artefact `release`.
  - `apply` de `my-media-prod` dans l'environnement `production` (approbation), puis smoke.
- **`deploy.yml`** (réutilisable) : Python, `ansible-core`, collection, clé SSH en fichier `0600` dans `RUNNER_TEMP`, fichier de secrets JSON `0600`, playbook, smoke, nettoyage.

## 8. Secrets

| Environnement GitHub | Secrets | Variables |
| --- | --- | --- |
| `nonprod` (toutes branches) | `VPS_SSH_PRIVATE_KEY`, `POSTGRES_PASSWORD`, `DIRECTUS_SECRET`, `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `EDITOR_PASSWORD`, `AI_PASSWORD` | `ADMIN_EMAIL`, `EDITOR_EMAIL`, `AI_EMAIL` |
| `production` (`main`, reviewer requis) | mêmes noms, valeurs distinctes | mêmes noms |

Les mêmes secrets `nonprod` existent comme secrets Dependabot : les PR Dependabot n'ont pas accès aux secrets d'environnement. Les valeurs sont générées une fois (`openssl rand -hex 32`). Leur copie lisible pour la connexion humaine reste sur le poste du propriétaire, hors Git, en `0600`. Les jetons `EDITOR_TOKEN` et `AI_TOKEN` ne sont jamais définis sur le VPS.

## 9. Garanties et limites

- `main` ne reçoit que des PR aux deux checks verts.
- Une PR non relue n'atteint jamais la production : le workflow de prod ne s'exécute que depuis `main`, avec approbation.
- Le code d'une PR du dépôt s'exécute avec les secrets `nonprod`. C'est accepté : ces secrets ne protègent que des données de démo.
- Un agent qui utilise le jeton GitHub du propriétaire peut, techniquement, approuver un déploiement. Le ruleset et l'environnement protègent des erreurs, pas d'un jeton compromis.
- Sans sauvegardes (décision 12), la production ne doit héberger que du contenu jetable.
- Deux previews au plus sur tout le VPS. Une troisième PR obtient un check preview rouge : il suffit de fermer ou de passer en draft une autre PR, puis de relancer.

## 10. Livraisons

1. `my-media` : spec, plan, CI, `AGENTS.md`. Fusion, passage en public, ruleset.
2. `vps-services` : routes multiples, domaine, comptes. Fusion, DNS wildcard, `make platform`.
3. `my-media` : images, `deploy/`, démo, en-têtes, previews et staging ; suppression de l'ancien outillage.
4. `my-media` : workflow de production et première mise en production.

Chaque étape est vérifiée sur les vrais services : run GitHub, `vpsctl status`, HTTP public.
