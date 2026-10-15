# My Media — repository instructions

Independent news site: Directus 12 (CMS, API, MCP) and an Astro SSR site, in a pnpm monorepo (`cms/*`, `site`). Read `GLOSSARY.md` and `docs/developpement-local.md` before changing code.

Write code, comments, and docs in plain English: short sentences, everyday words. Text that readers and editors see on the site or in the CMS stays in French.

## Changing `main`

- Always use a pull request. `main` is protected: PR required, checks `Checks` and `Integration` green, no force push. Nobody bypasses these rules.
- Use branches `feat/`, `fix/`, or `chore/`, never `codex/`. Commits use Conventional Commits in English.
- Before pushing, run the same checks as CI (`.github/workflows/ci.yml`):

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build:extension && pnpm --filter @my-media/site build && pnpm lint:shell
pnpm cms:up && pnpm provision && pnpm test:cms && pnpm test:e2e   # local stack required
```

## CI/CD

Decisions: `docs/superpowers/specs/2026-10-11-cicd-design.md`. Operations: `docs/exploitation/livraison.md`.

- Each non-draft PR gets a preview (`my-media-pr-<n>.apps.nyhasinavalona.com`, CMS on `cms.…`), removed when the PR closes. Staging follows `main`. Production only runs via “Deploy production”, with human approval.
- `deploy/` describes delivery on the `vps-services` platform (Compose, Ansible, public checks). Do not add anything the platform rejects: see `vps-services/docs/APP-CONTRACT.md`.
- The Directus schema is code (`cms/provision`) and applies idempotently on every delivery: no manual schema changes on a deployed Directus.
- No secrets in Git, logs, or command output.
