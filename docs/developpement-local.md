# Développement local

Prérequis : Node 24, pnpm 10 (`corepack enable`), Docker.

1. `cp .env.example .env`, puis remplacer chaque valeur `change-me…` par `openssl rand -hex 32`.
2. `pnpm install`
3. `pnpm build:extension` — construit l’extension `editorial` (clé de création, publication). À exécuter avant `pnpm cms:up` et `pnpm test:cms` : Directus charge le hook et l’opération depuis `cms/extensions/editorial/dist/`.
4. `pnpm cms:up` — Postgres et Directus sur http://localhost:8055.
5. `pnpm provision` — collections, accès, flow « Publier », réglages MCP. Relançable sans risque.
6. `pnpm test` (tests unitaires) et `pnpm test:cms` (tests d’intégration contre le Directus local).

Pendant le développement de l’extension : `pnpm --filter directus-extension-editorial dev`. Directus recharge l’extension à chaque construction.

Repartir de zéro : `docker compose down -v && rm -rf .data`, puis les étapes 3 à 5.

Comptes locaux : administrateur, « Rédaction » et « Assistant IA », définis dans `.env`. Les jetons `EDITOR_TOKEN` et `AI_TOKEN` n’existent qu’en local pour les tests ; en production l’assistant se connecte uniquement par OAuth MCP.

Tester avec Claude ou ChatGPT : voir `docs/validation/2026-10-mcp-clients.md` (créé lors de l’essai des clients réels ; tunnel HTTPS et réglages OAuth).
