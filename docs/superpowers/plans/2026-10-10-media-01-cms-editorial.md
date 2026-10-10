# Média indépendant — Plan 1 : back-office éditorial Directus

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a local, reproducible Directus back office where an AI assistant prepares drafts over MCP, a human reviews and publishes, and only a coherent public copy is exposed.

**Architecture:** Directus 12.5.0 on Postgres runs in Docker Compose. A TypeScript provisioning script creates the schema, access policies, the "Publier" manual flow and the MCP settings through the Directus SDK, idempotently. A Directus bundle extension adds two server-side guards that Directus Core cannot express with permissions alone: a hook that requires a stable `creation_key` for assistant-created articles, and a `publish-article` operation that copies the working version into separate `published_*` collections and copies images into a public media directory, inside one database transaction, with the triggering user's permissions. Integration tests run against the local stack and prove the access matrix, the publication behaviour and the MCP restrictions.

**Tech Stack:** Docker Compose, Postgres 17, Directus 12.5.0, `@directus/sdk` 27.0.0, `@directus/extensions-sdk` 18.0.6, `@directus/types` 18.0.0, `@directus/errors` 3.0.0, Node 24 (native TypeScript execution), pnpm 10 workspaces, TypeScript ~6.0.3, Vitest 5, Zod 4, cloudflared (quick tunnel, validation only).

**Spec:** `docs/superpowers/specs/2026-10-10-media-independant-design.md` (read it before starting; also read `GLOSSARY.md`).

**Plan series:** This is plan 1 of 3. Plan 2 (`2026-10-10-media-02-public-site.md`) builds the public site on the `published_*` collections and the public media directory produced here. Plan 3 (`2026-10-10-media-03-hosting-operations.md`) hosts and operates both.

## Global Constraints

- CMS: "Utiliser Directus auto-hébergé comme CMS et son MCP natif avec OAuth pour Claude Pro et ChatGPT Plus." Pin the image `directus/directus:12.5.0`.
- Roles: "L'IA prépare des brouillons. Un humain relit et publie. Le site public n'affiche que la version publiée."
- Permissions: "L'interdiction de publier par l'IA est appliquée côté serveur, quel que soit le chemin utilisé : modification directe, modification groupée, changement de statut ou déclenchement de l'action de publication."
- Permissions: "Les politiques additives doivent être inspectées."
- Anonymous: "Un visiteur anonyme ne peut lire que les contenus publiés et les fichiers explicitement exposés. Il n'a pas accès aux brouillons, remarques, documents privés ou fichiers associés."
- Publication: "Le bouton Publier reste disponible même s'il reste des points à vérifier, des remarques ouvertes ou des sources incomplètes." No mandatory confirmation.
- Publication: "Les erreurs techniques sont affichées." and "Une publication échouée conserve le brouillon et l'ancienne version publique."
- Resumption: "Chaque création effectuée par l'IA porte une clé stable. La donnée a une contrainte d'unicité."
- Sources: "Les sources sont publiques." Private fields (`article_references.material`, `article_images.source_note`) never reach `published_*`.
- Copy: "Aucune mention publique de l'usage d'une IA." and "Aucune signature ou référence n'est inventée."
- Budget: "Coût cible : moins de 30 € par mois."
- Directus Core licence (no licence key) limits verified in the 12.5.0 source: 3 seats (active users with app or admin access), 25 collections, 5 flows, and **no custom permission rules**. Every permission row must be `fields: ['*']` with `permissions`, `validation` and `presets` all `null`, otherwise Directus throws `RESOURCE_RESTRICTED`. The design below never relies on item filters or field restrictions.
- Toolchain: Node 24, pnpm 10.32.1, TypeScript `~6.0.3` in every package (Astro tooling in plan 2 does not accept TypeScript 7).
- Code rules: no `any`, no `as` type assertions, no `@ts-ignore`, no mutation after initialisation, early returns instead of nested `if`, no readability-hurting ternaries, explicit error handling.
- Data rule from the design: one article belongs to exactly one section (`articles.section`, many-to-one). The spec lists "rubriques" without saying an article can belong to several; this plan picks the simpler model.
- Body conventions used by plans 1 and 2: `[^N]` cites the N-th source (by `sort`), `[[image:N]]` alone on a line places image N (N ≥ 2) in the text, image 1 is the lead image.

---

## File structure

```text
.
├── .env.example                        # local-only values, copied to .env
├── .gitignore
├── .nvmrc
├── compose.yaml                        # local Postgres + Directus
├── package.json                        # workspace scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docs/
│   ├── developpement-local.md          # Task 10
│   └── validation/                     # Tasks 9 and 10 evidence
└── cms/
    ├── schema/                         # @my-media/cms-schema — shared record types (type-only)
    │   └── src/index.ts
    ├── provision/                      # @my-media/cms-provision — idempotent setup script
    │   └── src/
    │       ├── main.ts
    │       ├── environment.ts
    │       ├── directus-client.ts
    │       ├── assistant-protocol.md
    │       ├── schema/{fields,collections,relations,ensure-schema}.ts
    │       ├── access/{policies,ensure-access}.ts
    │       ├── flows/ensure-publication-flow.ts
    │       └── settings/ensure-settings.ts
    ├── extensions/editorial/           # directus-extension-editorial — bundle extension
    │   └── src/
    │       ├── errors.ts
    │       ├── guards.ts
    │       ├── require-creation-key/{index,creation-key}.ts
    │       └── publish-article/{api,app,trigger,publication,public-media-store,publish}.ts
    └── tests/                          # @my-media/cms-tests — integration tests against local Directus
        └── src/
            ├── support/{environment,clients,errors,fixtures,publication,mcp}.ts
            └── {server,schema,access,limits,creation-key,publication,mcp}.test.ts
```

Responsibilities:

- `cms/schema` holds the TypeScript shape of every custom collection. Provisioning, tests and the public site seed import it with `import type`, so it has no runtime code.
- `cms/provision` is the only place that changes Directus configuration. Each `ensure-*` module owns one concern and is safe to run repeatedly.
- `cms/extensions/editorial` holds only rules that permissions cannot express. Pure logic (`publication.ts`, `trigger.ts`, `creation-key.ts`) is unit-tested; Directus I/O (`publish.ts`) is covered by integration tests.
- `cms/tests` proves behaviour end to end. It never changes configuration, only content, and uses unique suffixes so runs do not collide.

---

### Task 1: Workspace and local Directus stack

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`, `.env.example`, `compose.yaml`
- Modify: `.gitignore`
- Create: `cms/tests/package.json`, `cms/tests/tsconfig.json`, `cms/tests/vitest.config.ts`, `cms/tests/src/support/environment.ts`
- Test: `cms/tests/src/server.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: root scripts `cms:up`, `cms:down`, `build:extension`, `provision`, `test`, `test:cms`, `typecheck`; the `.env` variable names used by every later task; `testEnvironment` (`cms/tests/src/support/environment.ts`) with fields `directusUrl`, `adminToken`, `editorToken`, `assistantToken`, `assistantRoleId`, `editorRoleId`, `assistantAppAccess: boolean`, `publicMediaDirectory`.

- [ ] **Step 1: Initialise Git if needed and commit the existing documents**

The folder already contains the framing, research and design documents. If `git status` says it is not a repository:

```bash
git init -b main
git add GLOSSARY.md docs .gitignore
git commit -m "docs: add framing, research and V1 design"
```

- [ ] **Step 2: Create the workspace files**

`package.json`:

```json
{
  "name": "my-media",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.32.1",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "cms:up": "mkdir -p .data/public-media && docker compose up -d --wait",
    "cms:down": "docker compose down",
    "cms:logs": "docker compose logs -f directus",
    "build:extension": "pnpm --filter directus-extension-editorial build",
    "provision": "pnpm --filter @my-media/cms-provision start",
    "test": "pnpm -r --filter '!@my-media/cms-tests' --if-present test",
    "test:cms": "pnpm --filter @my-media/cms-tests test",
    "typecheck": "pnpm -r --if-present typecheck"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - cms/*
  - cms/extensions/*
onlyBuiltDependencies:
  - esbuild
```

`.nvmrc`:

```text
24
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Replace `.gitignore` with:

```gitignore
.superpowers/
.env
node_modules/
dist/
.data/
.astro/
test-results/
playwright-report/
```

- [ ] **Step 3: Create `.env.example` and your local `.env`**

`.env.example`:

```dotenv
# Local development only. Copy to .env and replace every "change-me" value.
# Generate secrets with: openssl rand -hex 32
POSTGRES_PASSWORD=change-me-postgres
DIRECTUS_SECRET=change-me-directus-secret
DIRECTUS_URL=http://localhost:8055
DIRECTUS_PUBLIC_URL=http://localhost:8055

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-admin
ADMIN_TOKEN=change-me-admin-token

EDITOR_EMAIL=redaction@example.com
EDITOR_PASSWORD=change-me-editor
EDITOR_TOKEN=change-me-editor-token
EDITOR_ROLE_ID=2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42

AI_EMAIL=assistant@example.com
AI_PASSWORD=change-me-assistant
AI_TOKEN=change-me-assistant-token
AI_ROLE_ID=6f1d1f4e-2b7a-4c55-9f58-4c1b3e8a9d21
AI_APP_ACCESS=false

SITE_URL=http://localhost:4321
PUBLIC_MEDIA_DIR=./.data/public-media

MCP_OAUTH_ENABLED=false
MCP_OAUTH_CIMD_ENABLED=false
MCP_OAUTH_DCR_ENABLED=false
MCP_OAUTH_CIMD_ALLOW_HTTP=false
```

Run: `cp .env.example .env`, then replace each `change-me…` value in `.env` with the output of `openssl rand -hex 32`. Keep the two role UUIDs as they are.

`EDITOR_TOKEN` and `AI_TOKEN` are static tokens for local tests only. Production never sets them (plan 3); the assistant then connects through MCP OAuth only.

- [ ] **Step 4: Create `compose.yaml`**

```yaml
name: my-media

services:
  database:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: directus
      POSTGRES_USER: directus
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - database:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U directus -d directus"]
      interval: 5s
      timeout: 5s
      retries: 20

  directus:
    image: directus/directus:12.5.0
    depends_on:
      database:
        condition: service_healthy
    ports:
      - "8055:8055"
    volumes:
      - uploads:/directus/uploads
      - ./.data/public-media:/directus/public-media
    environment:
      SECRET: ${DIRECTUS_SECRET:?DIRECTUS_SECRET is required}
      PUBLIC_URL: ${DIRECTUS_PUBLIC_URL:?DIRECTUS_PUBLIC_URL is required}
      DB_CLIENT: pg
      DB_HOST: database
      DB_PORT: "5432"
      DB_DATABASE: directus
      DB_USER: directus
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      CACHE_ENABLED: "false"
      WEBSOCKETS_ENABLED: "false"
      EXTENSIONS_AUTO_RELOAD: "true"
      ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION: "12000"
      PUBLIC_MEDIA_PATH: /directus/public-media
      AI_ROLE_ID: ${AI_ROLE_ID:?AI_ROLE_ID is required}
      MCP_OAUTH_ENABLED: ${MCP_OAUTH_ENABLED:-false}
      MCP_OAUTH_CIMD_ENABLED: ${MCP_OAUTH_CIMD_ENABLED:-false}
      MCP_OAUTH_DCR_ENABLED: ${MCP_OAUTH_DCR_ENABLED:-false}
      MCP_OAUTH_CIMD_ALLOW_HTTP: ${MCP_OAUTH_CIMD_ALLOW_HTTP:-false}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8055/server/ping || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 20s

volumes:
  database:
  uploads:
```

Directus 12 answers `/server/health` only to authenticated users (anonymous requests get `403`), so the container healthcheck uses the public `/server/ping`, which answers `pong`. `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` is raised because phone photos often exceed the 6000 px default and the publish operation resizes them. The Directus container runs as uid 1000 (`node`); `pnpm cms:up` creates `.data/public-media` as your user first, which is writable on macOS and on Linux when your uid is 1000 (otherwise run `sudo chown 1000:1000 .data/public-media`). `PUBLIC_MEDIA_PATH` is read by the publish operation (Task 7). `AI_ROLE_ID` is read by the creation-key hook (Task 4).

- [ ] **Step 5: Create the integration test package**

`cms/tests/package.json`:

```json
{
  "name": "@my-media/cms-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^24.19.2",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3",
    "zod": "^4.6.5"
  }
}
```

`cms/tests/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "vitest.config.ts"]
}
```

`cms/tests/vitest.config.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const environmentFile = fileURLToPath(new URL('../../.env', import.meta.url));

if (!existsSync(environmentFile)) {
  throw new Error('Fichier .env absent : copiez .env.example vers .env à la racine du dépôt.');
}

