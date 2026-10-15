# Local development

Requirements: Node 24, pnpm 10 (`corepack enable`), Docker.

1. `cp .env.example .env`, then replace each `change-me…` value with `openssl rand -hex 32`.
2. `pnpm install`
3. `pnpm build:extension` — builds the `editorial` extension (creation key, publication). Required before `pnpm test:cms`; `pnpm cms:up` runs this too. Directus loads the hook and operation from `cms/extensions/editorial/dist/`.
4. `pnpm cms:up` — builds the extension, then Postgres and Directus at http://localhost:8055.
5. `pnpm provision` — collections, access, “Publier” flow, MCP settings. Safe to run again.
6. `pnpm test` (unit tests) and `pnpm test:cms` (integration tests against local Directus).

While working on the extension: `pnpm --filter directus-extension-editorial dev`. Directus reloads the extension on each build.

Start fresh: `docker compose down -v && rm -rf .data`, then steps 3 through 5.

Local accounts: administrator, “Rédaction”, and “Assistant IA”, defined in `.env`. `EDITOR_TOKEN` and `AI_TOKEN` exist only locally for tests; in production the assistant connects only via MCP OAuth.

Testing with Claude or ChatGPT: see `docs/validation/2026-10-mcp-clients.md` (created when real clients were tried; HTTPS tunnel and OAuth settings).
