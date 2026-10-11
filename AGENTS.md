# My Media — instructions du dépôt

Média indépendant : Directus 12 (CMS, API, MCP) et site Astro SSR, dans un monorepo pnpm (`cms/*`, `site`). Lire `GLOSSARY.md` et `docs/developpement-local.md` avant de modifier le code.

## Changer `main`

- Toujours passer par une PR. `main` est protégé : PR obligatoire, checks `Checks` et `Integration` verts, pas de force push. Personne ne contourne ces règles.
- Branches `feat/`, `fix/` ou `chore/`, jamais `codex/`. Commits Conventional Commits en anglais.
- Avant de pousser, lancer les mêmes vérifications que la CI (`.github/workflows/ci.yml`) :

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build:extension && pnpm --filter @my-media/site build && pnpm lint:shell
pnpm cms:up && pnpm provision && pnpm test:cms && pnpm test:e2e   # stack locale requise
```

## CI/CD

Décisions : `docs/superpowers/specs/2026-10-11-cicd-design.md`. Exploitation : `docs/exploitation/livraison.md`.

- Chaque PR non-draft reçoit une preview (`my-media-pr-<n>.apps.nyhasinavalona.com`, CMS sur `cms.…`), détruite à la fermeture. Le staging suit `main`. La production ne part que par « Deploy production », avec approbation humaine.
- `deploy/` décrit la livraison sur le socle `vps-services` (Compose, Ansible, contrôles publics). Ne rien y ajouter que le socle refuse : voir `vps-services/docs/APP-CONTRACT.md`.
- Le schéma Directus est du code (`cms/provision`) et s'applique de façon idempotente à chaque livraison : pas de modification manuelle de schéma dans un Directus déployé.
- Aucun secret dans Git, les journaux ou les sorties de commande.