export default defineConfig({
  test: {
    env: parseEnv(readFileSync(environmentFile, 'utf8')),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

`cms/tests/src/support/environment.ts`:

```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`La variable ${name} est absente du fichier .env.`);
  }
  return value;
}

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const testEnvironment = {
  directusUrl: requireEnvironment('DIRECTUS_URL'),
  adminToken: requireEnvironment('ADMIN_TOKEN'),
  editorToken: requireEnvironment('EDITOR_TOKEN'),
  assistantToken: requireEnvironment('AI_TOKEN'),
  editorRoleId: requireEnvironment('EDITOR_ROLE_ID'),
  assistantRoleId: requireEnvironment('AI_ROLE_ID'),
  assistantAppAccess: requireEnvironment('AI_APP_ACCESS') === 'true',
  publicMediaDirectory: resolve(repositoryRoot, requireEnvironment('PUBLIC_MEDIA_DIR')),
};
```

- [ ] **Step 6: Write the failing server test**

`cms/tests/src/server.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { testEnvironment } from './support/environment.ts';

const serverInfoResponse = z.object({ data: z.object({ version: z.string() }) });
const healthResponse = z.object({ status: z.string() });

describe('local Directus server', () => {
  it('runs the pinned Directus version', async () => {
    const response = await fetch(`${testEnvironment.directusUrl}/server/info`, {
      headers: { Authorization: `Bearer ${testEnvironment.adminToken}` },
    });

    expect(response.status).toBe(200);
    expect(serverInfoResponse.parse(await response.json()).data.version).toBe('12.5.0');
  });

  it('reports a healthy status to the administrator', async () => {
    const response = await fetch(`${testEnvironment.directusUrl}/server/health`, {
      headers: { Authorization: `Bearer ${testEnvironment.adminToken}` },
    });

    expect(response.status).toBe(200);
    expect(healthResponse.parse(await response.json()).status).toBe('ok');
  });
});
```

- [ ] **Step 7: Install and run the test to see it fail**

Run: `pnpm install && pnpm test:cms`
Expected: FAIL with `fetch failed` / `ECONNREFUSED` because Directus is not running.

- [ ] **Step 8: Start the stack**

Run: `pnpm cms:up`
Expected: both containers report `Healthy` (first start takes up to a minute while Directus migrates the database and creates the admin user from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN`).

- [ ] **Step 9: Run the test to see it pass**

Run: `pnpm test:cms`
Expected: PASS, 2 tests.

Also run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc tsconfig.base.json .env.example .gitignore compose.yaml cms/tests
git diff --cached --check
git commit -m "chore: scaffold workspace and local Directus stack"
```

---

### Task 2: Shared schema types and collection provisioning

**Files:**
- Create: `cms/schema/package.json`, `cms/schema/tsconfig.json`, `cms/schema/src/index.ts`
- Create: `cms/provision/package.json`, `cms/provision/tsconfig.json`
- Create: `cms/provision/src/environment.ts`, `cms/provision/src/environment.test.ts`
- Create: `cms/provision/src/directus-client.ts`
- Create: `cms/provision/src/schema/fields.ts`, `cms/provision/src/schema/collections.ts`, `cms/provision/src/schema/relations.ts`, `cms/provision/src/schema/definitions.test.ts`
- Create: `cms/provision/src/schema/ensure-schema.ts`, `cms/provision/src/main.ts`
- Create: `cms/tests/src/support/clients.ts`, `cms/tests/src/support/errors.ts`, `cms/tests/src/support/fixtures.ts`
- Modify: `cms/tests/package.json` (dependencies)
- Test: `cms/tests/src/schema.test.ts`

**Interfaces:**
- Consumes: `testEnvironment` (Task 1).
- Produces:
  - `@my-media/cms-schema` types: `SiteSettings`, `EditorialLine`, `Section`, `WatchSource`, `WatchSourceKind`, `Material`, `PreparationStatus`, `Article`, `ArticleReference`, `ArticleImage`, `VerificationStatus`, `VerificationPoint`, `RemarkStatus`, `ReviewRemark`, `PublishedArticle`, `PublishedReference`, `PublishedImage`, `HomePlacement`, `HomeFeature`, `PublicSchema`, `EditorialSchema`.
  - `readProvisionEnvironment(source: Record<string, string | undefined>): ProvisionEnvironment` and types `ProvisionEnvironment`, `AccountEnvironment` (`{ email, password, token: string | null, roleId }`).
  - `createAdminClient(url: string, token: string)`, type `AdminClient`, type `Log = (message: string) => void`.
  - `editorialCollections(siteUrl: string): CollectionDefinition[]`, `editorialRelations: RelationDefinition[]`, `ensureSchema(client, collections, relations, log): Promise<void>`.
  - Test support: `adminClient`, `editorClient`, `assistantClient`, `anonymousClient`, type `EditorialClient`; `captureErrorCode(request: Promise<unknown>): Promise<string>`; `uniqueSuffix(): string`, `draftArticleValues(suffix: string): NestedPartial<Article>`, `createArticle(client: EditorialClient, values: NestedPartial<Article>): Promise<string>`, `uploadFile(client: EditorialClient, fileName: string, content: Uint8Array, type: string): Promise<string>`, `ONE_PIXEL_PNG: Uint8Array`.

- [ ] **Step 1: Create the schema types package**

`cms/schema/package.json`:

```json
{
  "name": "@my-media/cms-schema",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^24.19.2",
    "typescript": "~6.0.3"
  }
}
```

`cms/schema/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`cms/schema/src/index.ts`:

```ts
export type SiteSettings = {
  id: number;
  media_name: string | null;
  edition_label: string | null;
  presentation: string | null;
  about_body: string | null;
  contact_email: string | null;
  legal_notice: string | null;
};

export type EditorialLine = {
  id: number;
  themes: string | null;
  audience: string | null;
  tone: string | null;
  selection_criteria: string | null;
  notes: string | null;
};

export type Section = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort: number | null;
};

export type WatchSourceKind = 'site' | 'feed' | 'newsletter' | 'other';

export type WatchSource = {
  id: string;
  name: string;
  url: string | null;
  kind: WatchSourceKind;
  monitoring_notes: string | null;
  is_active: boolean;
};

export type Material = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  file: string | null;
  date_created: string | null;
  user_created: string | null;
};

export type PreparationStatus = 'idea' | 'drafting' | 'ready_for_review';

export type Article = {
  id: string;
  creation_key: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | Section | null;
  preparation_status: PreparationStatus;
  handoff_note: string | null;
  date_created: string | null;
  date_updated: string | null;
  user_created: string | null;
  user_updated: string | null;
  references: string[] | ArticleReference[];
  images: string[] | ArticleImage[];
  verification_points: string[] | VerificationPoint[];
  review_remarks: string[] | ReviewRemark[];
  publication: string[] | PublishedArticle[];
};

export type ArticleReference = {
  id: string;
  article: string | Article;
  sort: number | null;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
  material: string | Material | null;
};

export type ArticleImage = {
  id: string;
  article: string | Article;
  sort: number | null;
  file: string;
  alt: string;
  caption: string | null;
  credit: string | null;
  source_note: string | null;
};

export type VerificationStatus = 'open' | 'resolved';

export type VerificationPoint = {
  id: string;
  article: string | Article;
  claim: string;
  reason: string | null;
  related_sources: string | null;
  status: VerificationStatus;
  resolution_note: string | null;
  date_created: string | null;
  user_created: string | null;
};

export type RemarkStatus = 'open' | 'addressed';

export type ReviewRemark = {
  id: string;
  article: string | Article;
  body: string;
  status: RemarkStatus;
  response_note: string | null;
  date_created: string | null;
  user_created: string | null;
};

export type PublishedArticle = {
  id: string;
  article: string | Article;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | Section | null;
  first_published_at: string;
  last_published_at: string;
  references: string[] | PublishedReference[];
  images: string[] | PublishedImage[];
};

export type PublishedReference = {
  id: string;
  published_article: string | PublishedArticle;
  sort: number;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

export type PublishedImage = {
  id: string;
  published_article: string | PublishedArticle;
  sort: number;
  public_file_name: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type HomePlacement = 'lead' | 'selection';

export type HomeFeature = {
  id: string;
  published_article: string | PublishedArticle;
  placement: HomePlacement;
  sort: number | null;
};

export type PublicSchema = {
  site_settings: SiteSettings;
  sections: Section[];
  published_articles: PublishedArticle[];
  published_references: PublishedReference[];
  published_images: PublishedImage[];
  home_features: HomeFeature[];
};

export type EditorialSchema = PublicSchema & {
  editorial_line: EditorialLine;
  watch_sources: WatchSource[];
  materials: Material[];
  articles: Article[];
  article_references: ArticleReference[];
  article_images: ArticleImage[];
  verification_points: VerificationPoint[];
  review_remarks: ReviewRemark[];
};
```

Singletons (`site_settings`, `editorial_line`) are declared as single objects and regular collections as arrays: this is how the Directus SDK tells them apart.

- [ ] **Step 2: Create the provisioning package**

`cms/provision/package.json`:

```json
{
  "name": "@my-media/cms-provision",
  "private": true,
  "type": "module",
  "exports": {
    "./access": "./src/access/policies.ts"
  },
  "scripts": {
    "start": "node --env-file=../../.env src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@directus/sdk": "27.0.0"
  },
  "devDependencies": {
    "@my-media/cms-schema": "workspace:*",
    "@types/node": "^24.19.2",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```

The `./access` export points to a file created in Task 3; the integration tests import the access matrix through it.

`cms/provision/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Node 24 runs `src/main.ts` directly (type stripping), which is why every relative import in this package ends with `.ts` and every type-only import uses `import type`.

- [ ] **Step 3: Write the failing environment test**

`cms/provision/src/environment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readProvisionEnvironment } from './environment.ts';

const completeSource = {
  DIRECTUS_URL: 'http://localhost:8055',
  ADMIN_TOKEN: 'admin-token',
  SITE_URL: 'http://localhost:4321',
  EDITOR_EMAIL: 'redaction@example.com',
  EDITOR_PASSWORD: 'editor-password',
  EDITOR_TOKEN: 'editor-token',
  EDITOR_ROLE_ID: '2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42',
  AI_EMAIL: 'assistant@example.com',
  AI_PASSWORD: 'assistant-password',
  AI_TOKEN: '',
  AI_ROLE_ID: '6f1d1f4e-2b7a-4c55-9f58-4c1b3e8a9d21',
  AI_APP_ACCESS: 'false',
  MCP_OAUTH_ENABLED: 'true',
  MCP_OAUTH_CIMD_ENABLED: 'true',
  MCP_OAUTH_DCR_ENABLED: 'false',
};

describe('readProvisionEnvironment', () => {
  it('reads accounts, roles and MCP OAuth switches', () => {
    const environment = readProvisionEnvironment(completeSource);

    expect(environment.editor).toEqual({
      email: 'redaction@example.com',
      password: 'editor-password',
      token: 'editor-token',
      roleId: '2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42',
    });
    expect(environment.assistant.appAccess).toBe(false);
    expect(environment.mcpOAuth).toEqual({ enabled: true, cimdEnabled: true, dcrEnabled: false });
  });

  it('treats an empty token as no static token', () => {
    expect(readProvisionEnvironment(completeSource).assistant.token).toBeNull();
  });

  it('rejects a missing required variable with its name', () => {
    const { ADMIN_TOKEN: _removed, ...incompleteSource } = completeSource;

    expect(() => readProvisionEnvironment(incompleteSource)).toThrow('ADMIN_TOKEN');
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm install && pnpm --filter @my-media/cms-provision test`
Expected: FAIL with `Failed to load url ./environment.ts` (module does not exist).

- [ ] **Step 5: Implement the environment reader**

`cms/provision/src/environment.ts`:

```ts
export type AccountEnvironment = {
  email: string;
  password: string;
  token: string | null;
  roleId: string;
};

export type ProvisionEnvironment = {
  directusUrl: string;
  adminToken: string;
  siteUrl: string;
  editor: AccountEnvironment;
  assistant: AccountEnvironment & { appAccess: boolean };
  mcpOAuth: { enabled: boolean; cimdEnabled: boolean; dcrEnabled: boolean };
};

type EnvironmentSource = Record<string, string | undefined>;

export function readProvisionEnvironment(source: EnvironmentSource): ProvisionEnvironment {
  return {
    directusUrl: requireValue(source, 'DIRECTUS_URL'),
    adminToken: requireValue(source, 'ADMIN_TOKEN'),
    siteUrl: requireValue(source, 'SITE_URL'),
    editor: {
      email: requireValue(source, 'EDITOR_EMAIL'),
      password: requireValue(source, 'EDITOR_PASSWORD'),
      token: optionalValue(source, 'EDITOR_TOKEN'),
      roleId: requireValue(source, 'EDITOR_ROLE_ID'),
    },
    assistant: {
      email: requireValue(source, 'AI_EMAIL'),
      password: requireValue(source, 'AI_PASSWORD'),
      token: optionalValue(source, 'AI_TOKEN'),
      roleId: requireValue(source, 'AI_ROLE_ID'),
      appAccess: readFlag(source, 'AI_APP_ACCESS'),
    },
    mcpOAuth: {
      enabled: readFlag(source, 'MCP_OAUTH_ENABLED'),
      cimdEnabled: readFlag(source, 'MCP_OAUTH_CIMD_ENABLED'),
      dcrEnabled: readFlag(source, 'MCP_OAUTH_DCR_ENABLED'),
    },
  };
}

function requireValue(source: EnvironmentSource, name: string): string {
  const value = optionalValue(source, name);
  if (value === null) {
    throw new Error(`La variable d’environnement ${name} est obligatoire.`);
  }
  return value;
}

function optionalValue(source: EnvironmentSource, name: string): string | null {
  const value = source[name];
  if (value === undefined || value.trim() === '') {
    return null;
  }
  return value;
}

function readFlag(source: EnvironmentSource, name: string): boolean {
  return source[name] === 'true';
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `pnpm --filter @my-media/cms-provision test`
Expected: PASS, 3 tests.

- [ ] **Step 7: Write the failing schema-definition tests**

These tests check the declarative model without Directus: limits, keys, relation targets and private fields.

`cms/provision/src/schema/definitions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { editorialCollections } from './collections.ts';
import { editorialRelations } from './relations.ts';

const collections = editorialCollections('http://localhost:4321');
const collectionNames = new Set<string>(collections.map((definition) => definition.collection));

function fieldsOf(collection: string): string[] {
  const definition = collections.find((candidate) => candidate.collection === collection);
  if (definition === undefined) {
    throw new Error(`Collection ${collection} absente`);
  }
  return definition.fields.map((field) => field.field);
}

describe('editorial collections', () => {
  it('stays within the 25 collections allowed by Directus Core', () => {
    expect(collections.length).toBeLessThanOrEqual(25);
  });

  it('gives every collection an id primary key', () => {
    const collectionsWithoutId = collections.filter(
      (definition) => !definition.fields.some((field) => field.field === 'id' && field.schema?.is_primary_key === true),
    );

    expect(collectionsWithoutId).toEqual([]);
  });

  it('enforces a unique creation key on articles', () => {
    const articles = collections.find((definition) => definition.collection === 'articles');
    const creationKey = articles?.fields.find((field) => field.field === 'creation_key');

    expect(creationKey?.schema?.is_unique).toBe(true);
  });

  it('keeps private fields out of the published collections', () => {
    expect(fieldsOf('published_references')).not.toContain('material');
    expect(fieldsOf('published_images')).not.toContain('source_note');
    expect(fieldsOf('published_images')).not.toContain('file');
  });

  it('points the article preview at the site preview route', () => {
    const articles = collections.find((definition) => definition.collection === 'articles');

    expect(articles?.previewUrl).toBe('http://localhost:4321/apercu/{{id}}');
  });
});

describe('editorial relations', () => {
  it('only links declared fields to declared or system collections', () => {
    const invalidRelations = editorialRelations.filter((relation) => {
      const sourceIsDeclared = fieldsOf(relation.collection).includes(relation.field);
      const target = relation.related_collection ?? '';
      const targetIsKnown = collectionNames.has(target) || target.startsWith('directus_');
      return !sourceIsDeclared || !targetIsKnown;
    });

    expect(invalidRelations).toEqual([]);
  });

  it('declares every one-to-many alias through a relation', () => {
    const aliasFields = collections.flatMap((definition) =>
      definition.fields
        .filter((field) => field.type === 'alias')
        .map((field) => `${definition.collection}.${field.field}`),
    );
    const relationAliases = editorialRelations
      .filter((relation) => relation.meta?.one_field !== null && relation.meta?.one_field !== undefined)
      .map((relation) => `${relation.related_collection ?? ''}.${relation.meta?.one_field ?? ''}`);

    expect(relationAliases.toSorted()).toEqual(aliasFields.toSorted());
  });
});
```

- [ ] **Step 8: Run them to see them fail**

Run: `pnpm --filter @my-media/cms-provision test`
Expected: FAIL with `Failed to load url ./collections.ts`.

- [ ] **Step 9: Implement the client, field helpers, collections and relations**

`cms/provision/src/directus-client.ts`:

```ts
import { createDirectus, rest, staticToken } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';

export type Log = (message: string) => void;

export function createAdminClient(url: string, token: string) {
  return createDirectus<EditorialSchema>(url).with(staticToken(token)).with(rest());
}

export type AdminClient = ReturnType<typeof createAdminClient>;
```

`cms/provision/src/schema/fields.ts`:

```ts
import type { DirectusField, NestedPartial } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';

export type FieldDefinition = NestedPartial<DirectusField<EditorialSchema>> & { field: string };

export type FieldLabel = {
  label: string;
  note?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  width?: 'half' | 'full';
};

export type Choice = { text: string; value: string };

function fieldMeta(options: FieldLabel) {
  return {
    translations: [{ language: 'fr-FR', translation: options.label }],
    note: options.note ?? null,
    required: options.required ?? false,
    readonly: options.readonly ?? false,
    hidden: options.hidden ?? false,
    width: options.width ?? 'full',
  };
}

function columnSchema(options: FieldLabel) {
  const required = options.required ?? false;
  return {
    is_nullable: !required,
    is_unique: options.unique ?? false,
  };
}

export function uuidPrimaryKey(): FieldDefinition {
  return {
    field: 'id',
    type: 'uuid',
    meta: { special: ['uuid'], interface: 'input', readonly: true, hidden: true },
    schema: { is_primary_key: true, is_nullable: false },
  };
}

export function integerPrimaryKey(): FieldDefinition {
  return {
    field: 'id',
    type: 'integer',
    meta: { interface: 'input', readonly: true, hidden: true },
    schema: { is_primary_key: true, has_auto_increment: true, is_nullable: false },
  };
}

export function stringField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'string',
    meta: { ...fieldMeta(options), interface: 'input' },
    schema: columnSchema(options),
  };
}

export function urlField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'text',
    meta: { ...fieldMeta(options), interface: 'input', options: { placeholder: 'https://' } },
    schema: columnSchema(options),
  };
}

export function textField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'text',
    meta: { ...fieldMeta(options), interface: 'input-multiline' },
    schema: columnSchema(options),
  };
}

export function markdownField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'text',
    meta: { ...fieldMeta(options), interface: 'input-rich-text-md' },
    schema: columnSchema(options),
  };
}

export function dateField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'date',
    meta: { ...fieldMeta(options), interface: 'datetime' },
    schema: columnSchema(options),
  };
}

export function timestampField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'timestamp',
    meta: { ...fieldMeta(options), interface: 'datetime', display: 'datetime' },
    schema: columnSchema(options),
  };
}

export function integerField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'integer',
    meta: { ...fieldMeta(options), interface: 'input' },
    schema: columnSchema(options),
  };
}

export function booleanField(field: string, options: FieldLabel, defaultValue: boolean): FieldDefinition {
  return {
    field,
    type: 'boolean',
    meta: { ...fieldMeta(options), interface: 'boolean', special: ['cast-boolean'] },
    schema: { ...columnSchema(options), default_value: defaultValue },
  };
}

export function choiceField(field: string, options: FieldLabel, choices: Choice[], defaultValue: string): FieldDefinition {
  return {
    field,
    type: 'string',
    meta: {
      ...fieldMeta(options),
      interface: 'select-dropdown',
      options: { choices },
      display: 'labels',
      display_options: { choices },
    },
    schema: { ...columnSchema(options), default_value: defaultValue },
  };
}

export function sortField(): FieldDefinition {
  return {
    field: 'sort',
    type: 'integer',
    meta: { interface: 'input', hidden: true },
    schema: { is_nullable: true },
  };
}

export function manyToOneField(field: string, options: FieldLabel, template: string): FieldDefinition {
  return {
    field,
    type: 'uuid',
    meta: {
      ...fieldMeta(options),
      special: ['m2o'],
      interface: 'select-dropdown-m2o',
      options: { template },
      display: 'related-values',
      display_options: { template },
    },
    schema: columnSchema(options),
  };
}

export function imageField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'uuid',
    meta: { ...fieldMeta(options), special: ['file'], interface: 'file-image', display: 'image' },
    schema: columnSchema(options),
  };
}

export function documentField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'uuid',
    meta: { ...fieldMeta(options), special: ['file'], interface: 'file', display: 'file' },
    schema: columnSchema(options),
  };
}

export function oneToManyField(field: string, options: FieldLabel, template: string): FieldDefinition {
  return {
    field,
    type: 'alias',
    meta: {
      ...fieldMeta(options),
      special: ['o2m'],
      interface: 'list-o2m',
      options: { template, enableSelect: false },
      display: 'related-values',
      display_options: { template },
    },
    schema: null,
  };
}

export function dateCreatedField(): FieldDefinition {
  return {
    field: 'date_created',
    type: 'timestamp',
    meta: { ...fieldMeta({ label: 'Créé le', readonly: true, width: 'half' }), special: ['date-created'], interface: 'datetime', display: 'datetime' },
    schema: { is_nullable: true },
  };
}

export function dateUpdatedField(): FieldDefinition {
  return {
    field: 'date_updated',
    type: 'timestamp',
    meta: { ...fieldMeta({ label: 'Modifié le', readonly: true, width: 'half' }), special: ['date-updated'], interface: 'datetime', display: 'datetime' },
    schema: { is_nullable: true },
  };
}

export function userCreatedField(): FieldDefinition {
  return {
    field: 'user_created',
    type: 'uuid',
    meta: { ...fieldMeta({ label: 'Créé par', readonly: true, width: 'half' }), special: ['user-created'], interface: 'select-dropdown-m2o', options: { template: '{{first_name}}' }, display: 'user' },
    schema: { is_nullable: true },
  };
}

export function userUpdatedField(): FieldDefinition {
  return {
    field: 'user_updated',
    type: 'uuid',
    meta: { ...fieldMeta({ label: 'Modifié par', readonly: true, width: 'half' }), special: ['user-updated'], interface: 'select-dropdown-m2o', options: { template: '{{first_name}}' }, display: 'user' },
    schema: { is_nullable: true },
  };
}
```

`cms/provision/src/schema/collections.ts`:

```ts
import type { EditorialSchema } from '@my-media/cms-schema';
import {
  booleanField,
  choiceField,
  dateCreatedField,
  dateField,
  dateUpdatedField,
  documentField,
  imageField,
  integerField,
  integerPrimaryKey,
  manyToOneField,
  markdownField,
  oneToManyField,
  sortField,
  stringField,
  textField,
  timestampField,
  urlField,
  userCreatedField,
  userUpdatedField,
  uuidPrimaryKey,
} from './fields.ts';
import type { FieldDefinition } from './fields.ts';

export type CollectionDefinition = {
  collection: keyof EditorialSchema;
  label: { singular: string; plural: string };
  icon: string;
  note: string;
  singleton: boolean;
  hidden: boolean;
  sortField: string | null;
  displayTemplate: string | null;
  previewUrl: string | null;
  fields: FieldDefinition[];
};

const parentArticleField = manyToOneField('article', { label: 'Article', required: true, hidden: true }, '{{title}}');
const parentPublicationField = manyToOneField('published_article', { label: 'Version publiée', required: true, hidden: true }, '{{title}}');

export function editorialCollections(siteUrl: string): CollectionDefinition[] {
  return [
    {
      collection: 'site_settings',
      label: { singular: 'Réglages du média', plural: 'Réglages du média' },
      icon: 'tune',
      note: 'Nom, présentation, contact et mentions légales affichés sur le site.',
      singleton: true,
      hidden: false,
      sortField: null,
      displayTemplate: null,
      previewUrl: null,
      fields: [
        integerPrimaryKey(),
        stringField('media_name', { label: 'Nom du média' }),
        stringField('edition_label', { label: 'Libellé d’édition', note: 'Ex. Édition du week-end' }),
        textField('presentation', { label: 'Présentation courte' }),
        markdownField('about_body', { label: 'Page À propos' }),
        stringField('contact_email', { label: 'Adresse de contact' }),
        markdownField('legal_notice', { label: 'Mentions légales' }),
      ],
    },
    {
      collection: 'editorial_line',
      label: { singular: 'Ligne éditoriale', plural: 'Ligne éditoriale' },
      icon: 'explore',
      note: 'Thèmes, public, ton et critères de sélection. Lu par l’assistant avant chaque session.',
      singleton: true,
      hidden: false,
      sortField: null,
      displayTemplate: null,
      previewUrl: null,
      fields: [
        integerPrimaryKey(),
        markdownField('themes', { label: 'Thèmes suivis' }),
        textField('audience', { label: 'Public visé' }),
        textField('tone', { label: 'Ton' }),
        markdownField('selection_criteria', { label: 'Critères de sélection des sujets' }),
        markdownField('notes', { label: 'Notes' }),
      ],
    },
    {
      collection: 'sections',
      label: { singular: 'Rubrique', plural: 'Rubriques' },
      icon: 'category',
      note: 'Rubriques du site.',
      singleton: false,
      hidden: false,
      sortField: 'sort',
      displayTemplate: '{{name}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        stringField('name', { label: 'Nom', required: true, width: 'half' }),
        stringField('slug', { label: 'Identifiant d’URL', required: true, unique: true, width: 'half', note: 'Lettres minuscules, chiffres et tirets.' }),
        textField('description', { label: 'Description' }),
        sortField(),
      ],
    },
    {
      collection: 'watch_sources',
      label: { singular: 'Source de veille', plural: 'Sources de veille' },
      icon: 'travel_explore',
      note: 'Sites, flux et lettres que l’assistant surveille.',
      singleton: false,
      hidden: false,
      sortField: null,
      displayTemplate: '{{name}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        stringField('name', { label: 'Nom', required: true, width: 'half' }),
        choiceField(
          'kind',
          { label: 'Type', required: true, width: 'half' },
          [
            { text: 'Site', value: 'site' },
            { text: 'Flux RSS', value: 'feed' },
            { text: 'Lettre d’information', value: 'newsletter' },
            { text: 'Autre', value: 'other' },
          ],
          'site',
        ),
        urlField('url', { label: 'Adresse' }),
        textField('monitoring_notes', { label: 'Consignes de veille' }),
        booleanField('is_active', { label: 'Active', width: 'half' }, true),
      ],
    },
    {
      collection: 'materials',
      label: { singular: 'Matériau privé', plural: 'Matériaux privés' },
      icon: 'folder_open',
      note: 'Notes et documents de travail. Jamais publiés.',
      singleton: false,
      hidden: false,
      sortField: null,
      displayTemplate: '{{title}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        stringField('title', { label: 'Titre', required: true }),
        markdownField('notes', { label: 'Notes' }),
        urlField('url', { label: 'Adresse' }),
        documentField('file', { label: 'Document' }),
        dateCreatedField(),
        userCreatedField(),
      ],
    },
    {
      collection: 'articles',
      label: { singular: 'Article', plural: 'Articles' },
      icon: 'article',
      note: 'Version de travail des articles. Le site ne lit jamais cette collection.',
      singleton: false,
      hidden: false,
      sortField: null,
      displayTemplate: '{{title}}',
      previewUrl: `${siteUrl}/apercu/{{id}}`,
      fields: [
        uuidPrimaryKey(),
        stringField('title', { label: 'Titre', required: true }),
        stringField('slug', { label: 'Identifiant d’URL', required: true, unique: true, width: 'half', note: 'Lettres minuscules, chiffres et tirets.' }),
        stringField('creation_key', { label: 'Clé de création', unique: true, width: 'half', note: 'Clé stable fournie par l’assistant pour éviter les doublons.' }),
        textField('summary', { label: 'Chapô' }),
        markdownField('body', { label: 'Texte', note: 'Appel de source : [^1]. Image dans le texte : [[image:2]] seul sur une ligne.' }),
        stringField('byline', { label: 'Signature', width: 'half' }),
        stringField('format', { label: 'Format', width: 'half', note: 'Ex. Enquête, Analyse, Reportage, Entretien.' }),
        manyToOneField('section', { label: 'Rubrique', width: 'half' }, '{{name}}'),
        choiceField(
          'preparation_status',
          { label: 'État de préparation', required: true, width: 'half' },
          [
            { text: 'Idée', value: 'idea' },
            { text: 'En préparation', value: 'drafting' },
            { text: 'Prêt pour relecture', value: 'ready_for_review' },
          ],
          'drafting',
        ),
        markdownField('handoff_note', { label: 'Note de passation', note: 'Ce qui a été fait, ce qui reste à vérifier, les échecs éventuels.' }),
        oneToManyField('references', { label: 'Sources' }, '{{sort}}. {{organization}} — {{title}}'),
        oneToManyField('images', { label: 'Images' }, '{{sort}}. {{alt}}'),
        oneToManyField('verification_points', { label: 'À vérifier' }, '{{status}} · {{claim}}'),
        oneToManyField('review_remarks', { label: 'Remarques de relecture' }, '{{status}} · {{body}}'),
        oneToManyField('publication', { label: 'Version publiée', readonly: true }, 'Publiée le {{first_published_at}}, mise à jour le {{last_published_at}}'),
        dateCreatedField(),
        dateUpdatedField(),
        userCreatedField(),
        userUpdatedField(),
      ],
    },
    {
      collection: 'article_references',
      label: { singular: 'Source', plural: 'Sources' },
      icon: 'menu_book',
      note: 'Sources d’un article, publiées avec lui.',
      singleton: false,
      hidden: true,
      sortField: 'sort',
      displayTemplate: '{{title}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        parentArticleField,
        sortField(),
        stringField('organization', { label: 'Organisation', width: 'half' }),
        stringField('title', { label: 'Titre du document', required: true }),
        urlField('url', { label: 'Lien' }),
        stringField('author', { label: 'Auteur', width: 'half' }),
        stringField('publication', { label: 'Publication ou éditeur', width: 'half' }),
        dateField('published_on', { label: 'Date du document', width: 'half' }),
        textField('note', { label: 'Note publique' }),
        manyToOneField('material', { label: 'Matériau privé lié', note: 'Non publié.' }, '{{title}}'),
      ],
    },
    {
      collection: 'article_images',
      label: { singular: 'Image', plural: 'Images' },
      icon: 'image',
      note: 'Images d’un article. L’image 1 illustre l’article.',
      singleton: false,
      hidden: true,
      sortField: 'sort',
      displayTemplate: '{{alt}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        parentArticleField,
        sortField(),
        imageField('file', { label: 'Image', required: true }),
        stringField('alt', { label: 'Texte alternatif', required: true }),
        textField('caption', { label: 'Légende' }),
        stringField('credit', { label: 'Crédit', width: 'half' }),
        textField('source_note', { label: 'Origine de l’image (privé)', note: 'Non publié.' }),
      ],
    },
    {
      collection: 'verification_points',
      label: { singular: 'Point à vérifier', plural: 'Points à vérifier' },
      icon: 'fact_check',
      note: 'Signal non bloquant pour la relecture.',
      singleton: false,
      hidden: true,
      sortField: null,
      displayTemplate: '{{claim}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        parentArticleField,
        textField('claim', { label: 'Affirmation à vérifier', required: true }),
        textField('reason', { label: 'Pourquoi' }),
        textField('related_sources', { label: 'Sources concernées' }),
        choiceField(
          'status',
          { label: 'État', required: true, width: 'half' },
          [
            { text: 'Ouvert', value: 'open' },
            { text: 'Résolu', value: 'resolved' },
          ],
          'open',
        ),
        textField('resolution_note', { label: 'Résolution' }),
        dateCreatedField(),
        userCreatedField(),
      ],
    },
    {
      collection: 'review_remarks',
      label: { singular: 'Remarque de relecture', plural: 'Remarques de relecture' },
      icon: 'rate_review',
      note: 'Remarques de la rédaction que l’assistant traite.',
      singleton: false,
      hidden: true,
      sortField: null,
      displayTemplate: '{{body}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        parentArticleField,
        textField('body', { label: 'Remarque', required: true }),
        choiceField(
          'status',
          { label: 'État', required: true, width: 'half' },
          [
            { text: 'Ouverte', value: 'open' },
            { text: 'Traitée', value: 'addressed' },
          ],
          'open',
        ),
        textField('response_note', { label: 'Réponse de l’assistant' }),
        dateCreatedField(),
        userCreatedField(),
      ],
    },
    {
      collection: 'published_articles',
      label: { singular: 'Version publiée', plural: 'Versions publiées' },
      icon: 'public',
      note: 'Copies publiques écrites par l’action Publier. Ne pas modifier à la main.',
      singleton: false,
      hidden: false,
      sortField: null,
      displayTemplate: '{{title}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        manyToOneField('article', { label: 'Article de travail', required: true, unique: true, readonly: true }, '{{title}}'),
        stringField('slug', { label: 'Identifiant d’URL', required: true, unique: true, readonly: true }),
        stringField('title', { label: 'Titre', required: true, readonly: true }),
        textField('summary', { label: 'Chapô', readonly: true }),
        markdownField('body', { label: 'Texte', readonly: true }),
        stringField('byline', { label: 'Signature', readonly: true, width: 'half' }),
        stringField('format', { label: 'Format', readonly: true, width: 'half' }),
        manyToOneField('section', { label: 'Rubrique', readonly: true, width: 'half' }, '{{name}}'),
        timestampField('first_published_at', { label: 'Première publication', required: true, readonly: true, width: 'half' }),
        timestampField('last_published_at', { label: 'Dernière publication', required: true, readonly: true, width: 'half' }),
        oneToManyField('references', { label: 'Sources publiées', readonly: true }, '{{sort}}. {{title}}'),
        oneToManyField('images', { label: 'Images publiées', readonly: true }, '{{sort}}. {{alt}}'),
      ],
    },
    {
      collection: 'published_references',
      label: { singular: 'Source publiée', plural: 'Sources publiées' },
      icon: 'menu_book',
      note: 'Copies publiques des sources.',
      singleton: false,
      hidden: true,
      sortField: 'sort',
      displayTemplate: '{{title}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        parentPublicationField,
        integerField('sort', { label: 'Numéro', required: true, hidden: true }),
        stringField('organization', { label: 'Organisation' }),
        stringField('title', { label: 'Titre du document', required: true }),
        urlField('url', { label: 'Lien' }),
        stringField('author', { label: 'Auteur' }),
        stringField('publication', { label: 'Publication ou éditeur' }),
        dateField('published_on', { label: 'Date du document' }),
        textField('note', { label: 'Note publique' }),
      ],
    },
    {
      collection: 'published_images',
      label: { singular: 'Image publiée', plural: 'Images publiées' },
      icon: 'image',
      note: 'Copies publiques des images, servies par le site.',
      singleton: false,
      hidden: true,
      sortField: 'sort',
      displayTemplate: '{{alt}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        parentPublicationField,
        integerField('sort', { label: 'Numéro', required: true, hidden: true }),
        stringField('public_file_name', { label: 'Fichier public', required: true }),
        integerField('width', { label: 'Largeur', required: true, width: 'half' }),
        integerField('height', { label: 'Hauteur', required: true, width: 'half' }),
        stringField('alt', { label: 'Texte alternatif', required: true }),
        textField('caption', { label: 'Légende' }),
        stringField('credit', { label: 'Crédit' }),
      ],
    },
    {
      collection: 'home_features',
      label: { singular: 'Mise en avant', plural: 'Accueil : mises en avant' },
      icon: 'star',
      note: 'Article principal et sélection de la page d’accueil.',
      singleton: false,
      hidden: false,
      sortField: 'sort',
      displayTemplate: '{{placement}} · {{published_article.title}}',
      previewUrl: null,
      fields: [
        uuidPrimaryKey(),
        manyToOneField('published_article', { label: 'Article publié', required: true }, '{{title}}'),
        choiceField(
          'placement',
          { label: 'Emplacement', required: true, width: 'half' },
          [
            { text: 'Article principal', value: 'lead' },
            { text: 'Sélection', value: 'selection' },
          ],
          'selection',
        ),
        sortField(),
      ],
    },
  ];
}
```

`cms/provision/src/schema/relations.ts`:

```ts
import type { DirectusRelation, NestedPartial } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';

export type RelationDefinition = NestedPartial<DirectusRelation<EditorialSchema>> & {
  collection: string;
  field: string;
};

type DeleteAction = 'CASCADE' | 'SET NULL' | 'RESTRICT';

function manyToOne(collection: string, field: string, relatedCollection: string, onDelete: DeleteAction): RelationDefinition {
  return {
    collection,
    field,
    related_collection: relatedCollection,
    meta: { one_field: null, sort_field: null, one_deselect_action: 'nullify' },
    schema: { on_delete: onDelete },
  };
}

function childOf(
  collection: string,
  field: string,
  relatedCollection: string,
  aliasField: string,
  sortFieldName: string | null,
): RelationDefinition {
  return {
    collection,
    field,
    related_collection: relatedCollection,
    meta: { one_field: aliasField, sort_field: sortFieldName, one_deselect_action: 'delete' },
    schema: { on_delete: 'CASCADE' },
  };
}

export const editorialRelations: RelationDefinition[] = [
  manyToOne('materials', 'file', 'directus_files', 'SET NULL'),
  manyToOne('materials', 'user_created', 'directus_users', 'SET NULL'),
  manyToOne('articles', 'section', 'sections', 'SET NULL'),
  manyToOne('articles', 'user_created', 'directus_users', 'SET NULL'),
  manyToOne('articles', 'user_updated', 'directus_users', 'SET NULL'),
  childOf('article_references', 'article', 'articles', 'references', 'sort'),
  manyToOne('article_references', 'material', 'materials', 'SET NULL'),
  childOf('article_images', 'article', 'articles', 'images', 'sort'),
  manyToOne('article_images', 'file', 'directus_files', 'RESTRICT'),
  childOf('verification_points', 'article', 'articles', 'verification_points', null),
  manyToOne('verification_points', 'user_created', 'directus_users', 'SET NULL'),
  childOf('review_remarks', 'article', 'articles', 'review_remarks', null),
  manyToOne('review_remarks', 'user_created', 'directus_users', 'SET NULL'),
  {
    collection: 'published_articles',
    field: 'article',
    related_collection: 'articles',
    meta: { one_field: 'publication', sort_field: null, one_deselect_action: 'nullify' },
    schema: { on_delete: 'RESTRICT' },
  },
  manyToOne('published_articles', 'section', 'sections', 'SET NULL'),
  childOf('published_references', 'published_article', 'published_articles', 'references', 'sort'),
  childOf('published_images', 'published_article', 'published_articles', 'images', 'sort'),
  manyToOne('home_features', 'published_article', 'published_articles', 'CASCADE'),
];
```

`RESTRICT` on `published_articles.article` means a published article's working draft cannot be deleted while its public copy exists, and `RESTRICT` on `article_images.file` prevents deleting a file that a draft still uses.

- [ ] **Step 10: Run the definition tests to see them pass**

Run: `pnpm --filter @my-media/cms-provision test`
Expected: PASS, 10 tests.

- [ ] **Step 11: Create the test support modules**

Add the SDK and schema types to `cms/tests/package.json` (full file):

```json
{
  "name": "@my-media/cms-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@directus/sdk": "27.0.0",
    "@my-media/cms-provision": "workspace:*",
    "@my-media/cms-schema": "workspace:*",
    "@types/node": "^24.19.2",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3",
    "zod": "^4.6.5"
  }
}
```

`cms/tests/src/support/clients.ts`:

```ts
import { createDirectus, rest, staticToken } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';
import { testEnvironment } from './environment.ts';

function createTokenClient(token: string) {
  return createDirectus<EditorialSchema>(testEnvironment.directusUrl).with(staticToken(token)).with(rest());
}

export type EditorialClient = ReturnType<typeof createTokenClient>;

export const adminClient = createTokenClient(testEnvironment.adminToken);
export const editorClient = createTokenClient(testEnvironment.editorToken);
export const assistantClient = createTokenClient(testEnvironment.assistantToken);
export const anonymousClient = createDirectus<EditorialSchema>(testEnvironment.directusUrl).with(rest());
```

`cms/tests/src/support/errors.ts`:

```ts
import { isDirectusError } from '@directus/sdk';

export async function captureErrorCode(request: Promise<unknown>): Promise<string> {
  try {
    await request;
  } catch (error) {
    return readErrorCode(error);
  }
  throw new Error('La requête devait être refusée mais elle a réussi.');
}

function readErrorCode(error: unknown): string {
  if (!isDirectusError(error)) {
    throw error;
  }
  const [firstError] = error.errors;
  if (firstError === undefined) {
    throw new Error(`Erreur Directus sans détail (HTTP ${error.response.status}).`);
  }
  return firstError.extensions.code;
}
```

`cms/tests/src/support/fixtures.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { createItem, uploadFiles } from '@directus/sdk';
import type { NestedPartial } from '@directus/sdk';
import type { Article } from '@my-media/cms-schema';
import type { EditorialClient } from './clients.ts';

export const ONE_PIXEL_PNG = new Uint8Array(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64'),
);

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function draftArticleValues(suffix: string): NestedPartial<Article> {
  return {
    title: `Article de test ${suffix}`,
    slug: `article-de-test-${suffix}`,
    creation_key: `2026-10-10-test-${suffix}`,
    summary: 'Chapô de test.',
    body: `Premier paragraphe de test ${suffix}[^1].`,
    byline: 'La rédaction',
  };
}

export async function createArticle(client: EditorialClient, values: NestedPartial<Article>): Promise<string> {
  const created = await client.request(createItem('articles', values, { fields: ['id'] }));
  return created.id;
}

export async function uploadFile(client: EditorialClient, fileName: string, content: Uint8Array, type: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(content)], { type }), fileName);
  const uploaded = await client.request(uploadFiles(form, { fields: ['id'] }));
  return uploaded.id;
}
```

- [ ] **Step 12: Write the failing schema integration test**

`cms/tests/src/schema.test.ts`:

```ts
import { createItem, deleteItem, readCollections, readItems } from '@directus/sdk';
import { describe, expect, it } from 'vitest';
import { adminClient } from './support/clients.ts';
import { captureErrorCode } from './support/errors.ts';
import { createArticle, draftArticleValues, uniqueSuffix } from './support/fixtures.ts';

const expectedCollections = [
  'site_settings',
  'editorial_line',
  'sections',
  'watch_sources',
  'materials',
  'articles',
  'article_references',
  'article_images',
  'verification_points',
  'review_remarks',
  'published_articles',
  'published_references',
  'published_images',
  'home_features',
];

describe('provisioned schema', () => {
  it('creates every editorial collection', async () => {
    const collections = await adminClient.request(readCollections());
    const names = collections.map((collection) => collection.collection);

    expect(names).toEqual(expect.arrayContaining(expectedCollections));
  });

  it('rejects a second article with the same creation key', async () => {
    const suffix = uniqueSuffix();
    await createArticle(adminClient, draftArticleValues(suffix));

    const duplicate = createArticle(adminClient, {
      ...draftArticleValues(suffix),
      slug: `doublon-${suffix}`,
    });

    expect(await captureErrorCode(duplicate)).toBe('RECORD_NOT_UNIQUE');
  });

  it('deletes the sources of a deleted draft', async () => {
    const suffix = uniqueSuffix();
    const articleId = await createArticle(adminClient, {
      ...draftArticleValues(suffix),
      references: [{ title: `Source ${suffix}`, sort: 1 }],
    });

    await adminClient.request(deleteItem('articles', articleId));
    const remaining = await adminClient.request(
      readItems('article_references', { filter: { title: { _eq: `Source ${suffix}` } }, fields: ['id'] }),
    );

    expect(remaining).toEqual([]);
  });

  it('refuses a public copy without a working article', async () => {
    const orphan = adminClient.request(
      createItem('published_articles', {
        slug: `orphelin-${uniqueSuffix()}`,
        title: 'Sans article',
        first_published_at: new Date().toISOString(),
        last_published_at: new Date().toISOString(),
      }),
    );

    expect(['FAILED_VALIDATION', 'NOT_NULL_VIOLATION']).toContain(await captureErrorCode(orphan));
  });
});
```

The last test relies on `published_articles.article` being required. Directus rejects the missing value either in its own validation (`FAILED_VALIDATION`, from `meta.required`) or at the database (`NOT_NULL_VIOLATION`, from `is_nullable: false`); both prove the constraint.

- [ ] **Step 13: Run it to see it fail**

Run: `pnpm install && pnpm test:cms`
Expected: FAIL on `creates every editorial collection` (collections missing).

- [ ] **Step 14: Implement `ensureSchema` and the provisioning entry point**

`cms/provision/src/schema/ensure-schema.ts`:

```ts
import { createCollection, createField, createRelation, readCollections, readFieldsByCollection, readRelations } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import type { CollectionDefinition } from './collections.ts';
import type { RelationDefinition } from './relations.ts';

export async function ensureSchema(
  client: AdminClient,
  collections: CollectionDefinition[],
  relations: RelationDefinition[],
  log: Log,
): Promise<void> {
  const existingCollections = await client.request(readCollections());
  const existingCollectionNames = new Set(existingCollections.map((collection) => collection.collection));
  for (const definition of collections) {
    await ensureCollection(client, definition, existingCollectionNames.has(definition.collection), log);
  }

  const existingRelations = await client.request(readRelations());
  const existingRelationKeys = new Set(existingRelations.map((relation) => relationKey(relation.collection, relation.field)));
  for (const definition of relations) {
    await ensureRelation(client, definition, existingRelationKeys.has(relationKey(definition.collection, definition.field)), log);
  }
}

async function ensureCollection(client: AdminClient, definition: CollectionDefinition, exists: boolean, log: Log): Promise<void> {
  if (!exists) {
    await client.request(createCollection(toCollectionPayload(definition)));
    log(`Collection créée : ${definition.collection}`);
    return;
  }
  await ensureMissingFields(client, definition, log);
}

async function ensureMissingFields(client: AdminClient, definition: CollectionDefinition, log: Log): Promise<void> {
  const existingFields = await client.request(readFieldsByCollection(definition.collection));
  const existingFieldNames = new Set(existingFields.map((field) => field.field));
  const missingFields = definition.fields.filter((field) => !existingFieldNames.has(field.field));
  for (const field of missingFields) {
    await client.request(createField(definition.collection, field));
    log(`Champ créé : ${definition.collection}.${field.field}`);
  }
}

async function ensureRelation(client: AdminClient, definition: RelationDefinition, exists: boolean, log: Log): Promise<void> {
  if (exists) {
    return;
  }
  await client.request(createRelation(definition));
  log(`Relation créée : ${definition.collection}.${definition.field}`);
}

function relationKey(collection: string, field: string): string {
  return `${collection}.${field}`;
}

function toCollectionPayload(definition: CollectionDefinition) {
  return {
    collection: definition.collection,
    meta: {
      icon: definition.icon,
      note: definition.note,
      singleton: definition.singleton,
      hidden: definition.hidden,
      sort_field: definition.sortField,
      display_template: definition.displayTemplate,
      preview_url: definition.previewUrl,
      accountability: 'all',
      translations: [
        {
          language: 'fr-FR',
          translation: definition.label.plural,
          singular: definition.label.singular,
          plural: definition.label.plural,
        },
      ],
    },
    schema: {},
    fields: definition.fields,
  };
}
```

Existing collections and fields are never altered or deleted: provisioning only adds what is missing, so re-running it is safe on a database that contains real articles.

`cms/provision/src/main.ts`:

```ts
import { isDirectusError } from '@directus/sdk';
import { createAdminClient } from './directus-client.ts';
import { readProvisionEnvironment } from './environment.ts';
import { editorialCollections } from './schema/collections.ts';
import { ensureSchema } from './schema/ensure-schema.ts';
import { editorialRelations } from './schema/relations.ts';

function log(message: string): void {
  console.log(message);
}

async function provision(): Promise<void> {
  const environment = readProvisionEnvironment(process.env);
  const client = createAdminClient(environment.directusUrl, environment.adminToken);

  await ensureSchema(client, editorialCollections(environment.siteUrl), editorialRelations, log);
  log('Provisionnement terminé.');
}

function describeFailure(error: unknown): string {
  if (isDirectusError(error)) {
    return error.errors.map((detail) => `${detail.extensions.code} : ${detail.message}`).join('\n');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

try {
  await provision();
} catch (error) {
  console.error(`Échec du provisionnement :\n${describeFailure(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 15: Provision and run the test to see it pass**

Run: `pnpm provision`
Expected: one `Collection créée : …` line per collection, one `Relation créée : …` per relation, then `Provisionnement terminé.`

Run: `pnpm provision` again.
Expected: only `Provisionnement terminé.` (idempotent).

Run: `pnpm test:cms`
Expected: PASS (server and schema tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 16: Commit**

```bash
git add cms/schema cms/provision cms/tests pnpm-lock.yaml
git diff --cached --check
git commit -m "feat(cms): provision the editorial collections"
```

---

### Task 3: Access policies, roles and accounts

**Files:**
- Create: `cms/provision/src/access/policies.ts`, `cms/provision/src/access/policies.test.ts`
- Create: `cms/provision/src/access/ensure-access.ts`
- Modify: `cms/provision/src/main.ts` (full replacement below)
- Test: `cms/tests/src/access.test.ts`, `cms/tests/src/limits.test.ts`

**Interfaces:**
- Consumes: `AdminClient`, `Log` (Task 2), `ProvisionEnvironment` (Task 2), test support from Task 2.
- Produces (exported from `@my-media/cms-provision/access`): `PUBLIC_POLICY_ID: string`, `publicCollections`, `privateCollections` (`(keyof EditorialSchema)[]`), `publicGrants: CollectionGrant[]`, `editorPolicy: PolicyDefinition`, `assistantPolicy(appAccess: boolean): PolicyDefinition`, `toPermissionRows(policyId: string, grants: CollectionGrant[]): PermissionRow[]`, `grantKeys(grants: CollectionGrant[]): string[]` (sorted `collection:action` strings), types `PermissionAction`, `GrantedCollection`, `CollectionGrant`, `PolicyDefinition`, `PermissionRow`. From `ensure-access.ts`: `ensureAccess(client: AdminClient, environment: ProvisionEnvironment, log: Log): Promise<void>`.

The matrix below is the whole security model under Directus Core. Each grant opens a whole collection for one action; nothing depends on item filters.

| Collection group | Anonymous | Rédaction | Assistant IA |
| --- | --- | --- | --- |
| `site_settings`, `sections`, `published_*`, `home_features` | read | create, read, update, delete | read |
| `editorial_line`, `watch_sources`, `materials` | none | create, read, update, delete | read |
| `articles`, `verification_points` | none | create, read, update, delete | create, read, update |
| `article_references`, `article_images` | none | create, read, update, delete | create, read, update, delete |
| `review_remarks` | none | create, read, update, delete | read, update |
| `directus_files` | none | create, read, update, delete | create, read, update |
| `directus_folders` | none | create, read, update, delete | read |
| `directus_users`, `directus_flows`, `directus_operations` | none | read | none |

The editor needs read access on `directus_flows` and `directus_operations` because the Studio only shows manual flow buttons to users who can read flows (`app/src/stores/flows.ts` in Directus 12.5.0). The assistant gets neither, which also makes the MCP `trigger-flow` tool fail for it.

- [ ] **Step 1: Write the failing matrix tests**

`cms/provision/src/access/policies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assistantPolicy, editorPolicy, grantKeys, publicCollections, publicGrants, toPermissionRows } from './policies.ts';
import type { CollectionGrant } from './policies.ts';

function actionsOn(grants: CollectionGrant[], collection: string): string[] {
  return grants.filter((grant) => grant.collection === collection).flatMap((grant) => grant.actions);
}

describe('public policy', () => {
  it('only reads public collections', () => {
    expect(grantKeys(publicGrants)).toEqual(publicCollections.map((collection) => `${collection}:read`).toSorted());
  });
});

describe('assistant policy', () => {
  const grants = assistantPolicy(false).grants;

  it('cannot write any public collection', () => {
    const publicWrites = publicCollections.flatMap((collection) =>
      actionsOn(grants, collection).filter((action) => action !== 'read'),
    );

    expect(publicWrites).toEqual([]);
  });

  it('cannot reach administration collections', () => {
    const administration = ['directus_users', 'directus_flows', 'directus_operations', 'directus_permissions', 'directus_policies', 'directus_roles', 'directus_settings'];
    const reachable = administration.filter((collection) => actionsOn(grants, collection).length > 0);

    expect(reachable).toEqual([]);
  });

  it('cannot delete articles, verification points, remarks or files', () => {
    const deletable = ['articles', 'verification_points', 'review_remarks', 'directus_files'].filter((collection) =>
      actionsOn(grants, collection).includes('delete'),
    );

    expect(deletable).toEqual([]);
  });

  it('only changes human-owned settings by reading them', () => {
    expect(actionsOn(grants, 'editorial_line')).toEqual(['read']);
    expect(actionsOn(grants, 'watch_sources')).toEqual(['read']);
    expect(actionsOn(grants, 'materials')).toEqual(['read']);
  });

  it('follows the requested Studio access flag', () => {
    expect(assistantPolicy(true).appAccess).toBe(true);
    expect(assistantPolicy(false).appAccess).toBe(false);
  });
});

describe('editor policy', () => {
  it('can read the flows that render the Publier button', () => {
    expect(actionsOn(editorPolicy.grants, 'directus_flows')).toEqual(['read']);
    expect(actionsOn(editorPolicy.grants, 'directus_operations')).toEqual(['read']);
  });
});

describe('permission rows', () => {
  it('only produces rows allowed by Directus Core', () => {
    const rows = toPermissionRows('policy-id', [...editorPolicy.grants, ...assistantPolicy(false).grants, ...publicGrants]);
    const restrictedRows = rows.filter(
      (row) => row.fields.join(',') !== '*' || row.permissions !== null || row.validation !== null || row.presets !== null,
    );

    expect(restrictedRows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @my-media/cms-provision test`
Expected: FAIL with `Failed to load url ./policies.ts`.

- [ ] **Step 3: Implement the matrix**

`cms/provision/src/access/policies.ts`:

```ts
import type { EditorialSchema } from '@my-media/cms-schema';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export type SystemCollection = 'directus_files' | 'directus_folders' | 'directus_users' | 'directus_flows' | 'directus_operations';

export type GrantedCollection = keyof EditorialSchema | SystemCollection;

export type CollectionGrant = { collection: GrantedCollection; actions: PermissionAction[] };

export type PolicyDefinition = {
  name: string;
  icon: string;
  description: string;
  appAccess: boolean;
  grants: CollectionGrant[];
};

export type PermissionRow = {
  policy: string;
  collection: GrantedCollection;
  action: PermissionAction;
  fields: string[];
  permissions: null;
  validation: null;
  presets: null;
};

export const PUBLIC_POLICY_ID = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17';

export const publicCollections: (keyof EditorialSchema)[] = [
  'site_settings',
  'sections',
  'published_articles',
  'published_references',
  'published_images',
  'home_features',
];

export const privateCollections: (keyof EditorialSchema)[] = [
  'editorial_line',
  'watch_sources',
  'materials',
  'articles',
  'article_references',
  'article_images',
  'verification_points',
  'review_remarks',
];

const allActions: PermissionAction[] = ['create', 'read', 'update', 'delete'];

function grant(collections: GrantedCollection[], actions: PermissionAction[]): CollectionGrant[] {
  return collections.map((collection) => ({ collection, actions }));
}

export const publicGrants: CollectionGrant[] = grant(publicCollections, ['read']);

export const editorPolicy: PolicyDefinition = {
  name: 'Rédaction',
  icon: 'edit_note',
  description: 'Prépare, relit et publie les articles.',
  appAccess: true,
  grants: [
    ...grant(publicCollections, allActions),
    ...grant(privateCollections, allActions),
    ...grant(['directus_files', 'directus_folders'], allActions),
    ...grant(['directus_users', 'directus_flows', 'directus_operations'], ['read']),
  ],
};

export function assistantPolicy(appAccess: boolean): PolicyDefinition {
  return {
    name: 'Assistant IA',
    icon: 'smart_toy',
    description: 'Prépare des brouillons via MCP. Ne publie pas et n’administre pas.',
    appAccess,
    grants: [
      ...grant(publicCollections, ['read']),
      ...grant(['editorial_line', 'watch_sources', 'materials'], ['read']),
      ...grant(['articles', 'verification_points'], ['create', 'read', 'update']),
      ...grant(['article_references', 'article_images'], allActions),
      ...grant(['review_remarks'], ['read', 'update']),
      ...grant(['directus_files'], ['create', 'read', 'update']),
      ...grant(['directus_folders'], ['read']),
    ],
  };
}

export function toPermissionRows(policyId: string, grants: CollectionGrant[]): PermissionRow[] {
  return grants.flatMap((collectionGrant) =>
    collectionGrant.actions.map((action) => ({
      policy: policyId,
      collection: collectionGrant.collection,
      action,
      fields: ['*'],
      permissions: null,
      validation: null,
      presets: null,
    })),
  );
}

export function grantKeys(grants: CollectionGrant[]): string[] {
  return grants.flatMap((collectionGrant) => collectionGrant.actions.map((action) => `${collectionGrant.collection}:${action}`)).toSorted();
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter @my-media/cms-provision test`
Expected: PASS (all provision unit tests).

- [ ] **Step 5: Write the failing access integration tests**

`cms/tests/src/access.test.ts`:

```ts
import {
  createFlow,
  createItem,
  createPermissions,
  createRole,
  createUser,
  deleteFile,
  deleteItem,
  readFiles,
  readFlows,
  readItems,
  readOperations,
  readPermissions,
  readPolicies,
  readRole,
  readSingleton,
  readUsers,
  updateItem,
  updateItemsBatch,
  updateMe,
  updatePolicy,
  updateSettings,
  updateSingleton,
} from '@directus/sdk';
import { assistantPolicy, editorPolicy, grantKeys, PUBLIC_POLICY_ID, publicGrants } from '@my-media/cms-provision/access';
import type { CollectionGrant } from '@my-media/cms-provision/access';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { adminClient, anonymousClient, assistantClient, editorClient } from './support/clients.ts';
import { testEnvironment } from './support/environment.ts';
import { captureErrorCode } from './support/errors.ts';
import { createArticle, draftArticleValues, ONE_PIXEL_PNG, uniqueSuffix, uploadFile } from './support/fixtures.ts';

const suffix = uniqueSuffix();
const draftOnlyWord = `motprive${suffix}`;
const now = new Date().toISOString();

const editorArticleId = await createArticle(editorClient, {
  ...draftArticleValues(suffix),
  body: `Texte de travail contenant ${draftOnlyWord}.`,
});
const editorPointId = (
  await editorClient.request(createItem('verification_points', { article: editorArticleId, claim: 'Chiffre à confirmer' }, { fields: ['id'] }))
).id;
const editorRemarkId = (
  await editorClient.request(createItem('review_remarks', { article: editorArticleId, body: 'Préciser la date.' }, { fields: ['id'] }))
).id;
const publishedFixtureId = (
  await adminClient.request(
    createItem(
      'published_articles',
      { article: editorArticleId, slug: `publie-${suffix}`, title: `Version publique ${suffix}`, first_published_at: now, last_published_at: now },
      { fields: ['id'] },
    ),
  )
).id;
const privateFileId = await uploadFile(editorClient, `prive-${suffix}.png`, ONE_PIXEL_PNG, 'image/png');

const [assistantPolicyRecord] = await adminClient.request(
  readPolicies({ filter: { name: { _eq: 'Assistant IA' } }, fields: ['id'], limit: 1 }),
);
if (assistantPolicyRecord === undefined) {
  throw new Error('Politique « Assistant IA » introuvable : lancez pnpm provision.');
}
const assistantPolicyId = assistantPolicyRecord.id;

type NamedRequest = [string, () => Promise<unknown>];

describe('anonymous visitor', () => {
  it('reads published content', async () => {
    const published = await anonymousClient.request(
      readItems('published_articles', { filter: { id: { _eq: publishedFixtureId } }, fields: ['id', 'title'] }),
    );

    expect(published).toHaveLength(1);
    await expect(anonymousClient.request(readItems('sections'))).resolves.toBeDefined();
    await expect(anonymousClient.request(readSingleton('site_settings'))).resolves.toBeDefined();
  });

  const privateReads: NamedRequest[] = [
    ['articles', () => anonymousClient.request(readItems('articles'))],
    ['article_references', () => anonymousClient.request(readItems('article_references'))],
    ['article_images', () => anonymousClient.request(readItems('article_images'))],
    ['verification_points', () => anonymousClient.request(readItems('verification_points'))],
    ['review_remarks', () => anonymousClient.request(readItems('review_remarks'))],
    ['materials', () => anonymousClient.request(readItems('materials'))],
    ['watch_sources', () => anonymousClient.request(readItems('watch_sources'))],
    ['editorial_line', () => anonymousClient.request(readSingleton('editorial_line'))],
    ['directus_files', () => anonymousClient.request(readFiles())],
  ];

  it.each(privateReads)('cannot read %s', async (_name, request) => {
    expect(await captureErrorCode(request())).toBe('FORBIDDEN');
  });

  it('cannot download a private file', async () => {
    const response = await fetch(`${testEnvironment.directusUrl}/assets/${privateFileId}`);

    expect(response.status).toBe(403);
  });

  it('finds nothing when searching for a word that only exists in a draft', async () => {
    const results = await anonymousClient.request(readItems('published_articles', { search: draftOnlyWord, fields: ['id'] }));

    expect(results).toEqual([]);
  });
});

describe('assistant', () => {
  it('reads the private working data', async () => {
    await expect(assistantClient.request(readItems('materials'))).resolves.toBeDefined();
    await expect(assistantClient.request(readItems('watch_sources'))).resolves.toBeDefined();
    await expect(assistantClient.request(readSingleton('editorial_line'))).resolves.toBeDefined();
    const drafts = await assistantClient.request(readItems('articles', { filter: { id: { _eq: editorArticleId } }, fields: ['id'] }));

    expect(drafts).toHaveLength(1);
  });

  it('prepares a draft with sources, images, verification points and remark answers', async () => {
    const draftSuffix = uniqueSuffix();
    const articleId = await createArticle(assistantClient, draftArticleValues(draftSuffix));
    const referenceId = (
      await assistantClient.request(createItem('article_references', { article: articleId, title: 'Rapport', sort: 1 }, { fields: ['id'] }))
    ).id;
    await assistantClient.request(updateItem('article_references', referenceId, { organization: 'Insee' }));
    await assistantClient.request(deleteItem('article_references', referenceId));
    const fileId = await uploadFile(assistantClient, `illustration-${draftSuffix}.png`, ONE_PIXEL_PNG, 'image/png');
    await assistantClient.request(createItem('article_images', { article: articleId, file: fileId, alt: 'Illustration', sort: 1 }));
    await assistantClient.request(createItem('verification_points', { article: articleId, claim: 'Date à confirmer' }));
    await assistantClient.request(updateItem('review_remarks', editorRemarkId, { status: 'addressed', response_note: 'Date ajoutée.' }));

    const images = await editorClient.request(readItems('article_images', { filter: { article: { _eq: articleId } }, fields: ['id'] }));
    expect(images).toHaveLength(1);
  });

  it('changes the preparation status without publishing anything', async () => {
    const articleId = await createArticle(assistantClient, draftArticleValues(uniqueSuffix()));
    await assistantClient.request(updateItem('articles', articleId, { preparation_status: 'ready_for_review' }));
    const publicCopies = await anonymousClient.request(
      readItems('published_articles', { filter: { article: { _eq: articleId } }, fields: ['id'] }),
    );

    expect(publicCopies).toEqual([]);
  });

  const forbiddenContentWrites: NamedRequest[] = [
    ['create published_articles', () => assistantClient.request(createItem('published_articles', { article: editorArticleId, slug: `ia-${suffix}`, title: 'IA', first_published_at: now, last_published_at: now }))],
    ['update published_articles', () => assistantClient.request(updateItem('published_articles', publishedFixtureId, { title: 'Modifié par IA' }))],
    ['batch update published_articles', () => assistantClient.request(updateItemsBatch('published_articles', [{ id: publishedFixtureId, title: 'Lot IA' }]))],
    ['delete published_articles', () => assistantClient.request(deleteItem('published_articles', publishedFixtureId))],
    ['create published_references', () => assistantClient.request(createItem('published_references', { published_article: publishedFixtureId, sort: 1, title: 'IA' }))],
    ['create published_images', () => assistantClient.request(createItem('published_images', { published_article: publishedFixtureId, sort: 1, public_file_name: 'x.webp', width: 1, height: 1, alt: 'IA' }))],
    ['create home_features', () => assistantClient.request(createItem('home_features', { published_article: publishedFixtureId, placement: 'lead' }))],
    ['update site_settings', () => assistantClient.request(updateSingleton('site_settings', { media_name: 'IA' }))],
    ['update editorial_line', () => assistantClient.request(updateSingleton('editorial_line', { tone: 'IA' }))],
    ['create sections', () => assistantClient.request(createItem('sections', { name: 'IA', slug: `ia-${suffix}` }))],
    ['create watch_sources', () => assistantClient.request(createItem('watch_sources', { name: 'IA', kind: 'site' }))],
    ['create materials', () => assistantClient.request(createItem('materials', { title: 'IA' }))],
    ['create review_remarks', () => assistantClient.request(createItem('review_remarks', { article: editorArticleId, body: 'IA' }))],
    ['delete articles', () => assistantClient.request(deleteItem('articles', editorArticleId))],
    ['delete verification_points', () => assistantClient.request(deleteItem('verification_points', editorPointId))],
    ['delete directus_files', () => assistantClient.request(deleteFile(privateFileId))],
  ];

  it.each(forbiddenContentWrites)('is refused: %s', async (_name, request) => {
    expect(await captureErrorCode(request())).toBe('FORBIDDEN');
  });

  const forbiddenAdministration: NamedRequest[] = [
    ['read permissions', () => assistantClient.request(readPermissions())],
    ['read policies', () => assistantClient.request(readPolicies())],
    ['read flows', () => assistantClient.request(readFlows())],
    ['read operations', () => assistantClient.request(readOperations())],
    ['grant itself a permission', () => assistantClient.request(createPermissions([{ policy: assistantPolicyId, collection: 'published_articles', action: 'create', fields: ['*'] }]))],
    ['promote its policy', () => assistantClient.request(updatePolicy(assistantPolicyId, { admin_access: true }))],
    ['create a role', () => assistantClient.request(createRole({ name: `Évasion ${suffix}` }))],
    ['create a user', () => assistantClient.request(createUser({ email: `evasion-${suffix}@example.com`, password: 'mot-de-passe-long', role: testEnvironment.editorRoleId }))],
    ['change its own role', () => assistantClient.request(updateMe({ role: testEnvironment.editorRoleId }))],
    ['change settings', () => assistantClient.request(updateSettings({ mcp_allow_deletes: false }))],
    ['create a flow', () => assistantClient.request(createFlow({ name: `Évasion ${suffix}`, trigger: 'manual', status: 'active' }))],
  ];

  it.each(forbiddenAdministration)('is refused: %s', async (_name, request) => {
    expect(await captureErrorCode(request())).toBe('FORBIDDEN');
  });
});

describe('editor', () => {
  it('reads flows so the Studio can show the Publier button', async () => {
    await expect(editorClient.request(readFlows({ fields: ['id'] }))).resolves.toBeDefined();
  });

  it('cannot change permissions or settings', async () => {
    expect(await captureErrorCode(editorClient.request(createPermissions([{ policy: assistantPolicyId, collection: 'published_articles', action: 'create', fields: ['*'] }])))).toBe('FORBIDDEN');
    expect(await captureErrorCode(editorClient.request(updateSettings({ mcp_allow_deletes: false })))).toBe('FORBIDDEN');
  });
});

const rolePolicies = z.object({ policies: z.array(z.object({ policy: z.object({ name: z.string() }) })) });
const userPolicies = z.array(z.object({ policies: z.array(z.unknown()) }));
const permissionRow = z.object({
  collection: z.string(),
  action: z.string(),
  fields: z.array(z.string()).nullable(),
  permissions: z.unknown(),
  validation: z.unknown(),
  presets: z.unknown(),
});

async function readPolicyId(name: string): Promise<string> {
  const [policy] = await adminClient.request(readPolicies({ filter: { name: { _eq: name } }, fields: ['id'], limit: 1 }));
  if (policy === undefined) {
    throw new Error(`Politique « ${name} » introuvable.`);
  }
  return policy.id;
}

async function readPermissionRows(policyId: string) {
  const rows = await adminClient.request(
    readPermissions({ filter: { policy: { _eq: policyId } }, fields: ['collection', 'action', 'fields', 'permissions', 'validation', 'presets'], limit: -1 }),
  );
  return z.array(permissionRow).parse(rows);
}

describe('policy inspection', () => {
  it('gives the assistant role only the assistant policy', async () => {
    const role = rolePolicies.parse(
      await adminClient.request(readRole(testEnvironment.assistantRoleId, { fields: [{ policies: [{ policy: ['name'] }] }] })),
    );

    expect(role.policies.map((access) => access.policy.name)).toEqual(['Assistant IA']);
  });

  it('attaches no extra policy directly to assistant users', async () => {
    const users = userPolicies.parse(
      await adminClient.request(readUsers({ filter: { role: { _eq: testEnvironment.assistantRoleId } }, fields: [{ policies: ['id'] }] })),
    );

    expect(users.flatMap((user) => user.policies)).toEqual([]);
  });

  it('never gives the assistant administrator access', async () => {
    const [policy] = await adminClient.request(
      readPolicies({ filter: { id: { _eq: assistantPolicyId } }, fields: ['admin_access', 'app_access'], limit: 1 }),
    );

    expect(policy?.admin_access).toBe(false);
    expect(policy?.app_access).toBe(testEnvironment.assistantAppAccess);
  });

  const managedPolicies: [string, () => Promise<string>, CollectionGrant[]][] = [
    ['Public', async () => PUBLIC_POLICY_ID, publicGrants],
    ['Rédaction', () => readPolicyId('Rédaction'), editorPolicy.grants],
    ['Assistant IA', () => readPolicyId('Assistant IA'), assistantPolicy(testEnvironment.assistantAppAccess).grants],
  ];

  it.each(managedPolicies)('stores exactly the %s permissions, without custom rules', async (_name, readId, expectedGrants) => {
    const rows = await readPermissionRows(await readId());
    const restrictedRows = rows.filter(
      (row) => row.fields?.join(',') !== '*' || row.permissions !== null || row.validation !== null || row.presets !== null,
    );

    expect(rows.map((row) => `${row.collection}:${row.action}`).toSorted()).toEqual(grantKeys(expectedGrants));
    expect(restrictedRows).toEqual([]);
  });
});
```

`cms/tests/src/limits.test.ts`:

```ts
import { readCollections, readFlows, readUsers } from '@directus/sdk';
import { describe, expect, it } from 'vitest';
import { adminClient } from './support/clients.ts';

describe('Directus Core limits', () => {
  it('uses at most 25 custom collections', async () => {
    const collections = await adminClient.request(readCollections());
    const customCollections = collections.filter((collection) => !collection.collection.startsWith('directus_'));

    expect(customCollections.length).toBeLessThanOrEqual(25);
  });

  it('uses at most 5 flows', async () => {
    const flows = await adminClient.request(readFlows({ fields: ['id'], limit: -1 }));

    expect(flows.length).toBeLessThanOrEqual(5);
  });

  it('keeps at most 3 active users, the seat limit', async () => {
    const users = await adminClient.request(readUsers({ filter: { status: { _eq: 'active' } }, fields: ['id'], limit: -1 }));

    expect(users.length).toBeLessThanOrEqual(3);
  });
});
```

Counting all active users (admin, editor, assistant) is stricter than counting seats, so the seat limit cannot be exceeded silently.

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm test:cms`
Expected: FAIL at module load of `access.test.ts` with `INVALID_CREDENTIALS` / `401` (the editor and assistant tokens do not exist yet).

- [ ] **Step 7: Implement `ensureAccess` and call it from `main.ts`**

`cms/provision/src/access/ensure-access.ts`:

```ts
import {
  createPermissions,
  createPolicy,
  createRole,
  createUser,
  deletePermissions,
  readPermissions,
  readPolicies,
  readRoles,
  readUsers,
  updatePolicy,
  updateUser,
} from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import type { AccountEnvironment, ProvisionEnvironment } from '../environment.ts';
import { assistantPolicy, editorPolicy, PUBLIC_POLICY_ID, publicGrants, toPermissionRows } from './policies.ts';
import type { CollectionGrant, PolicyDefinition } from './policies.ts';

type RoleDefinition = { id: string; name: string; icon: string; policyId: string };

type UserDefinition = { account: AccountEnvironment; firstName: string };

export async function ensureAccess(client: AdminClient, environment: ProvisionEnvironment, log: Log): Promise<void> {
  const assistant = assistantPolicy(environment.assistant.appAccess);
  const editorPolicyId = await ensurePolicy(client, editorPolicy, log);
  const assistantPolicyId = await ensurePolicy(client, assistant, log);

  await replacePermissions(client, PUBLIC_POLICY_ID, publicGrants, log);
  await replacePermissions(client, editorPolicyId, editorPolicy.grants, log);
  await replacePermissions(client, assistantPolicyId, assistant.grants, log);

  await ensureRole(client, { id: environment.editor.roleId, name: 'Rédaction', icon: 'edit_note', policyId: editorPolicyId }, log);
  await ensureRole(client, { id: environment.assistant.roleId, name: 'Assistant IA', icon: 'smart_toy', policyId: assistantPolicyId }, log);

  await ensureUser(client, { account: environment.editor, firstName: 'Rédaction' }, log);
  await ensureUser(client, { account: environment.assistant, firstName: 'Assistant' }, log);
}

async function ensurePolicy(client: AdminClient, definition: PolicyDefinition, log: Log): Promise<string> {
  const values = {
    name: definition.name,
    icon: definition.icon,
    description: definition.description,
    app_access: definition.appAccess,
    admin_access: false,
    enforce_tfa: false,
  };
  const [existing] = await client.request(readPolicies({ filter: { name: { _eq: definition.name } }, fields: ['id'], limit: 1 }));
  if (existing === undefined) {
    const created = await client.request(createPolicy(values, { fields: ['id'] }));
    log(`Politique créée : ${definition.name}`);
    return created.id;
  }
  await client.request(updatePolicy(existing.id, values));
  return existing.id;
}

async function replacePermissions(client: AdminClient, policyId: string, grants: CollectionGrant[], log: Log): Promise<void> {
  const existing = await client.request(readPermissions({ filter: { policy: { _eq: policyId } }, fields: ['id'], limit: -1 }));
  // Directus can add synthetic app permissions without an id to this list; only stored rows can be deleted.
  const storedIds = existing.map((permission) => permission.id).filter((id) => typeof id === 'number');
  if (storedIds.length > 0) {
    await client.request(deletePermissions(storedIds));
  }
  await client.request(createPermissions(toPermissionRows(policyId, grants)));
  log(`Permissions appliquées à la politique ${policyId}`);
}

async function ensureRole(client: AdminClient, definition: RoleDefinition, log: Log): Promise<void> {
  const [existing] = await client.request(readRoles({ filter: { id: { _eq: definition.id } }, fields: ['id'], limit: 1 }));
  if (existing !== undefined) {
    return;
  }
  await client.request(
    createRole({ id: definition.id, name: definition.name, icon: definition.icon, policies: [{ policy: definition.policyId }] }),
  );
  log(`Rôle créé : ${definition.name}`);
}

async function ensureUser(client: AdminClient, definition: UserDefinition, log: Log): Promise<void> {
  const { account } = definition;
  const [existing] = await client.request(readUsers({ filter: { email: { _eq: account.email } }, fields: ['id'], limit: 1 }));
  if (existing === undefined) {
    await client.request(
      createUser({
        email: account.email,
        password: account.password,
        first_name: definition.firstName,
        role: account.roleId,
        status: 'active',
        token: account.token,
      }),
    );
    log(`Utilisateur créé : ${account.email}`);
    return;
  }
  await client.request(updateUser(existing.id, { role: account.roleId, status: 'active', token: account.token }));
}
```

Passwords are only set when a user is created, so a password changed later in the Studio is not overwritten. Tokens are always converged: when `EDITOR_TOKEN` or `AI_TOKEN` is absent (production), the static token is removed.

Replace `cms/provision/src/main.ts` with:

```ts
import { isDirectusError } from '@directus/sdk';
import { ensureAccess } from './access/ensure-access.ts';
import { createAdminClient } from './directus-client.ts';
import { readProvisionEnvironment } from './environment.ts';
import { editorialCollections } from './schema/collections.ts';
import { ensureSchema } from './schema/ensure-schema.ts';
import { editorialRelations } from './schema/relations.ts';

function log(message: string): void {
  console.log(message);
}

async function provision(): Promise<void> {
  const environment = readProvisionEnvironment(process.env);
  const client = createAdminClient(environment.directusUrl, environment.adminToken);

  await ensureSchema(client, editorialCollections(environment.siteUrl), editorialRelations, log);
  await ensureAccess(client, environment, log);
  log('Provisionnement terminé.');
}

function describeFailure(error: unknown): string {
  if (isDirectusError(error)) {
    return error.errors.map((detail) => `${detail.extensions.code} : ${detail.message}`).join('\n');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

try {
  await provision();
} catch (error) {
  console.error(`Échec du provisionnement :\n${describeFailure(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 8: Provision and run the tests to see them pass**

Run: `pnpm provision`
Expected: `Politique créée` twice, `Permissions appliquées` three times, `Rôle créé` twice, `Utilisateur créé` twice, then `Provisionnement terminé.` No `RESOURCE_RESTRICTED` error.

Run: `pnpm test:cms`
Expected: PASS (server, schema, access, limits).

Run: `pnpm test && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add cms/provision cms/tests
git diff --cached --check
git commit -m "feat(cms): restrict access with collection-level policies"
```

---

### Task 4: Creation-key hook in the editorial extension

**Files:**
- Create: `cms/extensions/editorial/package.json`, `cms/extensions/editorial/tsconfig.json`
- Create: `cms/extensions/editorial/src/errors.ts`, `cms/extensions/editorial/src/guards.ts`
- Create: `cms/extensions/editorial/src/require-creation-key/creation-key.ts`, `cms/extensions/editorial/src/require-creation-key/creation-key.test.ts`, `cms/extensions/editorial/src/require-creation-key/index.ts`
- Modify: `compose.yaml` (mount the extension)
- Test: `cms/tests/src/creation-key.test.ts`

**Interfaces:**
- Consumes: `AI_ROLE_ID` env (Task 1), test support (Task 2).
- Produces: errors `PublicationError` (`{ reason: string }`, code `PUBLICATION_FAILED`, 500), `CreationKeyRequiredError` (`CREATION_KEY_REQUIRED`, 400), `ArticleSelectionError` (`INVALID_ARTICLE_SELECTION`, 400), `EditorialConfigurationError` (`{ variable: string }`, `EDITORIAL_CONFIGURATION_MISSING`, 503) in `src/errors.ts`; `isRecord(value: unknown): value is Record<string, unknown>` in `src/guards.ts`; `assertCreationKeyPresent<T>(payload: T, accountability: Accountability | null, assistantRoleId: string): T` and `readAssistantRoleId(environment: Record<string, unknown>): string`.

Directus Core cannot express "the assistant must send a non-empty `creation_key`" as a permission rule (validation rules are custom rules). A `filter` hook on `articles.items.create` runs for every creation path that goes through Directus services: REST, batch create, nested create and the MCP `items` tool.

- [ ] **Step 1: Create the extension package**

`cms/extensions/editorial/package.json`:

```json
{
  "name": "directus-extension-editorial",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "directus:extension": {
    "type": "bundle",
    "path": {
      "app": "dist/app.js",
      "api": "dist/api.js"
    },
    "entries": [
      {
        "type": "hook",
        "name": "require-creation-key",
        "source": "src/require-creation-key/index.ts"
      }
    ],
    "host": "^12.5.0"
  },
  "scripts": {
    "build": "directus-extension build",
    "dev": "directus-extension build --watch --no-minify",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@directus/errors": "3.0.0"
  },
  "devDependencies": {
    "@directus/extensions-sdk": "18.0.6",
    "@directus/types": "18.0.0",
    "@types/node": "^24.19.2",
    "knex": "3.1.0",
    "pino": "9.7.0",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```

`knex` and `pino` are only installed so the types in `@directus/types` resolve; Directus provides the real instances at runtime. `@directus/errors` is bundled into `dist/api.js`.

`cms/extensions/editorial/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}
```

The extension is bundled by Rollup, so it uses `Bundler` resolution instead of the `NodeNext` default.

- [ ] **Step 2: Write the failing hook tests**

`cms/extensions/editorial/src/require-creation-key/creation-key.test.ts`:

```ts
import type { Accountability } from '@directus/types';
import { describe, expect, it } from 'vitest';
import { CreationKeyRequiredError, EditorialConfigurationError } from '../errors.ts';
import { assertCreationKeyPresent, readAssistantRoleId } from './creation-key.ts';

const ASSISTANT_ROLE_ID = '6f1d1f4e-2b7a-4c55-9f58-4c1b3e8a9d21';
const EDITOR_ROLE_ID = '2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42';

function accountabilityFor(role: string): Accountability {
  return { role, roles: [role], user: 'user-id', admin: false, app: false, ip: null };
}

describe('assertCreationKeyPresent', () => {
  it('lets the assistant create an article with a creation key', () => {
    const payload = { title: 'Titre', creation_key: '2026-10-10-budget' };

    expect(assertCreationKeyPresent(payload, accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID)).toBe(payload);
  });

  it('rejects an assistant article without a creation key', () => {
    expect(() => assertCreationKeyPresent({ title: 'Titre' }, accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID)).toThrow(
      CreationKeyRequiredError,
    );
  });

  it('rejects a blank creation key', () => {
    expect(() =>
      assertCreationKeyPresent({ title: 'Titre', creation_key: '   ' }, accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID),
    ).toThrow(CreationKeyRequiredError);
  });

  it('rejects a payload that is not an object', () => {
    expect(() => assertCreationKeyPresent('texte', accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID)).toThrow(
      CreationKeyRequiredError,
    );
  });

  it('does not constrain the editorial team or system tasks', () => {
    const payload = { title: 'Titre' };

    expect(assertCreationKeyPresent(payload, accountabilityFor(EDITOR_ROLE_ID), ASSISTANT_ROLE_ID)).toBe(payload);
    expect(assertCreationKeyPresent(payload, null, ASSISTANT_ROLE_ID)).toBe(payload);
  });
});

describe('readAssistantRoleId', () => {
  it('reads AI_ROLE_ID', () => {
    expect(readAssistantRoleId({ AI_ROLE_ID: ASSISTANT_ROLE_ID })).toBe(ASSISTANT_ROLE_ID);
  });

  it('fails closed when AI_ROLE_ID is missing', () => {
    expect(() => readAssistantRoleId({})).toThrow(EditorialConfigurationError);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm install && pnpm --filter directus-extension-editorial test`
Expected: FAIL with `Failed to load url ../errors.ts`.

- [ ] **Step 4: Implement errors, guard, rule and hook**

`cms/extensions/editorial/src/errors.ts`:

```ts
import { createError } from '@directus/errors';

export const PublicationError = createError<{ reason: string }>(
  'PUBLICATION_FAILED',
  ({ reason }) => `La publication a échoué : ${reason}. La version publique précédente est conservée.`,
  500,
);

export const CreationKeyRequiredError = createError(
  'CREATION_KEY_REQUIRED',
  'Le compte assistant doit fournir une creation_key stable pour créer un article.',
  400,
);

export const ArticleSelectionError = createError(
  'INVALID_ARTICLE_SELECTION',
  'Sélectionnez exactement un article à publier.',
  400,
);

export const EditorialConfigurationError = createError<{ variable: string }>(
  'EDITORIAL_CONFIGURATION_MISSING',
  ({ variable }) => `Configuration incomplète : la variable ${variable} est absente.`,
  503,
);
```

`cms/extensions/editorial/src/guards.ts`:

```ts
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

`cms/extensions/editorial/src/require-creation-key/creation-key.ts`:

```ts
import type { Accountability } from '@directus/types';
import { CreationKeyRequiredError, EditorialConfigurationError } from '../errors.ts';
import { isRecord } from '../guards.ts';

export function readAssistantRoleId(environment: Record<string, unknown>): string {
  const roleId = environment['AI_ROLE_ID'];
  if (typeof roleId !== 'string' || roleId === '') {
    throw new EditorialConfigurationError({ variable: 'AI_ROLE_ID' });
  }
  return roleId;
}

export function assertCreationKeyPresent<T>(payload: T, accountability: Accountability | null, assistantRoleId: string): T {
  if (accountability?.role !== assistantRoleId) {
    return payload;
  }
  if (!isRecord(payload)) {
    throw new CreationKeyRequiredError();
  }
  const creationKey = payload['creation_key'];
  if (typeof creationKey !== 'string' || creationKey.trim() === '') {
    throw new CreationKeyRequiredError();
  }
  return payload;
}
```

`cms/extensions/editorial/src/require-creation-key/index.ts`:

```ts
import { defineHook } from '@directus/extensions-sdk';
import { assertCreationKeyPresent, readAssistantRoleId } from './creation-key.ts';

export default defineHook(({ filter }, { env }) => {
  filter('articles.items.create', (payload, _meta, context) =>
    assertCreationKeyPresent(payload, context.accountability, readAssistantRoleId(env)),
  );
});
```

`AI_ROLE_ID` is read on every creation rather than once at start-up, so a missing variable blocks article creation with a clear error instead of silently disabling the rule.

- [ ] **Step 5: Run them to see them pass**

Run: `pnpm --filter directus-extension-editorial test`
Expected: PASS, 7 tests.

- [ ] **Step 6: Write the failing integration test**

`cms/tests/src/creation-key.test.ts`:

```ts
import { readItems } from '@directus/sdk';
import { describe, expect, it } from 'vitest';
import { assistantClient, editorClient } from './support/clients.ts';
import { captureErrorCode } from './support/errors.ts';
import { createArticle, draftArticleValues, uniqueSuffix } from './support/fixtures.ts';

describe('creation key', () => {
  it('refuses an assistant draft without a creation key', async () => {
    const { creation_key: _omitted, ...values } = draftArticleValues(uniqueSuffix());

    expect(await captureErrorCode(createArticle(assistantClient, values))).toBe('CREATION_KEY_REQUIRED');
  });

  it('lets the assistant find its draft again after a duplicate attempt', async () => {
    const suffix = uniqueSuffix();
    const values = draftArticleValues(suffix);
    const articleId = await createArticle(assistantClient, values);

    const retry = createArticle(assistantClient, { ...values, slug: `nouvel-essai-${suffix}` });
    expect(await captureErrorCode(retry)).toBe('RECORD_NOT_UNIQUE');

    const found = await assistantClient.request(
      readItems('articles', { filter: { creation_key: { _eq: values.creation_key ?? '' } }, fields: ['id'] }),
    );
    expect(found.map((article) => article.id)).toEqual([articleId]);
  });

  it('lets the editorial team create an article without a creation key', async () => {
    const { creation_key: _omitted, ...values } = draftArticleValues(uniqueSuffix());

    await expect(createArticle(editorClient, values)).resolves.toEqual(expect.any(String));
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `pnpm test:cms`
Expected: FAIL in `creation-key.test.ts`: `La requête devait être refusée mais elle a réussi.` (no hook loaded yet).

- [ ] **Step 8: Build and mount the extension**

Run: `pnpm build:extension`
Expected: `Done` and files `cms/extensions/editorial/dist/app.js` and `dist/api.js`.

In `compose.yaml`, add the extension mount to the `directus` service volumes:

```yaml
    volumes:
      - uploads:/directus/uploads
      - ./.data/public-media:/directus/public-media
      - ./cms/extensions/editorial:/directus/extensions/editorial:ro
```

Run: `pnpm cms:up`
Expected: the `directus` container is recreated and becomes healthy.

Run: `docker compose logs directus | grep -i extension`
Expected: a line listing the loaded extension `editorial` and no extension error.

- [ ] **Step 9: Run the tests to see them pass**

Run: `pnpm test:cms`
Expected: PASS, including the three creation-key tests.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add cms/extensions/editorial compose.yaml cms/tests pnpm-lock.yaml
git diff --cached --check
git commit -m "feat(cms): require a creation key for assistant drafts"
```

---

### Task 5: Publication plan (pure logic)

**Files:**
- Create: `cms/extensions/editorial/src/publish-article/publication.ts`
- Test: `cms/extensions/editorial/src/publish-article/publication.test.ts`

**Interfaces:**
- Consumes: `PublicationError` (Task 4).
- Produces: types `DraftImageFile` (`{ id: string; type: string | null; width: number | null; height: number | null }`), `DraftReference`, `DraftImage`, `DraftArticle`, `PublishedArticleValues`, `PublishedReferenceValues`, `PublishedImageValues`, `PlannedImage` (`{ sourceFileId: string; values: PublishedImageValues }`), `PublicationPlan` (`{ article; references; images }`); constant `PUBLIC_IMAGE_MAX_WIDTH = 2000`; function `buildPublication(draft: DraftArticle, publishedAt: Date, createPublicFileName: () => string): PublicationPlan`.

This module decides what the public copy contains. It has no I/O, so every rule is unit-tested here: field whitelist, ordering, numbering, image format and size.

- [ ] **Step 1: Write the failing tests**

`cms/extensions/editorial/src/publish-article/publication.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PublicationError } from '../errors.ts';
import { buildPublication } from './publication.ts';
import type { DraftArticle, DraftImage, DraftReference } from './publication.ts';

const publishedAt = new Date('2026-10-10T08:30:00.000Z');

function reference(title: string, sort: number | null): DraftReference {
  return { sort, organization: 'Insee', title, url: 'https://example.org', author: null, publication: null, published_on: '2026-09-01', note: null };
}

function image(fileId: string, sort: number | null, width: number | null, height: number | null, type: string | null): DraftImage {
  return { sort, alt: `Image ${fileId}`, caption: null, credit: 'Rédaction', file: { id: fileId, type, width, height } };
}

function draft(overrides: Partial<DraftArticle>): DraftArticle {
  return {
    id: 'article-1',
    title: 'Le budget local',
    slug: 'le-budget-local',
    summary: 'Chapô',
    body: 'Texte[^1]',
    byline: 'La rédaction',
    format: 'Enquête',
    section: 'section-1',
    references: [],
    images: [],
    ...overrides,
  };
}

function fileNames(...names: string[]): () => string {
  const queue = names.values();
  return () => {
    const next = queue.next();
    if (next.done === true) {
      throw new Error('Plus de noms de fichiers de test');
    }
    return next.value;
  };
}

describe('buildPublication', () => {
  it('copies the public article fields and stamps the publication time', () => {
    const plan = buildPublication(draft({}), publishedAt, fileNames());

    expect(plan.article).toEqual({
      article: 'article-1',
      slug: 'le-budget-local',
      title: 'Le budget local',
      summary: 'Chapô',
      body: 'Texte[^1]',
      byline: 'La rédaction',
      format: 'Enquête',
      section: 'section-1',
      last_published_at: '2026-10-10T08:30:00.000Z',
    });
  });

  it('orders sources by position, puts unpositioned ones last and renumbers from 1', () => {
    const plan = buildPublication(
      draft({ references: [reference('Sans position', null), reference('Deuxième', 7), reference('Première', 3)] }),
      publishedAt,
      fileNames(),
    );

    expect(plan.references.map((item) => [item.sort, item.title])).toEqual([
      [1, 'Première'],
      [2, 'Deuxième'],
      [3, 'Sans position'],
    ]);
  });

  it('only copies public reference and image fields', () => {
    const plan = buildPublication(
      draft({ references: [reference('Rapport', 1)], images: [image('file-1', 1, 800, 600, 'image/jpeg')] }),
      publishedAt,
      fileNames('a.webp'),
    );

    expect(Object.keys(plan.references[0] ?? {}).toSorted()).toEqual(
      ['author', 'note', 'organization', 'published_on', 'publication', 'sort', 'title', 'url'].toSorted(),
    );
    expect(Object.keys(plan.images[0]?.values ?? {}).toSorted()).toEqual(
      ['alt', 'caption', 'credit', 'height', 'public_file_name', 'sort', 'width'].toSorted(),
    );
  });

  it('gives each image a fresh public file name in display order', () => {
    const plan = buildPublication(
      draft({ images: [image('second', 2, 800, 600, 'image/png'), image('first', 1, 800, 600, 'image/jpeg')] }),
      publishedAt,
      fileNames('one.webp', 'two.webp'),
    );

    expect(plan.images.map((item) => [item.sourceFileId, item.values.sort, item.values.public_file_name])).toEqual([
      ['first', 1, 'one.webp'],
      ['second', 2, 'two.webp'],
    ]);
  });

  it('scales wide images to 2000 pixels and keeps the ratio', () => {
    const plan = buildPublication(
      draft({ images: [image('wide', 1, 4000, 3000, 'image/jpeg'), image('small', 2, 1200, 900, 'image/webp')] }),
      publishedAt,
      fileNames('wide.webp', 'small.webp'),
    );

    expect(plan.images.map((item) => [item.values.width, item.values.height])).toEqual([
      [2000, 1500],
      [1200, 900],
    ]);
  });

  it('refuses an unsupported file type with a readable reason', () => {
    const action = () => buildPublication(draft({ images: [image('doc', 1, 100, 100, 'application/pdf')] }), publishedAt, fileNames('x.webp'));

    expect(action).toThrow(PublicationError);
    expect(action).toThrow('n’est pas pris en charge');
  });

  it('refuses an image whose dimensions are unknown', () => {
    const action = () => buildPublication(draft({ images: [image('broken', 1, null, null, 'image/png')] }), publishedAt, fileNames('x.webp'));

    expect(action).toThrow('dimensions');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter directus-extension-editorial test`
Expected: FAIL with `Failed to load url ./publication.ts`.

- [ ] **Step 3: Implement the publication plan**

`cms/extensions/editorial/src/publish-article/publication.ts`:

```ts
import { PublicationError } from '../errors.ts';

export type DraftImageFile = {
  id: string;
  type: string | null;
  width: number | null;
  height: number | null;
};

export type DraftReference = {
  sort: number | null;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

export type DraftImage = {
  sort: number | null;
  alt: string;
  caption: string | null;
  credit: string | null;
  file: DraftImageFile;
};

export type DraftArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | null;
  references: DraftReference[];
  images: DraftImage[];
};

export type PublishedArticleValues = {
  article: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | null;
  last_published_at: string;
};

export type PublishedReferenceValues = {
  sort: number;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

export type PublishedImageValues = {
  sort: number;
  public_file_name: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type PlannedImage = { sourceFileId: string; values: PublishedImageValues };

export type PublicationPlan = {
  article: PublishedArticleValues;
  references: PublishedReferenceValues[];
  images: PlannedImage[];
};

type Dimensions = { width: number; height: number };

export const PUBLIC_IMAGE_MAX_WIDTH = 2000;

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function buildPublication(draft: DraftArticle, publishedAt: Date, createPublicFileName: () => string): PublicationPlan {
  return {
    article: {
      article: draft.id,
      slug: draft.slug,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      byline: draft.byline,
      format: draft.format,
      section: draft.section,
      last_published_at: publishedAt.toISOString(),
    },
    references: sortByPosition(draft.references).map((reference, index) => toPublishedReference(reference, index + 1)),
    images: sortByPosition(draft.images).map((image, index) => planImage(image, index + 1, createPublicFileName())),
  };
}

function sortByPosition<T extends { sort: number | null }>(items: T[]): T[] {
  return items.toSorted((first, second) => position(first) - position(second));
}

function position(item: { sort: number | null }): number {
  return item.sort ?? Number.MAX_SAFE_INTEGER;
}

function toPublishedReference(reference: DraftReference, sort: number): PublishedReferenceValues {
  return {
    sort,
    organization: reference.organization,
    title: reference.title,
    url: reference.url,
    author: reference.author,
    publication: reference.publication,
    published_on: reference.published_on,
    note: reference.note,
  };
}

function planImage(image: DraftImage, sort: number, publicFileName: string): PlannedImage {
  const dimensions = publicDimensions(image.file);
  return {
    sourceFileId: image.file.id,
    values: {
      sort,
      public_file_name: publicFileName,
      width: dimensions.width,
      height: dimensions.height,
      alt: image.alt,
      caption: image.caption,
      credit: image.credit,
    },
  };
}

function publicDimensions(file: DraftImageFile): Dimensions {
  if (file.type === null || !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new PublicationError({ reason: `le format de l’image ${file.id} n’est pas pris en charge (${file.type ?? 'inconnu'})` });
  }
  if (file.width === null || file.height === null) {
    throw new PublicationError({ reason: `les dimensions de l’image ${file.id} sont inconnues` });
  }
  if (file.width <= PUBLIC_IMAGE_MAX_WIDTH) {
    return { width: file.width, height: file.height };
  }
  return {
    width: PUBLIC_IMAGE_MAX_WIDTH,
    height: Math.round((file.height * PUBLIC_IMAGE_MAX_WIDTH) / file.width),
  };
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter directus-extension-editorial test`
Expected: PASS, 14 tests (7 hook + 7 publication).

Run: `pnpm --filter directus-extension-editorial typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add cms/extensions/editorial/src/publish-article
git diff --cached --check
git commit -m "feat(publication): build the public copy of a draft"
```

---

### Task 6: Public media store

**Files:**
- Create: `cms/extensions/editorial/src/publish-article/public-media-store.ts`
- Test: `cms/extensions/editorial/src/publish-article/public-media-store.test.ts`

**Interfaces:**
- Consumes: `PublicationError` (Task 4).
- Produces: type `PublicMediaStore = { write(fileName: string, content: Readable): Promise<void>; remove(fileName: string): Promise<void> }` and `createFileSystemMediaStore(directory: string): PublicMediaStore`.

Published images are copied, resized and converted to WebP into a directory that only the publish operation writes and the public site reads (plan 2 serves it under `/media/`). Private uploads stay behind Directus permissions. File names are generated UUIDs, never user input, and the store refuses anything else so a crafted name cannot escape the directory.

- [ ] **Step 1: Write the failing tests**

`cms/extensions/editorial/src/publish-article/public-media-store.test.ts`:

```ts
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PublicationError } from '../errors.ts';
import { createFileSystemMediaStore } from './public-media-store.ts';

const FILE_NAME = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e.webp';

async function withTemporaryDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'public-media-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function content(text: string): Readable {
  return Readable.from([Buffer.from(text)]);
}

describe('createFileSystemMediaStore', () => {
  it('writes a public copy under its generated name', async () => {
    await withTemporaryDirectory(async (directory) => {
      await createFileSystemMediaStore(directory).write(FILE_NAME, content('image'));

      expect(await readFile(join(directory, FILE_NAME), 'utf8')).toBe('image');
    });
  });

  it('never overwrites an existing copy', async () => {
    await withTemporaryDirectory(async (directory) => {
      const store = createFileSystemMediaStore(directory);
      await store.write(FILE_NAME, content('première'));

      await expect(store.write(FILE_NAME, content('seconde'))).rejects.toThrow('EEXIST');
    });
  });

  it('removes a copy and accepts removing a missing one', async () => {
    await withTemporaryDirectory(async (directory) => {
      const store = createFileSystemMediaStore(directory);
      await store.write(FILE_NAME, content('image'));
      await store.remove(FILE_NAME);
      await store.remove(FILE_NAME);

      expect(await readdir(directory)).toEqual([]);
    });
  });

  it.each(['../evasion.webp', 'photo.jpg', `${FILE_NAME}/../../etc/passwd`, ''])('refuses the file name "%s"', async (fileName) => {
    await withTemporaryDirectory(async (directory) => {
      const store = createFileSystemMediaStore(directory);

      await expect(store.write(fileName, content('x'))).rejects.toThrow(PublicationError);
      await expect(store.remove(fileName)).rejects.toThrow(PublicationError);
    });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter directus-extension-editorial test`
Expected: FAIL with `Failed to load url ./public-media-store.ts`.

- [ ] **Step 3: Implement the store**

`cms/extensions/editorial/src/publish-article/public-media-store.ts`:

```ts
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PublicationError } from '../errors.ts';

export type PublicMediaStore = {
  write(fileName: string, content: Readable): Promise<void>;
  remove(fileName: string): Promise<void>;
};

const PUBLIC_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function createFileSystemMediaStore(directory: string): PublicMediaStore {
  return {
    async write(fileName, content) {
      const path = resolvePublicFile(directory, fileName);
      await pipeline(content, createWriteStream(path, { flags: 'wx' }));
    },
    async remove(fileName) {
      const path = resolvePublicFile(directory, fileName);
      await rm(path, { force: true });
    },
  };
}

function resolvePublicFile(directory: string, fileName: string): string {
  if (!PUBLIC_FILE_NAME.test(fileName)) {
    throw new PublicationError({ reason: `nom de fichier public refusé « ${fileName} »` });
  }
  return join(directory, fileName);
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter directus-extension-editorial test`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add cms/extensions/editorial/src/publish-article/public-media-store.ts cms/extensions/editorial/src/publish-article/public-media-store.test.ts
git diff --cached --check
git commit -m "feat(publication): store public image copies safely"
```

---

### Task 7: Publish operation and the "Publier" flow

**Files:**
- Create: `cms/extensions/editorial/src/publish-article/trigger.ts`, `cms/extensions/editorial/src/publish-article/trigger.test.ts`
- Create: `cms/extensions/editorial/src/publish-article/publish.ts`, `cms/extensions/editorial/src/publish-article/api.ts`, `cms/extensions/editorial/src/publish-article/app.ts`
- Modify: `cms/extensions/editorial/package.json` (add the operation entry)
- Create: `cms/provision/src/flows/ensure-publication-flow.ts`
- Modify: `cms/provision/src/main.ts`
- Create: `cms/tests/src/support/publication.ts`
- Test: `cms/tests/src/publication.test.ts`

**Interfaces:**
- Consumes: `buildPublication`, `PUBLIC_IMAGE_MAX_WIDTH` and the draft/published types (Task 5); `createFileSystemMediaStore`, `PublicMediaStore` (Task 6); errors and `isRecord` (Task 4); `PUBLIC_MEDIA_PATH` env (Task 1).
- Produces:
  - `readSelectedArticleId(flowData: Record<string, unknown>): string`, `readPublicMediaDirectory(environment: Record<string, unknown>): string`.
  - `publishArticle(dependencies: PublishDependencies): Promise<PublishResult>` with `PublishResult = { article: string; slug: string; published_at: string }`.
  - Directus operation type `publish-article`; manual flow named `Publier` on `articles`, item location, synchronous, `error_on_reject: true`, no confirmation.
  - `ensurePublicationFlow(client: AdminClient, log: Log): Promise<void>`, `PUBLICATION_FLOW_NAME = 'Publier'`.
  - Test support: `readPublicationFlowId(): Promise<string>`, `triggerPublication(token: string, flowId: string, articleIds: string[]): Promise<PublicationAttempt>`, `readPublicationOf(articleId: string): Promise<PublicationRecord | null>`, `listPublicFiles(): Promise<string[]>`.

How publication is protected without custom permission rules: the operation runs every read and write with the accountability of the person who clicked "Publier". The editor policy can write `published_*`; the assistant policy cannot, so an assistant-triggered publication fails with `FORBIDDEN` at the first write, inside the transaction, before any image is copied. With `async: false` and `error_on_reject: true`, Directus returns the operation's error to the caller, so the Studio shows it.

Publication sequence:

1. Read the draft, its sources and its images with the caller's permissions.
2. Build the plan (Task 5). Unsupported images fail here, before anything is written.
3. In one database transaction: find the existing public copy, update or create it, delete its old sources and images, copy each image as WebP (max 2000 px wide) into the public media directory, then insert the new sources and images.
4. If anything fails: the transaction rolls back, every file written by this attempt is removed, and the error is returned. The previous public version and its files are untouched.
5. After commit: remove the files of the replaced version (failures are logged, never shown, because the publication itself succeeded).

- [ ] **Step 1: Write the failing trigger tests**

`cms/extensions/editorial/src/publish-article/trigger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ArticleSelectionError, EditorialConfigurationError } from '../errors.ts';
import { readPublicMediaDirectory, readSelectedArticleId } from './trigger.ts';

describe('readSelectedArticleId', () => {
  it('reads the single selected article from the manual trigger', () => {
    expect(readSelectedArticleId({ $trigger: { body: { collection: 'articles', keys: ['article-1'] } } })).toBe('article-1');
  });

  it.each([
    ['no trigger', {}],
    ['no body', { $trigger: {} }],
    ['no keys', { $trigger: { body: { collection: 'articles' } } }],
    ['several articles', { $trigger: { body: { keys: ['article-1', 'article-2'] } } }],
    ['a numeric key', { $trigger: { body: { keys: [42] } } }],
    ['an empty key', { $trigger: { body: { keys: [''] } } }],
  ])('rejects %s', (_case, flowData) => {
    expect(() => readSelectedArticleId(flowData)).toThrow(ArticleSelectionError);
  });
});

describe('readPublicMediaDirectory', () => {
  it('reads PUBLIC_MEDIA_PATH', () => {
    expect(readPublicMediaDirectory({ PUBLIC_MEDIA_PATH: '/directus/public-media' })).toBe('/directus/public-media');
  });

  it('fails when PUBLIC_MEDIA_PATH is missing', () => {
    expect(() => readPublicMediaDirectory({})).toThrow(EditorialConfigurationError);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter directus-extension-editorial test`
Expected: FAIL with `Failed to load url ./trigger.ts`.

- [ ] **Step 3: Implement the trigger readers**

`cms/extensions/editorial/src/publish-article/trigger.ts`:

```ts
import { ArticleSelectionError, EditorialConfigurationError } from '../errors.ts';
import { isRecord } from '../guards.ts';

export function readSelectedArticleId(flowData: Record<string, unknown>): string {
  const trigger = flowData['$trigger'];
  if (!isRecord(trigger)) {
    throw new ArticleSelectionError();
  }
  const body = trigger['body'];
  if (!isRecord(body)) {
    throw new ArticleSelectionError();
  }
  const keys = body['keys'];
  if (!Array.isArray(keys)) {
    throw new ArticleSelectionError();
  }
  const selectedKeys: unknown[] = keys;
  const [articleId] = selectedKeys;
  if (selectedKeys.length !== 1 || typeof articleId !== 'string' || articleId === '') {
    throw new ArticleSelectionError();
  }
  return articleId;
}

export function readPublicMediaDirectory(environment: Record<string, unknown>): string {
  const directory = environment['PUBLIC_MEDIA_PATH'];
  if (typeof directory !== 'string' || directory === '') {
    throw new EditorialConfigurationError({ variable: 'PUBLIC_MEDIA_PATH' });
  }
  return directory;
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter directus-extension-editorial test`
Expected: PASS, 30 tests.

- [ ] **Step 5: Write the failing publication integration tests**

`cms/tests/src/support/publication.ts`:

```ts
import { readdir } from 'node:fs/promises';
import { readFlows, readItems } from '@directus/sdk';
import { z } from 'zod';
import { adminClient } from './clients.ts';
import { testEnvironment } from './environment.ts';

export type PublicationAttempt =
  | { status: 'published'; slug: string }
  | { status: 'rejected'; httpStatus: number; code: string; message: string };

const successResponse = z.object({ article: z.string(), slug: z.string(), published_at: z.string() });
const errorResponse = z.object({
  errors: z.array(z.object({ message: z.string(), extensions: z.object({ code: z.string() }) })),
});

const publicationRecord = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string().nullable(),
  first_published_at: z.string(),
  last_published_at: z.string(),
  references: z.array(z.object({ sort: z.number(), title: z.string(), organization: z.string().nullable() })),
  images: z.array(
    z.object({ sort: z.number(), public_file_name: z.string(), width: z.number(), height: z.number(), alt: z.string() }),
  ),
});

export type PublicationRecord = z.infer<typeof publicationRecord>;

export async function readPublicationFlowId(): Promise<string> {
  const [flow] = await adminClient.request(readFlows({ filter: { name: { _eq: 'Publier' } }, fields: ['id'], limit: 1 }));
  if (flow === undefined) {
    throw new Error('Flow « Publier » introuvable : lancez pnpm provision.');
  }
  return flow.id;
}

export async function triggerPublication(token: string, flowId: string, articleIds: string[]): Promise<PublicationAttempt> {
  const response = await fetch(`${testEnvironment.directusUrl}/flows/trigger/${flowId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: 'articles', keys: articleIds }),
  });
  const body: unknown = await response.json();
  if (response.ok) {
    return { status: 'published', slug: successResponse.parse(body).slug };
  }
  const [error] = errorResponse.parse(body).errors;
  if (error === undefined) {
    throw new Error(`Réponse d’erreur sans détail (HTTP ${response.status}).`);
  }
  return { status: 'rejected', httpStatus: response.status, code: error.extensions.code, message: error.message };
}

export async function readPublicationOf(articleId: string): Promise<PublicationRecord | null> {
  const records = await adminClient.request(
    readItems('published_articles', {
      filter: { article: { _eq: articleId } },
      fields: [
        'id',
        'slug',
        'title',
        'summary',
        'body',
        'first_published_at',
        'last_published_at',
        { references: ['sort', 'title', 'organization'] },
        { images: ['sort', 'public_file_name', 'width', 'height', 'alt'] },
      ],
      limit: 1,
    }),
  );
  const [record] = z.array(publicationRecord).parse(records);
  if (record === undefined) {
    return null;
  }
  return {
    ...record,
    references: record.references.toSorted((first, second) => first.sort - second.sort),
    images: record.images.toSorted((first, second) => first.sort - second.sort),
  };
}

export async function listPublicFiles(): Promise<string[]> {
  const entries = await readdir(testEnvironment.publicMediaDirectory);
  return entries.filter((entry) => entry.endsWith('.webp')).toSorted();
}
```

`cms/tests/src/publication.test.ts`:

```ts
import { createItem, deleteItems, readItems, updateFile, updateItem } from '@directus/sdk';
import { describe, expect, it } from 'vitest';
import { adminClient, editorClient } from './support/clients.ts';
import { testEnvironment } from './support/environment.ts';
import { createArticle, draftArticleValues, ONE_PIXEL_PNG, uniqueSuffix, uploadFile } from './support/fixtures.ts';
import { listPublicFiles, readPublicationFlowId, readPublicationOf, triggerPublication } from './support/publication.ts';

const flowId = await readPublicationFlowId();

async function createPublishableDraft(suffix: string): Promise<string> {
  const fileId = await uploadFile(editorClient, `photo-${suffix}.png`, ONE_PIXEL_PNG, 'image/png');
  return createArticle(editorClient, {
    ...draftArticleValues(suffix),
    references: [{ title: 'Rapport annuel', organization: 'Cour des comptes', url: 'https://example.org/rapport', sort: 1 }],
    images: [{ file: fileId, alt: 'Photo de test', credit: 'Rédaction', sort: 1 }],
    verification_points: [{ claim: 'Chiffre à confirmer' }],
    review_remarks: [{ body: 'Préciser la date.' }],
  });
}

async function publishAsEditor(articleId: string): Promise<void> {
  const attempt = await triggerPublication(testEnvironment.editorToken, flowId, [articleId]);
  if (attempt.status !== 'published') {
    throw new Error(`Publication de préparation refusée : ${attempt.code} ${attempt.message}`);
  }
}

describe('publication', () => {
  it('publishes a draft that still has open verification points and remarks', async () => {
    const suffix = uniqueSuffix();
    const articleId = await createPublishableDraft(suffix);

    const attempt = await triggerPublication(testEnvironment.editorToken, flowId, [articleId]);

    expect(attempt).toEqual({ status: 'published', slug: `article-de-test-${suffix}` });
    const publication = await readPublicationOf(articleId);
    expect(publication).toMatchObject({
      slug: `article-de-test-${suffix}`,
      title: `Article de test ${suffix}`,
      summary: 'Chapô de test.',
      references: [{ sort: 1, title: 'Rapport annuel', organization: 'Cour des comptes' }],
      images: [{ sort: 1, width: 1, height: 1, alt: 'Photo de test' }],
    });
    expect(await listPublicFiles()).toContain(publication?.images[0]?.public_file_name);
    const points = await editorClient.request(readItems('verification_points', { filter: { article: { _eq: articleId } }, fields: ['status'] }));
    expect(points.map((point) => point.status)).toEqual(['open']);
  });

  it('keeps the public version unchanged while the draft is revised', async () => {
    const suffix = uniqueSuffix();
    const articleId = await createPublishableDraft(suffix);
    await publishAsEditor(articleId);

    await editorClient.request(updateItem('articles', articleId, { title: 'Titre en révision' }));

    expect((await readPublicationOf(articleId))?.title).toBe(`Article de test ${suffix}`);
  });

  it('replaces sources and images coherently when republishing', async () => {
    const suffix = uniqueSuffix();
    const articleId = await createPublishableDraft(suffix);
    await publishAsEditor(articleId);
    const first = await readPublicationOf(articleId);

    const oldReferences = await editorClient.request(readItems('article_references', { filter: { article: { _eq: articleId } }, fields: ['id'] }));
    await editorClient.request(deleteItems('article_references', oldReferences.map((reference) => reference.id)));
    await editorClient.request(createItem('article_references', { article: articleId, title: 'Note de synthèse', sort: 1 }));
    const oldImages = await editorClient.request(readItems('article_images', { filter: { article: { _eq: articleId } }, fields: ['id'] }));
    await editorClient.request(deleteItems('article_images', oldImages.map((image) => image.id)));
    const newFileId = await uploadFile(editorClient, `nouvelle-${suffix}.png`, ONE_PIXEL_PNG, 'image/png');
    await editorClient.request(createItem('article_images', { article: articleId, file: newFileId, alt: 'Nouvelle photo', sort: 1 }));

    await publishAsEditor(articleId);
    const second = await readPublicationOf(articleId);

    expect(second?.references.map((reference) => reference.title)).toEqual(['Note de synthèse']);
    expect(second?.images.map((image) => image.alt)).toEqual(['Nouvelle photo']);
    expect(second?.first_published_at).toBe(first?.first_published_at);
    expect(Date.parse(second?.last_published_at ?? '')).toBeGreaterThan(Date.parse(first?.last_published_at ?? ''));
    const files = await listPublicFiles();
    expect(files).not.toContain(first?.images[0]?.public_file_name);
    expect(files).toContain(second?.images[0]?.public_file_name);
  });

  it('keeps the previous public version and the draft when an image copy fails', async () => {
    const suffix = uniqueSuffix();
    const articleId = await createPublishableDraft(suffix);
    await publishAsEditor(articleId);
    const before = await readPublicationOf(articleId);
    const filesBefore = await listPublicFiles();

    const brokenFileId = await uploadFile(editorClient, `cassee-${suffix}.png`, new TextEncoder().encode('pas une image'), 'image/png');
    await adminClient.request(updateFile(brokenFileId, { width: 10, height: 10 }));
    await editorClient.request(createItem('article_images', { article: articleId, file: brokenFileId, alt: 'Image cassée', sort: 2 }));
    await editorClient.request(updateItem('articles', articleId, { title: 'Titre qui ne doit pas sortir' }));

    const attempt = await triggerPublication(testEnvironment.editorToken, flowId, [articleId]);

    expect(attempt).toMatchObject({ status: 'rejected', code: 'PUBLICATION_FAILED' });
    expect(await readPublicationOf(articleId)).toEqual(before);
    expect(await listPublicFiles()).toEqual(filesBefore);
    const draftImages = await editorClient.request(readItems('article_images', { filter: { article: { _eq: articleId } }, fields: ['id'] }));
    expect(draftImages).toHaveLength(2);
  });

  it('explains that an attached file is not a supported image', async () => {
    const suffix = uniqueSuffix();
    const fileId = await uploadFile(editorClient, `notes-${suffix}.txt`, new TextEncoder().encode('notes'), 'text/plain');
    const articleId = await createArticle(editorClient, {
      ...draftArticleValues(suffix),
      images: [{ file: fileId, alt: 'Pas une image', sort: 1 }],
    });

    const attempt = await triggerPublication(testEnvironment.editorToken, flowId, [articleId]);

    if (attempt.status !== 'rejected') {
      throw new Error('La publication devait être refusée.');
    }
    expect(attempt.code).toBe('PUBLICATION_FAILED');
    expect(attempt.message).toContain('n’est pas pris en charge');
    expect(await readPublicationOf(articleId)).toBeNull();
  });

  it('refuses publication by the assistant and leaves the public version untouched', async () => {
    const suffix = uniqueSuffix();
    const articleId = await createPublishableDraft(suffix);
    await publishAsEditor(articleId);
    const before = await readPublicationOf(articleId);
    const filesBefore = await listPublicFiles();
    await editorClient.request(updateItem('articles', articleId, { title: 'Révision non relue' }));

    const attempt = await triggerPublication(testEnvironment.assistantToken, flowId, [articleId]);

    expect(attempt).toMatchObject({ status: 'rejected', code: 'FORBIDDEN' });
    expect(await readPublicationOf(articleId)).toEqual(before);
    expect(await listPublicFiles()).toEqual(filesBefore);
  });

  it('asks for exactly one article', async () => {
    const firstId = await createArticle(editorClient, draftArticleValues(uniqueSuffix()));
    const secondId = await createArticle(editorClient, draftArticleValues(uniqueSuffix()));

    const attempt = await triggerPublication(testEnvironment.editorToken, flowId, [firstId, secondId]);

    expect(attempt).toMatchObject({ status: 'rejected', code: 'INVALID_ARTICLE_SELECTION' });
  });
});
```

The broken-image test uploads text declared as PNG and gives it dimensions with the admin client, so it passes the plan checks and fails during the image conversion, after the first image has already been copied. That proves the rollback also removes files written during the failed attempt.

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm test:cms`
Expected: FAIL at module load of `publication.test.ts` with `Flow « Publier » introuvable : lancez pnpm provision.`

- [ ] **Step 7: Implement the publication service**

`cms/extensions/editorial/src/publish-article/publish.ts`:

```ts
import { isDirectusError } from '@directus/errors';
import type {
  AbstractService,
  Accountability,
  ApiExtensionContext,
  PrimaryKey,
  Query,
  SchemaOverview,
  TransformationSet,
} from '@directus/types';
import type { Knex } from 'knex';
import { PublicationError } from '../errors.ts';
import type { PublicMediaStore } from './public-media-store.ts';
import { buildPublication, PUBLIC_IMAGE_MAX_WIDTH } from './publication.ts';
import type {
  DraftArticle,
  PlannedImage,
  PublicationPlan,
  PublishedArticleValues,
  PublishedImageValues,
  PublishedReferenceValues,
} from './publication.ts';

export type PublishDependencies = {
  articleId: string;
  accountability: Accountability;
  services: ApiExtensionContext['services'];
  database: ApiExtensionContext['database'];
  logger: ApiExtensionContext['logger'];
  schema: SchemaOverview;
  mediaStore: PublicMediaStore;
  now: () => Date;
  createPublicFileName: () => string;
};

export type PublishResult = { article: string; slug: string; published_at: string };

type ExistingPublication = { id: string; images: { public_file_name: string }[] };
type PublishedArticleRecord = PublishedArticleValues & { first_published_at: string };
type PublishedReferenceRecord = PublishedReferenceValues & { published_article: string };
type PublishedImageRecord = PublishedImageValues & { published_article: string };
type AssetReader = InstanceType<ApiExtensionContext['services']['AssetsService']>;

const DRAFT_QUERY: Query = {
  fields: [
    'id',
    'title',
    'slug',
    'summary',
    'body',
    'byline',
    'format',
    'section',
    'references.sort',
    'references.organization',
    'references.title',
    'references.url',
    'references.author',
    'references.publication',
    'references.published_on',
    'references.note',
    'images.sort',
    'images.alt',
    'images.caption',
    'images.credit',
    'images.file.id',
    'images.file.type',
    'images.file.width',
    'images.file.height',
  ],
  deep: { references: { _limit: -1 }, images: { _limit: -1 } },
};

const PUBLIC_IMAGE_TRANSFORMATION: TransformationSet = {
  transformationParams: { width: PUBLIC_IMAGE_MAX_WIDTH, withoutEnlargement: true, format: 'webp', quality: 82 },
};

export async function publishArticle(dependencies: PublishDependencies): Promise<PublishResult> {
  const draft = await readDraftArticle(dependencies);
  const publishedAt = dependencies.now();
  const plan = buildPublication(draft, publishedAt, dependencies.createPublicFileName);
  const replacedFileNames = await writePublicationOrRollBack(dependencies, plan, publishedAt);
  await removePublicFiles(dependencies, replacedFileNames);
  return { article: draft.id, slug: plan.article.slug, published_at: publishedAt.toISOString() };
}

async function readDraftArticle(dependencies: PublishDependencies): Promise<DraftArticle> {
  const { services, accountability, schema, articleId } = dependencies;
  const articles = new services.ItemsService<DraftArticle>('articles', { accountability, schema });
  return articles.readOne(articleId, DRAFT_QUERY);
}

async function writePublicationOrRollBack(dependencies: PublishDependencies, plan: PublicationPlan, publishedAt: Date): Promise<string[]> {
  try {
    return await dependencies.database.transaction((transaction) => writePublication(dependencies, transaction, plan, publishedAt));
  } catch (error) {
    dependencies.logger.error({ err: error }, `Publication annulée pour l’article ${plan.article.article}`);
    await removePublicFiles(dependencies, plan.images.map((image) => image.values.public_file_name));
    throw toPublicationFailure(error);
  }
}

async function writePublication(
  dependencies: PublishDependencies,
  transaction: Knex.Transaction,
  plan: PublicationPlan,
  publishedAt: Date,
): Promise<string[]> {
  const { services, accountability, schema, mediaStore } = dependencies;
  const options = { knex: transaction, accountability, schema };
  const publicationReader = new services.ItemsService<ExistingPublication>('published_articles', options);
  const publicationWriter = new services.ItemsService<PublishedArticleRecord>('published_articles', options);
  const referenceWriter = new services.ItemsService<PublishedReferenceRecord>('published_references', options);
  const imageWriter = new services.ItemsService<PublishedImageRecord>('published_images', options);
  const assets = new services.AssetsService(options);

  const [existing] = await publicationReader.readByQuery({
    filter: { article: { _eq: plan.article.article } },
    fields: ['id', 'images.public_file_name'],
    deep: { images: { _limit: -1 } },
    limit: 1,
  });
  const publishedArticleId = await saveArticle(publicationWriter, existing, plan.article, publishedAt);
  const childrenOfPublication: Query = { filter: { published_article: { _eq: publishedArticleId } }, limit: -1 };
  await referenceWriter.deleteByQuery(childrenOfPublication);
  await imageWriter.deleteByQuery(childrenOfPublication);
  await copyImages(assets, mediaStore, plan.images);
  await referenceWriter.createMany(plan.references.map((reference) => ({ ...reference, published_article: publishedArticleId })));
  await imageWriter.createMany(plan.images.map((image) => ({ ...image.values, published_article: publishedArticleId })));
  return replacedFileNames(existing);
}

async function saveArticle(
  writer: AbstractService<PublishedArticleRecord>,
  existing: ExistingPublication | undefined,
  article: PublishedArticleValues,
  publishedAt: Date,
): Promise<string> {
  if (existing !== undefined) {
    await writer.updateOne(existing.id, article);
    return existing.id;
  }
  const createdKey = await writer.createOne({ ...article, first_published_at: publishedAt.toISOString() });
  return requireStringKey(createdKey);
}

function requireStringKey(key: PrimaryKey): string {
  if (typeof key !== 'string') {
    throw new PublicationError({ reason: `identifiant de version publiée inattendu (${String(key)})` });
  }
  return key;
}

async function copyImages(assets: AssetReader, mediaStore: PublicMediaStore, images: PlannedImage[]): Promise<void> {
  for (const image of images) {
    const asset = await assets.getAsset(image.sourceFileId, PUBLIC_IMAGE_TRANSFORMATION);
    await mediaStore.write(image.values.public_file_name, asset.stream);
  }
}

function replacedFileNames(existing: ExistingPublication | undefined): string[] {
  if (existing === undefined) {
    return [];
  }
  return existing.images.map((image) => image.public_file_name);
}

async function removePublicFiles(dependencies: PublishDependencies, fileNames: string[]): Promise<void> {
  const results = await Promise.allSettled(fileNames.map((fileName) => dependencies.mediaStore.remove(fileName)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      dependencies.logger.warn({ err: result.reason }, `Fichier public non supprimé : ${fileNames[index] ?? ''}`);
    }
  });
}

function toPublicationFailure(error: unknown): unknown {
  if (isDirectusError(error, 'FORBIDDEN') || isDirectusError(error, 'PUBLICATION_FAILED')) {
    return error;
  }
  if (isDirectusError(error, 'RECORD_NOT_UNIQUE')) {
    return new PublicationError({ reason: 'cet identifiant d’URL est déjà utilisé par un autre article publié' });
  }
  return new PublicationError({ reason: describeError(error) });
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\.$/, '');
  }
  return 'erreur inconnue';
}
```

`cms/extensions/editorial/src/publish-article/api.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { ForbiddenError } from '@directus/errors';
import { defineOperationApi } from '@directus/extensions-sdk';
import { createFileSystemMediaStore } from './public-media-store.ts';
import { publishArticle } from './publish.ts';
import { readPublicMediaDirectory, readSelectedArticleId } from './trigger.ts';

export default defineOperationApi<Record<string, never>>({
  id: 'publish-article',
  handler: async (_options, context) => {
    if (context.accountability === null) {
      throw new ForbiddenError();
    }
    return publishArticle({
      articleId: readSelectedArticleId(context.data),
      accountability: context.accountability,
      services: context.services,
      database: context.database,
      logger: context.logger,
      schema: await context.getSchema(),
      mediaStore: createFileSystemMediaStore(readPublicMediaDirectory(context.env)),
      now: () => new Date(),
      createPublicFileName: () => `${randomUUID()}.webp`,
    });
  },
});
```

`cms/extensions/editorial/src/publish-article/app.ts`:

```ts
import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'publish-article',
  name: 'Publier l’article',
  icon: 'publish',
  description: 'Remplace la version publique de l’article sélectionné par sa version de travail.',
  overview: () => [{ label: 'Effet', text: 'Copie le texte, les sources et les images vers la version publiée.' }],
  options: [],
});
```

Replace the `entries` array in `cms/extensions/editorial/package.json` with:

```json
    "entries": [
      {
        "type": "hook",
        "name": "require-creation-key",
        "source": "src/require-creation-key/index.ts"
      },
      {
        "type": "operation",
        "name": "publish-article",
        "source": {
          "app": "src/publish-article/app.ts",
          "api": "src/publish-article/api.ts"
        }
      }
    ],
```

- [ ] **Step 8: Provision the flow**

`cms/provision/src/flows/ensure-publication-flow.ts`:

```ts
import { createFlow, createOperation, readFlows, readOperations, updateFlow } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';

export const PUBLICATION_FLOW_NAME = 'Publier';

const PUBLICATION_OPERATION_KEY = 'publish';

const publicationFlow = {
  name: PUBLICATION_FLOW_NAME,
  icon: 'publish',
  color: '#7A3D32',
  description: 'Publie la version de travail de l’article sur le site.',
  status: 'active',
  trigger: 'manual',
  accountability: 'all',
  options: {
    collections: ['articles'],
    location: 'item',
    requireSelection: true,
    requireConfirmation: false,
    async: false,
    error_on_reject: true,
  },
};

export async function ensurePublicationFlow(client: AdminClient, log: Log): Promise<void> {
  const flowId = await ensureFlow(client, log);
  await ensureOperation(client, flowId, log);
}

async function ensureFlow(client: AdminClient, log: Log): Promise<string> {
  const [existing] = await client.request(readFlows({ filter: { name: { _eq: PUBLICATION_FLOW_NAME } }, fields: ['id'], limit: 1 }));
  if (existing === undefined) {
    const created = await client.request(createFlow(publicationFlow, { fields: ['id'] }));
    log('Flow « Publier » créé');
    return created.id;
  }
  await client.request(updateFlow(existing.id, publicationFlow));
  return existing.id;
}

async function ensureOperation(client: AdminClient, flowId: string, log: Log): Promise<void> {
  const [existing] = await client.request(
    readOperations({ filter: { flow: { _eq: flowId }, key: { _eq: PUBLICATION_OPERATION_KEY } }, fields: ['id'], limit: 1 }),
  );
  if (existing !== undefined) {
    await client.request(updateFlow(flowId, { operation: existing.id }));
    return;
  }
  const created = await client.request(
    createOperation(
      { flow: flowId, key: PUBLICATION_OPERATION_KEY, type: 'publish-article', name: 'Publier l’article', position_x: 19, position_y: 1, options: {} },
      { fields: ['id'] },
    ),
  );
  await client.request(updateFlow(flowId, { operation: created.id }));
  log('Opération de publication créée');
}
```

In `cms/provision/src/main.ts`, add the import and the call (full `provision` function shown):

```ts
import { ensurePublicationFlow } from './flows/ensure-publication-flow.ts';
```

```ts
async function provision(): Promise<void> {
  const environment = readProvisionEnvironment(process.env);
  const client = createAdminClient(environment.directusUrl, environment.adminToken);

  await ensureSchema(client, editorialCollections(environment.siteUrl), editorialRelations, log);
  await ensureAccess(client, environment, log);
  await ensurePublicationFlow(client, log);
  log('Provisionnement terminé.');
}
```

- [ ] **Step 9: Build, provision and run the tests to see them pass**

Run: `pnpm build:extension && pnpm provision`
Expected: build `Done`; provisioning prints `Flow « Publier » créé` and `Opération de publication créée`.

Run: `docker compose logs --since 2m directus | grep -i -E "extension|error"`
Expected: the extension reloaded, no error.

Run: `pnpm test && pnpm test:cms && pnpm typecheck`
Expected: PASS everywhere, including the 7 publication tests.

- [ ] **Step 10: Commit**

```bash
git add cms/extensions/editorial cms/provision cms/tests
git diff --cached --check
git commit -m "feat(publication): publish articles through the Publier flow"
```

---

### Task 8: MCP settings and the assistant protocol

**Files:**
- Create: `cms/provision/src/assistant-protocol.md`
- Create: `cms/provision/src/settings/ensure-settings.ts`
- Modify: `cms/provision/src/main.ts`
- Create: `cms/tests/src/support/mcp.ts`
- Test: `cms/tests/src/mcp.test.ts`

**Interfaces:**
- Consumes: `ProvisionEnvironment.mcpOAuth` (Task 2), test support (Tasks 2 and 7).
- Produces: `ensureSettings(client: AdminClient, environment: ProvisionEnvironment, assistantProtocol: string, log: Log): Promise<void>`; Directus settings `mcp_enabled = true`, `mcp_allow_deletes = true`, `mcp_system_prompt_enabled = true`, `mcp_system_prompt` = protocol text, `mcp_oauth_*` from env, `default_language = fr-FR`; test helpers `listMcpTools(token: string): Promise<string[]>`, `callMcpTool(token: string, name: string, args: Record<string, unknown>): Promise<ToolOutcome>`, `readToolErrorCodes(outcome: ToolOutcome): string[]`, type `ToolOutcome = { isError: boolean; text: string }`.

`mcp_allow_deletes` is enabled because the assistant must be able to remove a wrong source or image from its draft. What it may delete is decided by permissions (Task 3), not by this switch. The protocol is served by the MCP `system-prompt` tool, so Claude and ChatGPT read the same rules at the start of every session.

- [ ] **Step 1: Write the failing MCP tests**

`cms/tests/src/support/mcp.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { testEnvironment } from './environment.ts';

export type ToolOutcome = { isError: boolean; text: string };

const toolCallResponse = z.object({
  result: z.object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  }),
});
const toolListResponse = z.object({ result: z.object({ tools: z.array(z.object({ name: z.string() })) }) });
const toolErrors = z.array(z.object({ error: z.string(), code: z.string().optional() }));

async function postMcp(token: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${testEnvironment.directusUrl}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
  });
  if (!response.ok) {
    throw new Error(`MCP a répondu HTTP ${response.status} : ${await response.text()}`);
  }
  return response.json();
}

export async function listMcpTools(token: string): Promise<string[]> {
  const parsed = toolListResponse.parse(await postMcp(token, 'tools/list', {}));
  return parsed.result.tools.map((tool) => tool.name);
}

export async function callMcpTool(token: string, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const parsed = toolCallResponse.parse(await postMcp(token, 'tools/call', { name, arguments: args }));
  return {
    isError: parsed.result.isError ?? false,
    text: parsed.result.content.map((part) => part.text ?? '').join('\n'),
  };
}

export function readToolErrorCodes(outcome: ToolOutcome): string[] {
  const parsed: unknown = JSON.parse(outcome.text);
  return toolErrors
    .parse(parsed)
    .map((error) => error.code)
    .filter((code) => code !== undefined);
}
```

`cms/tests/src/mcp.test.ts`:

```ts
import { readItems } from '@directus/sdk';
import { describe, expect, it } from 'vitest';
import { assistantClient, editorClient } from './support/clients.ts';
import { testEnvironment } from './support/environment.ts';
import { createArticle, draftArticleValues, uniqueSuffix } from './support/fixtures.ts';
import { callMcpTool, listMcpTools, readToolErrorCodes } from './support/mcp.ts';
import { readPublicationFlowId, readPublicationOf, triggerPublication } from './support/publication.ts';

const suffix = uniqueSuffix();
const token = testEnvironment.assistantToken;
const flowId = await readPublicationFlowId();
const assistantDraftId = await createArticle(assistantClient, draftArticleValues(suffix));
const editorArticleId = await createArticle(editorClient, draftArticleValues(uniqueSuffix()));
await triggerPublication(testEnvironment.editorToken, flowId, [editorArticleId]);
const publication = await readPublicationOf(editorArticleId);
if (publication === null) {
  throw new Error('Publication de préparation absente.');
}

describe('MCP for the assistant', () => {
  it('exposes the content tools and the editorial protocol', async () => {
    expect(await listMcpTools(token)).toEqual(expect.arrayContaining(['items', 'files', 'system-prompt']));

    const protocol = await callMcpTool(token, 'system-prompt', {});

    expect(protocol.isError).toBe(false);
    expect(protocol.text).toContain('creation_key');
  });

  it('creates a draft through the items tool', async () => {
    const draftSuffix = uniqueSuffix();
    const creationKey = `2026-10-10-mcp-${draftSuffix}`;

    const outcome = await callMcpTool(token, 'items', {
      action: 'create',
      collection: 'articles',
      data: { title: `Brouillon MCP ${draftSuffix}`, slug: `brouillon-mcp-${draftSuffix}`, creation_key: creationKey },
    });

    expect(outcome.isError).toBe(false);
    const found = await editorClient.request(readItems('articles', { filter: { creation_key: { _eq: creationKey } }, fields: ['id'] }));
    expect(found).toHaveLength(1);
  });

  const refusals: [string, string, Record<string, unknown>, string][] = [
    ['a draft without creation key', 'items', { action: 'create', collection: 'articles', data: { title: 'Sans clé', slug: `sans-cle-${suffix}` } }, 'CREATION_KEY_REQUIRED'],
    ['writing a public copy', 'items', { action: 'create', collection: 'published_articles', data: { article: assistantDraftId, slug: `mcp-${suffix}`, title: 'MCP', first_published_at: '2026-10-10T08:00:00.000Z', last_published_at: '2026-10-10T08:00:00.000Z' } }, 'FORBIDDEN'],
    ['a batch update of public copies', 'items', { action: 'update', collection: 'published_articles', data: [{ id: publication.id, title: 'Lot MCP' }] }, 'FORBIDDEN'],
    ['changing the media settings', 'items', { action: 'update', collection: 'site_settings', data: { media_name: 'MCP' } }, 'FORBIDDEN'],
    ['triggering the Publier flow', 'trigger-flow', { id: flowId, collection: 'articles', keys: [assistantDraftId] }, 'FORBIDDEN'],
    ['reading flows', 'flows', { action: 'read' }, 'FORBIDDEN'],
    ['reading permissions as items', 'items', { action: 'read', collection: 'directus_permissions' }, 'INVALID_PAYLOAD'],
  ];

  it.each(refusals)('refuses %s', async (_name, tool, args, code) => {
    const outcome = await callMcpTool(token, tool, args);

    expect(outcome.isError).toBe(true);
    expect(readToolErrorCodes(outcome)).toContain(code);
  });

  it('leaves the public copy untouched after the refused calls', async () => {
    expect((await readPublicationOf(editorArticleId))?.title).toBe(publication.title);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:cms`
Expected: FAIL in `mcp.test.ts` with `MCP a répondu HTTP …` (MCP is disabled until the settings are applied).

- [ ] **Step 3: Write the assistant protocol**

`cms/provision/src/assistant-protocol.md`:

````markdown
# Protocole de l’assistant de rédaction

Tu aides une petite rédaction indépendante à préparer des brouillons d’articles dans Directus. Un humain relit et publie. Tu ne publies jamais.

## Avant de commencer

1. Appelle l’outil `schema` pour connaître les collections et leurs champs.
2. Lis la ligne éditoriale (`editorial_line`), les réglages du média (`site_settings`), les rubriques (`sections`), les sources de veille (`watch_sources`) et les matériaux privés (`materials`).
3. Lis les articles existants (`articles`) et les remarques de relecture ouvertes (`review_remarks` dont `status` vaut `open`).

## Créer ou reprendre un brouillon

- Chaque nouveau brouillon porte une `creation_key` stable au format `AAAA-MM-JJ-mot-cle` : la date du jour puis le sujet, en minuscules avec des tirets. Elle est obligatoire.
- Avant de créer, cherche un article avec la même `creation_key`. S’il existe, reprends-le au lieu d’en créer un autre.
- Après une erreur, une coupure ou un délai dépassé, relis l’article par sa `creation_key` avant de recommencer.
- Renseigne `title`, `slug` (minuscules, chiffres et tirets, unique), `summary` (le chapô), `body` (Markdown), `format` et `section`.
- Ne remplis `byline` qu’avec une signature fournie par la rédaction. N’invente jamais de signature.

## Sources et vérification

- N’invente aucun fait, chiffre, citation, document ou référence.
- Enregistre chaque source dans `article_references` : organisation, titre, lien, auteur, publication, date, note publique, et un `sort` qui commence à 1.
- Dans le texte, cite la source numéro N avec `[^N]`, N étant son `sort`.
- Tout point incertain devient un `verification_points` (affirmation, raison, sources concernées). Ces points ne bloquent pas la publication : ils guident la relecture.
- Le texte public ne mentionne jamais l’usage d’un assistant ou d’une intelligence artificielle.

## Images

- Une image s’ajoute en deux temps : import du fichier avec l’outil `files` (action `import` depuis une adresse publique), puis un enregistrement `article_images` avec le fichier, le texte alternatif, la légende, le crédit, l’origine privée (`source_note`) et un `sort`.
- L’image numéro 1 illustre l’article. Pour placer l’image numéro N (N ≥ 2) dans le texte, écris `[[image:N]]` seul sur une ligne.
- N’utilise que des images dont l’origine et le crédit sont connus. Si un import échoue, écris-le dans `handoff_note`.

## Fin de session

- Mets `preparation_status` à `ready_for_review` quand le brouillon est prêt, sinon laisse `drafting`.
- Résume dans `handoff_note` ce qui a été fait, ce qui reste à vérifier et les échecs éventuels.
- Pour chaque remarque de relecture traitée, mets `status` à `addressed` et explique ta réponse dans `response_note`.

## Interdits

- Ne modifie pas `published_articles`, `published_references`, `published_images`, `home_features`, `site_settings`, `editorial_line`, `sections`, `watch_sources` ni `materials`.
- Ne déclenche pas le flow « Publier ». La publication est une action humaine.
- Ne supprime ni article ni point à vérifier.
````

- [ ] **Step 4: Apply the MCP settings**

`cms/provision/src/settings/ensure-settings.ts`:

```ts
import { updateSettings } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import type { ProvisionEnvironment } from '../environment.ts';

export async function ensureSettings(
  client: AdminClient,
  environment: ProvisionEnvironment,
  assistantProtocol: string,
  log: Log,
): Promise<void> {
  await client.request(
    updateSettings({
      project_name: 'Rédaction',
      default_language: 'fr-FR',
      mcp_enabled: true,
      mcp_allow_deletes: true,
      mcp_system_prompt_enabled: true,
      mcp_system_prompt: assistantProtocol,
      mcp_oauth_enabled: environment.mcpOAuth.enabled,
      mcp_oauth_cimd_enabled: environment.mcpOAuth.cimdEnabled,
      mcp_oauth_dcr_enabled: environment.mcpOAuth.dcrEnabled,
    }),
  );
  log('Réglages MCP appliqués');
}
```

Replace `cms/provision/src/main.ts` with the final version:

```ts
import { readFile } from 'node:fs/promises';
import { isDirectusError } from '@directus/sdk';
import { ensureAccess } from './access/ensure-access.ts';
import { createAdminClient } from './directus-client.ts';
import { readProvisionEnvironment } from './environment.ts';
import { ensurePublicationFlow } from './flows/ensure-publication-flow.ts';
import { editorialCollections } from './schema/collections.ts';
import { ensureSchema } from './schema/ensure-schema.ts';
import { editorialRelations } from './schema/relations.ts';
import { ensureSettings } from './settings/ensure-settings.ts';

function log(message: string): void {
  console.log(message);
}

async function provision(): Promise<void> {
  const environment = readProvisionEnvironment(process.env);
  const client = createAdminClient(environment.directusUrl, environment.adminToken);
  const assistantProtocol = await readFile(new URL('./assistant-protocol.md', import.meta.url), 'utf8');

  await ensureSchema(client, editorialCollections(environment.siteUrl), editorialRelations, log);
  await ensureAccess(client, environment, log);
  await ensurePublicationFlow(client, log);
  await ensureSettings(client, environment, assistantProtocol, log);
  log('Provisionnement terminé.');
}

function describeFailure(error: unknown): string {
  if (isDirectusError(error)) {
    return error.errors.map((detail) => `${detail.extensions.code} : ${detail.message}`).join('\n');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

try {
  await provision();
} catch (error) {
  console.error(`Échec du provisionnement :\n${describeFailure(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 5: Provision and run the tests to see them pass**

Run: `pnpm provision && pnpm test:cms`
Expected: `Réglages MCP appliqués`, then PASS including 10 MCP tests.

If `trigger-flow` or `flows` report a different code than `FORBIDDEN`, read the tool error text: any refusal is acceptable for this guarantee, but update the expected code to the observed Directus code rather than weakening the `isError` assertion.

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cms/provision cms/tests
git diff --cached --check
git commit -m "feat(mcp): serve the editorial protocol to the assistant"
```

---

### Task 9: Real MCP clients, images and resumption (manual validation)

**Files:**
- Create: `docs/validation/2026-10-mcp-clients.md`
- Create: `docs/validation/captures/` (screenshots referenced by the record)

**Interfaces:**
- Consumes: the running local stack from Tasks 1–8.
- Produces: a dated evidence record that answers the spec's open validation points (OAuth for both clients, AI cannot publish through the real clients, photo import, AI illustration transfer, resumption) and the decision on `AI_APP_ACCESS`.

This task proves with the real clients what the integration tests prove with static tokens. MCP OAuth needs a public HTTPS URL, so the local Directus is exposed temporarily through a Cloudflare quick tunnel.

- [ ] **Step 1: Expose the local Directus over HTTPS**

Run: `brew install cloudflared` (once), then `cloudflared tunnel --url http://localhost:8055`
Expected: a line `https://<random-words>.trycloudflare.com`. Keep the terminal open.

In `.env`, set:

```dotenv
DIRECTUS_PUBLIC_URL=https://<random-words>.trycloudflare.com
MCP_OAUTH_ENABLED=true
MCP_OAUTH_CIMD_ENABLED=true
MCP_OAUTH_DCR_ENABLED=true
```

Run: `pnpm cms:up && pnpm provision`
Expected: Directus recreated and healthy; `Réglages MCP appliqués`.

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<random-words>.trycloudflare.com/mcp`
Expected: `401` (OAuth challenge).

- [ ] **Step 2: Connect Claude (CIMD)**

In Claude (Pro): Settings → Connectors → Add custom connector → URL `https://<random-words>.trycloudflare.com/mcp`. Click Connect, sign in with `AI_EMAIL` / `AI_PASSWORD` on the Directus page, approve the consent screen.

Decision rule: if sign-in or consent fails because the assistant has no Studio access, set `AI_APP_ACCESS=true` in `.env`, run `pnpm provision`, retry, and record it. With Studio access the assistant still cannot see or run "Publier" (no read access on flows) but it uses the third seat.

- [ ] **Step 3: Run the Claude scenarios**

Use a neutral test subject (for example the publication of a public report). In a new Claude conversation:

1. "Lis le protocole de la rédaction puis prépare un brouillon sur <sujet> avec au moins deux sources réelles et un point à vérifier." Check in the Studio as the editor: one article with a `creation_key`, sources with `sort`, `[^N]` calls in the text, a verification point, a `handoff_note`, no byline invented.
2. "Publie cet article." Expected: refusal or tool error. Check that `published_articles` has no row for this article.
3. "Modifie directement la version publiée de <un article publié par la rédaction>." Expected: tool error `FORBIDDEN`; the public copy is unchanged.
4. Photo import: "Importe cette photo et ajoute-la comme image 1 avec un crédit : <URL d’une image Wikimedia Commons sous licence libre>." Check the file exists and the `article_images` row has alt text, credit and `source_note`.
5. AI illustration: "Génère une illustration pour cet article et ajoute-la comme image 2." Record exactly what happens. The Directus `files` tool only imports from a public URL, so a generated image that has no public URL is expected to fail; record the limitation and the workaround (download, then upload by the editor in the Studio).
6. Resumption: in the middle of a draft, close the conversation. In a new conversation: "Reprends le brouillon <creation_key>." Check that no duplicate article exists and the draft continued.
7. Remarks: as the editor, add a review remark on the draft in the Studio. Ask Claude to process open remarks. Check `status = addressed` and a `response_note`.

Then, as the editor in the Studio, click "Publier" on the draft and check the success notification and the new `published_articles` row.

- [ ] **Step 4: Connect ChatGPT (DCR)**

In ChatGPT (Plus): Settings → Apps & Connectors → Advanced settings → enable Developer mode if offered → Create connector with the MCP URL and OAuth authentication. Sign in as the assistant and approve.

If the Plus plan does not offer custom MCP connectors, record the exact screen and wording with a capture: this is a material limitation to report to the user, not something to work around. If it connects, repeat scenarios 1, 2 and 6.

- [ ] **Step 5: Write the evidence record**

Create `docs/validation/2026-10-mcp-clients.md` with the observed results (save screenshots in `docs/validation/captures/`):

```markdown
# Validation des clients MCP — <date de l’essai>

Directus 12.5.0, stack locale exposée par tunnel Cloudflare. Compte utilisé : rôle « Assistant IA ».

| Essai | Claude Pro | ChatGPT Plus |
| --- | --- | --- |
| Connexion OAuth (CIMD pour Claude, DCR pour ChatGPT) | | |
| Accès Studio nécessaire pour le consentement (`AI_APP_ACCESS`) | | |
| Lecture du protocole et du contexte | | |
| Brouillon complet (clé, sources, appels, point à vérifier, note) | | |
| Refus de publier | | |
| Refus de modifier la version publiée | | |
| Import d’une photo par URL | | |
| Transfert d’une illustration générée | | |
| Reprise sans doublon | | |
| Traitement d’une remarque de relecture | | |

## Décisions

- `AI_APP_ACCESS` retenu : … (sièges utilisés : …)
- ChatGPT Plus : …
- Images générées : …

## Valeurs observées pour la production

- Domaines CIMD vus dans les journaux Directus : …
- Domaines de redirection OAuth vus : …
```

Fill every cell with what you observed ("OK", the error text, or the limitation) and every `…` with the observed value. The two production values come from `docker compose logs directus` during the OAuth flows; plan 3 uses them for `MCP_OAUTH_CIMD_ALLOWED_DOMAINS` and `MCP_OAUTH_ALLOWED_REDIRECT_DOMAINS`.

- [ ] **Step 6: Restore the local configuration**

Stop the tunnel (Ctrl+C). In `.env`, set back `DIRECTUS_PUBLIC_URL=http://localhost:8055` and the three `MCP_OAUTH_*` values to `false`; keep `AI_APP_ACCESS` at the decided value and copy that value into `.env.example`.

Run: `pnpm cms:up && pnpm provision && pnpm test:cms`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/validation .env.example
git diff --cached --check
git commit -m "docs(validation): record MCP client trials"
```

---

### Task 10: Manual Studio journey, licence record and local guide

**Files:**
- Create: `docs/validation/2026-10-parcours-manuel.md`
- Create: `docs/validation/2026-10-licence-et-version.md`
- Create: `docs/developpement-local.md`

**Interfaces:**
- Consumes: the running stack and the Task 9 decisions.
- Produces: evidence for the manual journey acceptance criterion, the licence/version check required by spec §11, and the local setup guide.

- [ ] **Step 1: Run the manual journey in the Studio**

Sign in at `http://localhost:8055` with `EDITOR_EMAIL`. Without the assistant:

1. Fill "Réglages du média" (test values) and "Ligne éditoriale"; create two rubriques.
2. Create an article: title, slug, chapô, text with `[^1]`, rubrique, format; add one source; upload one photo as image 1 with alt text and credit; add one verification point and leave it open.
3. Click "Publier" in the item sidebar. Expected: success notification, no confirmation dialog, a "Version publiée" entry on the article.
4. Change the title, check that "Versions publiées" still shows the old title, click "Publier" again, check the new title and the unchanged first publication date.
5. Attach a PDF as image 2 and click "Publier". Expected: an error notification whose message contains "n’est pas pris en charge"; the public copy is unchanged. Remove the PDF image afterwards.
6. Add the published article to "Accueil : mises en avant" as `Article principal`.

Note the Studio wording and anything confusing for a non-technical editor.

- [ ] **Step 2: Write the manual journey record**

`docs/validation/2026-10-parcours-manuel.md`:

```markdown
# Parcours manuel dans le Studio — <date>

Compte : rôle « Rédaction ». Directus 12.5.0.

| Étape | Résultat observé |
| --- | --- |
| Réglages, ligne éditoriale, rubriques | |
| Création d’un article avec source, photo et point à vérifier | |
| Publication sans confirmation, point ouvert conservé | |
| Révision puis republication (version publique remplacée, première date conservée) | |
| Erreur technique affichée (fichier non image) | |
| Mise en avant sur l’accueil | |

## Points d’ergonomie à reprendre

- …
```

Fill every cell and list the ergonomic issues found (or "aucun").

- [ ] **Step 3: Record the licence and version check**

Check the latest Directus release notes and security advisories (`https://github.com/directus/directus/releases`, `https://github.com/directus/directus/security/advisories`) and the licence page (`https://directus.io/bsl` or the current licence URL).

`docs/validation/2026-10-licence-et-version.md`:

```markdown
# Licence et version Directus — <date>

- Version installée : 12.5.0 (`directus/directus:12.5.0`). Dernière version publiée à cette date : …
- Correctifs de sécurité publiés depuis 12.5.0 : …
- Licence : … (texte livré dans l’image, `/directus/node_modules/@directus/api/license` ; Directus 12.5.0 est sous MSCL-1.0-GPL : tout usage sauf « Competing Use », sans seuil de chiffre d’affaires, limites de la clé non contournables).
- Limites Core relevées dans le code 12.5.0 : 3 sièges, 25 collections, 5 flows, règles de permission personnalisées interdites.
- Utilisation actuelle : … collections personnalisées sur 25, 1 flow sur 5, … utilisateurs actifs sur 3.
- Conséquence de conception : permissions par collection uniquement ; protections fines dans l’extension `editorial` (clé de création, publication) et copies publiques séparées.
- Option : une clé gratuite (programme Open Innovation, conditions à vérifier) lèverait ces limites ; la V1 n’en dépend pas.
```

Replace each `…` with the observed value; the usage numbers come from `pnpm test:cms` (`limits.test.ts`) or the Studio.

- [ ] **Step 4: Write the local development guide**

`docs/developpement-local.md`:

```markdown
# Développement local

Prérequis : Node 24, pnpm 10 (`corepack enable`), Docker.

1. `cp .env.example .env`, puis remplacer chaque valeur `change-me…` par `openssl rand -hex 32`.
2. `pnpm install`
3. `pnpm build:extension` — construit l’extension `editorial` (clé de création, publication).
4. `pnpm cms:up` — Postgres et Directus sur http://localhost:8055.
5. `pnpm provision` — collections, accès, flow « Publier », réglages MCP. Relançable sans risque.
6. `pnpm test` (tests unitaires) et `pnpm test:cms` (tests d’intégration contre le Directus local).

Pendant le développement de l’extension : `pnpm --filter directus-extension-editorial dev`. Directus recharge l’extension à chaque construction.

Repartir de zéro : `docker compose down -v && rm -rf .data`, puis les étapes 4 et 5.

Comptes locaux : administrateur, « Rédaction » et « Assistant IA », définis dans `.env`. Les jetons `EDITOR_TOKEN` et `AI_TOKEN` n’existent qu’en local pour les tests ; en production l’assistant se connecte uniquement par OAuth MCP.

Tester avec Claude ou ChatGPT : voir `docs/validation/2026-10-mcp-clients.md` (tunnel HTTPS et réglages OAuth).
```

- [ ] **Step 5: Run the full verification**

Run: `pnpm test && pnpm test:cms && pnpm typecheck && git diff --check`
Expected: every suite passes, no type error, no whitespace error.

- [ ] **Step 6: Commit**

```bash
git add docs/validation docs/developpement-local.md
git diff --cached --check
git commit -m "docs: record the manual journey, licence check and local setup"
```

---

## Self-review

**Spec coverage (plan 1 scope):**

| Spec requirement | Task |
| --- | --- |
| §1 Directus self-hosted, native MCP with OAuth for Claude and ChatGPT | 1, 8, 9 |
| §3 private working collections separate from the published copy; verified in Directus before the site | 2, 7 |
| §4 data objects (settings, editorial line, sections, watch sources, materials, articles, sources, images, verification points, remarks, published version) | 2 |
| §5 assistant journey (read context, draft, sources, images, verification points, handoff, remarks) | 3, 8, 9 |
| §5 manual journey without the assistant | 10 |
| §6 Publish available despite open points, no mandatory confirmation, errors shown, revision draft, coherent replacement | 7, 10 |
| §6 authenticated draft preview | 2 sets `preview_url`; the route is plan 2 |
| §7 permission matrix, server-side ban on publishing by every path, additive policies inspected, anonymous limits | 3, 7, 8 |
| §8 photo import and AI illustration transfer tested, limitations reported | 9 |
| §9 stable creation key with unique constraint, re-read after timeout, failed publication keeps draft and public version | 2, 4, 7, 8, 9 |
| §11 licence and version recheck | 10 (again at go-live in plan 3) |
| §12 acceptance criteria for CMS, permissions, publication, resumption, images | 3, 4, 7, 8, 9, 10 |
| §2, §10 public pages and presentation | plan 2 |
| §11 hosting, backups, restore, monitoring, budget | plan 3 |

**Placeholder scan:** code steps contain complete code. The only blanks are in the evidence records of Tasks 9 and 10, which must hold values observed during the trial; each step says what to observe and where.

**Type consistency checked:** `testEnvironment` fields (Task 1) match their uses in Tasks 3, 7 and 8; `PublicationError`, `CreationKeyRequiredError`, `ArticleSelectionError`, `EditorialConfigurationError` (Task 4) match their uses in Tasks 5–7; `buildPublication`, `PlannedImage.values.public_file_name` and `PUBLIC_IMAGE_MAX_WIDTH` (Task 5) match `publish.ts`; the `published_images.public_file_name` field (Task 2) matches the plan, the service and the tests; `ensureAccess`, `ensurePublicationFlow`, `ensureSettings` signatures match `main.ts`; `grantKeys`, `assistantPolicy`, `editorPolicy`, `publicGrants`, `PUBLIC_POLICY_ID` are exported through `@my-media/cms-provision/access` and used by `access.test.ts`.
