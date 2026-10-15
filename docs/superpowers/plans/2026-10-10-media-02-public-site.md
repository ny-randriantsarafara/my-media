# Independent media — Plan 2: public site

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public reading site (home, sections, search, article with sources, about) and the authenticated draft preview, rendering only the published copy produced by plan 1.

**Architecture:** An Astro 7 server-rendered site (Node adapter, standalone) reads Directus anonymously over REST with plain `fetch`, validates every response with Zod at the boundary, and maps records to small view models rendered by Astro components. Article bodies are Markdown rendered by markdown-it with two custom rules for source calls (`[^N]`) and placed images (`[[image:N]]`). Published images are served by the site itself from the public media directory written by the publish operation. The draft preview forwards the editor's Directus session cookie, so no secret is stored in the site.

**Tech Stack:** Astro 7.3.8, `@astrojs/node` 11.1.7, markdown-it 15.0.2, Zod 4, TypeScript ~6.0.3, `@astrojs/check` 0.9.10, Vitest 5, Playwright 1.64 (Chromium), `@directus/sdk` 27.0.0 (end-to-end seeding only).

**Spec:** `docs/superpowers/specs/2026-10-10-media-independant-design.md` (sections 2, 6, 7, 10 and 12). Accepted mockup: "proposition 2", described in `docs/maquettes.md`; its styles are reproduced in Task 4.

**Depends on:** plan 1 (`2026-10-10-media-01-cms-editorial.md`) completed: the local stack runs, `pnpm provision` has been applied, the "Publier" flow works. Plan 3 deploys this site.

## Global Constraints

- "The public site shows only the published version." The site never reads `articles`, `article_*`, `verification_points`, `review_remarks`, `materials`, `watch_sources` or `editorial_line`, except the authenticated preview, which uses the visitor's own Directus session.
- Pages: "Home, sections, search, article and about/contact." "Search covers only published content."
- Article: "title, lead, body, images, byline, dates, sources." "Sources are public" in a "Sources et documents" block.
- Copy: "No public mention of AI use." and "No byline or reference is invented": an empty byline stays empty; a source call that points to no source is not rendered.
- Preview: "Draft preview requires authentication." Anonymous visitors get a 404.
- Presentation: mockup "proposition 2" (sober editorial layout, serif headlines, accent `#7a3d32`), readable on mobile (390 px) and usable with the keyboard.
- Anonymous Directus access is read-only on public collections (plan 1); the site holds no Directus token.
- Toolchain: Node 24, pnpm 10.32.1, TypeScript `~6.0.3` (TypeScript 7 is not accepted by `@astrojs/check`).
- Astro 7 notes: the compiler rejects unclosed HTML tags; `compressHTML` defaults to `'jsx'`, set it to `true` to keep normal HTML whitespace; `src/fetch.ts` is a reserved file name; `@astrojs/node` does not load `.env` at runtime.
- Code rules: no `any`, no `as` assertions, no `@ts-ignore`, no mutation after initialisation, early returns, no readability-hurting ternaries, explicit error handling.
- Body conventions (shared with plan 1): `[^N]` cites the N-th source; `[[image:N]]` alone on a line places image N (N ≥ 2); image 1 is the lead image.

---

## File structure

```text
site/
├── astro.config.mjs
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── lib/
│   │   ├── dates.ts              # French date formatting (Europe/Paris)
│   │   ├── html.ts               # HTML escaping for generated markup
│   │   ├── figure.ts             # <figure> markup shared by lead and body images
│   │   ├── article-body.ts       # markdown-it with [^N] and [[image:N]]
│   │   ├── cms-records.ts        # Zod schemas and field lists for Directus responses
│   │   ├── cms-client.ts         # fetch wrapper (public and session requests)
│   │   ├── view-models.ts        # types consumed by components
│   │   ├── mapping.ts            # records → view models (pure)
│   │   ├── queries.ts            # page-level queries
│   │   ├── cms.ts                # runtime wiring from astro:env
│   │   └── media.ts              # public media file names
│   ├── layouts/BaseLayout.astro
│   ├── components/               # SiteHeader, SiteFooter, LeadStory, SelectionStories,
│   │                             # RecentList, AboutStrip, ArticleView, SourcesList, NotFound
│   ├── pages/
│   │   ├── index.astro
│   │   ├── articles/[slug].astro
│   │   ├── rubriques/[slug].astro
│   │   ├── recherche.astro
│   │   ├── a-propos.astro
│   │   ├── apercu/[id].astro
│   │   ├── media/[name].ts
│   │   ├── 404.astro
│   │   └── 500.astro
│   └── styles/global.css
└── tests/e2e/
    ├── global-setup.ts           # seeds and publishes test content through Directus
    ├── support/{environment,seed-data}.ts
    └── {home,article,navigation,preview,quality}.spec.ts
```

Pure modules in `src/lib` (everything except `cms.ts`) do not import `astro:*`, so Vitest tests them directly. `cms.ts` is the only module that reads runtime configuration.

---

### Task 1: Site scaffold and French dates

**Files:**
- Modify: `pnpm-workspace.yaml`, `package.json` (root scripts)
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/vitest.config.ts`
- Create: `site/src/lib/dates.ts`
- Test: `site/src/lib/dates.test.ts`

**Interfaces:**
- Consumes: root `.env` (plan 1) for `DIRECTUS_URL`, `DIRECTUS_PUBLIC_URL`, `PUBLIC_MEDIA_DIR`.
- Produces: package `@my-media/site` with scripts `dev`, `build`, `start`, `test`, `test:e2e`, `typecheck`; `astro:env/server` exports `DIRECTUS_URL`, `DIRECTUS_PUBLIC_URL`, `PUBLIC_MEDIA_DIR`; `formatLongDate(date: Date): string`, `formatShortDate(date: Date): string`, `formatEditionDate(date: Date): string`, `formatCalendarDate(isoDate: string): string`, `toDateTimeAttribute(date: Date): string`.

- [ ] **Step 1: Register the package and scaffold it**

`pnpm-workspace.yaml`:

```yaml
packages:
  - cms/*
  - cms/extensions/*
  - site
onlyBuiltDependencies:
  - esbuild
  - sharp
```

Add to the root `package.json` `scripts`:

```json
    "dev:site": "pnpm --filter @my-media/site dev",
    "test:e2e": "pnpm --filter @my-media/site test:e2e"
```

`site/package.json`:

```json
{
  "name": "@my-media/site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "start": "node ./dist/server/entry.mjs",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "astro check"
  },
  "dependencies": {
    "@astrojs/node": "11.1.7",
    "astro": "7.3.8",
    "markdown-it": "15.0.2",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.10",
    "@directus/sdk": "27.0.0",
    "@my-media/cms-schema": "workspace:*",
    "@playwright/test": "1.64.0",
    "@types/node": "^24.19.2",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```

`site/astro.config.mjs`:

```js
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';

const repositoryRoot = new URL('../', import.meta.url);

// Development shares the repository .env, whose relative paths start at the repository root.
function useRepositoryEnvironment() {
  const environmentFile = new URL('.env', repositoryRoot);
  if (!existsSync(environmentFile)) {
    return;
  }
  process.loadEnvFile(fileURLToPath(environmentFile));
  const mediaDirectory = process.env.PUBLIC_MEDIA_DIR;
  if (mediaDirectory === undefined || isAbsolute(mediaDirectory)) {
    return;
  }
  process.env.PUBLIC_MEDIA_DIR = fileURLToPath(new URL(mediaDirectory, repositoryRoot));
}

useRepositoryEnvironment();

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  session: false,
  compressHTML: true,
  env: {
    schema: {
      DIRECTUS_URL: envField.string({ context: 'server', access: 'secret' }),
      DIRECTUS_PUBLIC_URL: envField.string({ context: 'server', access: 'secret' }),
      PUBLIC_MEDIA_DIR: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
```

The three variables are declared `secret` so Astro reads them at runtime instead of inlining them at build time: the same image then runs locally and in production. `DIRECTUS_URL` is the address the server uses (internal in production); `DIRECTUS_PUBLIC_URL` is the address browsers use (preview images).

`site/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "types": ["node"],
    "noUncheckedIndexedAccess": true,
    "erasableSyntaxOnly": true
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`site/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing date tests**

`site/src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatEditionDate, formatLongDate, formatShortDate, toDateTimeAttribute } from './dates.ts';

describe('French dates', () => {
  it('formats a publication date in Paris time', () => {
    expect(formatLongDate(new Date('2026-10-10T08:30:00.000Z'))).toBe('10 octobre 2026');
  });

  it('uses the Paris calendar day near midnight', () => {
    expect(formatLongDate(new Date('2026-10-10T23:30:00.000Z'))).toBe('11 octobre 2026');
  });

  it('formats a short date for lists', () => {
    expect(formatShortDate(new Date('2026-10-10T08:30:00.000Z'))).toBe('10 oct.');
  });

  it('formats the edition date with a capitalised weekday', () => {
    expect(formatEditionDate(new Date('2026-10-10T08:30:00.000Z'))).toBe('Samedi 10 octobre 2026');
  });

  it('formats a document date without shifting the day', () => {
    expect(formatCalendarDate('2026-03-12')).toBe('12 mars 2026');
  });

  it('exposes a machine-readable datetime attribute', () => {
    expect(toDateTimeAttribute(new Date('2026-10-10T08:30:00.000Z'))).toBe('2026-10-10T08:30:00.000Z');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm install && pnpm --filter @my-media/site test`
Expected: FAIL with `Failed to load url ./dates.ts`.

- [ ] **Step 4: Implement the formatters**

`site/src/lib/dates.ts`:

```ts
const PARIS_TIME_ZONE = 'Europe/Paris';

const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: PARIS_TIME_ZONE });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: PARIS_TIME_ZONE });
const editionDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: PARIS_TIME_ZONE,
});
const calendarDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDate.format(date);
}

export function formatEditionDate(date: Date): string {
  const text = editionDate.format(date);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function formatCalendarDate(isoDate: string): string {
  return calendarDate.format(new Date(`${isoDate}T00:00:00.000Z`));
}

export function toDateTimeAttribute(date: Date): string {
  return date.toISOString();
}
```

`formatCalendarDate` formats document dates (`YYYY-MM-DD`, no time) in UTC so the day never shifts.

- [ ] **Step 5: Run them to see them pass**

Run: `pnpm --filter @my-media/site test && pnpm --filter @my-media/site typecheck`
Expected: PASS, 6 tests; `astro check` reports 0 errors.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml site
git diff --cached --check
git commit -m "chore(site): scaffold the Astro site with French dates"
```

---

### Task 2: CMS data access and view models

**Files:**
- Create: `site/src/lib/cms-records.ts`, `site/src/lib/cms-client.ts`, `site/src/lib/view-models.ts`, `site/src/lib/mapping.ts`, `site/src/lib/queries.ts`, `site/src/lib/cms.ts`
- Test: `site/src/lib/cms-client.test.ts`, `site/src/lib/mapping.test.ts`

**Interfaces:**
- Consumes: `formatCalendarDate` (Task 1).
- Produces:
  - `cms-client.ts`: types `FetchFunction`, `CmsConnection = { baseUrl: string; fetch: FetchFunction }`, `CmsRequest = { path: string; params?: Record<string, string>; sessionToken?: string }`; class `CmsRequestError` (`status: number`); `fetchPublicData<T>(connection, request, schema): Promise<T>`; `fetchSessionData<T>(connection, request, schema): Promise<T | null>`.
  - `view-models.ts`: `SectionLink`, `FigureImage`, `ArticleCard`, `ArticleSource`, `ArticleView`, `SiteIdentity`, `SiteFrame`, `HomePage`, `SectionPage`.
  - `mapping.ts`: `toArticleCard`, `toPublishedArticleView`, `toDraftArticleView(record, directusPublicUrl)`, `toSiteIdentity`, `sectionHref(slug)`, `toSectionLink`, `buildHomePage(features, recent)`, `wasUpdated(article: ArticleView): boolean`, `composeDocumentTitle(title: string | null, mediaName: string): string`, `safeExternalUrl(url: string | null): string | null`.
  - `queries.ts`: `createPublicQueries(connection)` returning `{ siteFrame, homePage, sectionPage, article, searchOrList }`; `readDraftPreview(connection, request: { articleId: string; sessionToken: string | null; directusPublicUrl: string })`; constant `SESSION_COOKIE_NAME = 'directus_session_token'`.
  - `cms.ts`: `cmsConnection`, `publicQueries`, `directusPublicUrl`.

- [ ] **Step 1: Write the failing client tests**

`site/src/lib/cms-client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CmsRequestError, fetchPublicData, fetchSessionData } from './cms-client.ts';
import type { FetchFunction } from './cms-client.ts';

const titles = z.array(z.object({ title: z.string() }));

function connectionReturning(response: Response) {
  const fetch = vi.fn<FetchFunction>(async () => response);
  return { connection: { baseUrl: 'http://cms.test', fetch }, fetch };
}

describe('fetchPublicData', () => {
  it('requests the path with its query parameters and returns validated data', async () => {
    const { connection, fetch } = connectionReturning(Response.json({ data: [{ title: 'Le budget' }] }));

    const data = await fetchPublicData(connection, { path: '/items/published_articles', params: { fields: 'title', limit: '3' } }, titles);

    expect(data).toEqual([{ title: 'Le budget' }]);
    expect(fetch).toHaveBeenCalledWith('http://cms.test/items/published_articles?fields=title&limit=3', {
      headers: { Accept: 'application/json' },
    });
  });

  it('fails loudly when the CMS refuses or breaks', async () => {
    const { connection } = connectionReturning(new Response('{}', { status: 403 }));

    await expect(fetchPublicData(connection, { path: '/items/sections' }, titles)).rejects.toThrow(CmsRequestError);
  });

  it('rejects an unexpected response shape', async () => {
    const { connection } = connectionReturning(Response.json({ data: [{ name: 'Sans titre' }] }));

    await expect(fetchPublicData(connection, { path: '/items/sections' }, titles)).rejects.toThrow();
  });
});

describe('fetchSessionData', () => {
  it('forwards the Directus session cookie', async () => {
    const { connection, fetch } = connectionReturning(Response.json({ data: [{ title: 'Brouillon' }] }));

    await fetchSessionData(connection, { path: '/items/articles/abc', sessionToken: 'jeton' }, titles);

    expect(fetch).toHaveBeenCalledWith('http://cms.test/items/articles/abc', {
      headers: { Accept: 'application/json', Cookie: 'directus_session_token=jeton' },
    });
  });

  it.each([401, 403, 404])('returns null when access is denied with HTTP %i', async (status) => {
    const { connection } = connectionReturning(new Response('{}', { status }));

    expect(await fetchSessionData(connection, { path: '/items/articles/abc', sessionToken: 'jeton' }, titles)).toBeNull();
  });

  it('still fails on a server error', async () => {
    const { connection } = connectionReturning(new Response('{}', { status: 500 }));

    await expect(fetchSessionData(connection, { path: '/items/articles/abc', sessionToken: 'jeton' }, titles)).rejects.toThrow(
      CmsRequestError,
    );
  });
});
```

- [ ] **Step 2: Write the failing mapping tests**

`site/src/lib/mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ArticleCardRecord, DraftArticleRecord, HomeFeatureRecord } from './cms-records.ts';
import { buildHomePage, composeDocumentTitle, safeExternalUrl, toArticleCard, toDraftArticleView, toSiteIdentity } from './mapping.ts';

function card(slug: string, overrides: Partial<ArticleCardRecord> = {}): ArticleCardRecord {
  return {
    slug,
    title: `Titre ${slug}`,
    summary: 'Chapô',
    byline: null,
    format: null,
    first_published_at: '2026-10-10T08:30:00.000Z',
    section: { name: 'Société', slug: 'societe' },
    images: [],
    ...overrides,
  };
}

function image(sort: number, fileName: string) {
  return { sort, public_file_name: fileName, width: 1200, height: 800, alt: `Image ${sort}`, caption: null, credit: null };
}

describe('toArticleCard', () => {
  it('links to the article, uses the format as kicker and the first image as lead', () => {
    const result = toArticleCard(card('budget', { format: 'Enquête', images: [image(2, 'b.webp'), image(1, 'a.webp')] }));

    expect(result.href).toBe('/articles/budget');
    expect(result.kicker).toBe('Enquête');
    expect(result.image?.src).toBe('/media/a.webp');
    expect(result.section).toEqual({ name: 'Société', href: '/rubriques/societe' });
  });

  it('falls back to the section name as kicker and keeps an empty byline empty', () => {
    const result = toArticleCard(card('budget'));

    expect(result.kicker).toBe('Société');
    expect(result.byline).toBeNull();
    expect(result.image).toBeNull();
  });
});

describe('buildHomePage', () => {
  const recent = [card('un'), card('deux'), card('trois'), card('quatre'), card('cinq')];

  it('uses the editorial lead and selection when they exist', () => {
    const features: HomeFeatureRecord[] = [
      { placement: 'selection', published_article: card('quatre') },
      { placement: 'lead', published_article: card('trois') },
    ];

    const home = buildHomePage(features, recent);

    expect(home.lead?.href).toBe('/articles/trois');
    expect(home.selection.map((item) => item.href)).toEqual(['/articles/quatre']);
    expect(home.recent).toHaveLength(5);
  });

  it('falls back to the most recent articles, without repeating the lead', () => {
    const home = buildHomePage([], recent);

    expect(home.lead?.href).toBe('/articles/un');
    expect(home.selection.map((item) => item.href)).toEqual(['/articles/deux', '/articles/trois', '/articles/quatre']);
  });

  it('has no lead when nothing is published', () => {
    expect(buildHomePage([], []).lead).toBeNull();
  });
});

describe('toDraftArticleView', () => {
  const draft: DraftArticleRecord = {
    title: 'Brouillon',
    summary: null,
    body: 'Texte[^1]',
    byline: null,
    format: 'Analyse',
    section: null,
    references: [
      { sort: 2, organization: null, title: 'Second', url: null, author: null, publication: null, published_on: null, note: null },
      { sort: 1, organization: 'Insee', title: 'Premier', url: 'https://www.insee.fr/', author: 'A. Martin', publication: 'Insee Première', published_on: '2026-03-12', note: null },
    ],
    images: [{ sort: 1, alt: 'Photo', caption: null, credit: null, file: { id: 'file-1', width: null, height: null } }],
  };

  it('numbers sources in order and describes them', () => {
    const view = toDraftArticleView(draft, 'http://cms.test');

    expect(view.sources.map((source) => [source.number, source.anchor, source.title])).toEqual([
      [1, 'source-1', 'Premier'],
      [2, 'source-2', 'Second'],
    ]);
    expect(view.sources[0]?.details).toBe('A. Martin · Insee Première · 12 mars 2026');
    expect(view.sources[1]?.details).toBeNull();
  });

  it('shows private draft images through the editor session on Directus', () => {
    const view = toDraftArticleView(draft, 'http://cms.test');

    expect(view.images[0]).toMatchObject({ src: 'http://cms.test/assets/file-1?width=2000&format=webp', width: null, height: null });
    expect(view.firstPublishedAt).toBeNull();
  });
});

describe('small helpers', () => {
  it('keeps only web links for sources', () => {
    expect(safeExternalUrl('https://example.org/rapport')).toBe('https://example.org/rapport');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('pas une adresse')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });

  it('composes the document title', () => {
    expect(composeDocumentTitle(null, 'La Revue')).toBe('La Revue');
    expect(composeDocumentTitle('Le budget', 'La Revue')).toBe('Le budget — La Revue');
  });

  it('uses a neutral name until the media name is set', () => {
    expect(toSiteIdentity(null).mediaName).toBe('Média');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm --filter @my-media/site test`
Expected: FAIL with `Failed to load url ./cms-client.ts` and `./cms-records.ts`.

- [ ] **Step 4: Implement records, client, view models and mapping**

`site/src/lib/cms-records.ts`:

```ts
import { z } from 'zod';

const sectionRecord = z.object({ name: z.string(), slug: z.string() });

const publishedImageRecord = z.object({
  sort: z.number(),
  public_file_name: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
});

const referenceFields = {
  organization: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  publication: z.string().nullable(),
  published_on: z.string().nullable(),
  note: z.string().nullable(),
};

const publishedReferenceRecord = z.object({ sort: z.number(), ...referenceFields });

const draftReferenceRecord = z.object({ sort: z.number().nullable(), ...referenceFields });

const draftImageRecord = z.object({
  sort: z.number().nullable(),
  alt: z.string(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
  file: z.object({ id: z.string(), width: z.number().nullable(), height: z.number().nullable() }),
});

export const articleCardRecord = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  byline: z.string().nullable(),
  format: z.string().nullable(),
  first_published_at: z.string(),
  section: sectionRecord.nullable(),
  images: z.array(publishedImageRecord),
});

export const publishedArticleRecord = articleCardRecord.extend({
  body: z.string().nullable(),
  last_published_at: z.string(),
  references: z.array(publishedReferenceRecord),
});

export const homeFeatureRecord = z.object({
  placement: z.enum(['lead', 'selection']),
  published_article: articleCardRecord,
});

export const sectionPageRecord = z.object({ name: z.string(), slug: z.string(), description: z.string().nullable() });

export const siteSettingsRecord = z.object({
  media_name: z.string().nullable(),
  edition_label: z.string().nullable(),
  presentation: z.string().nullable(),
  about_body: z.string().nullable(),
  contact_email: z.string().nullable(),
  legal_notice: z.string().nullable(),
});

export const draftArticleRecord = z.object({
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string().nullable(),
  byline: z.string().nullable(),
  format: z.string().nullable(),
  section: sectionRecord.nullable(),
  references: z.array(draftReferenceRecord),
  images: z.array(draftImageRecord),
});

export type PublishedImageRecord = z.infer<typeof publishedImageRecord>;
export type ArticleCardRecord = z.infer<typeof articleCardRecord>;
export type PublishedArticleRecord = z.infer<typeof publishedArticleRecord>;
export type HomeFeatureRecord = z.infer<typeof homeFeatureRecord>;
export type SectionPageRecord = z.infer<typeof sectionPageRecord>;
export type SiteSettingsRecord = z.infer<typeof siteSettingsRecord>;
export type DraftArticleRecord = z.infer<typeof draftArticleRecord>;

const REFERENCE_FIELD_NAMES = ['sort', 'organization', 'title', 'url', 'author', 'publication', 'published_on', 'note'];

export const CARD_FIELDS = [
  'slug',
  'title',
  'summary',
  'byline',
  'format',
  'first_published_at',
  'section.name',
  'section.slug',
  'images.sort',
  'images.public_file_name',
  'images.width',
  'images.height',
  'images.alt',
  'images.caption',
  'images.credit',
];

export const ARTICLE_FIELDS = [
  ...CARD_FIELDS,
  'body',
  'last_published_at',
  ...REFERENCE_FIELD_NAMES.map((field) => `references.${field}`),
];

export const HOME_FEATURE_FIELDS = ['placement', ...CARD_FIELDS.map((field) => `published_article.${field}`)];

export const SITE_SETTINGS_FIELDS = ['media_name', 'edition_label', 'presentation', 'about_body', 'contact_email', 'legal_notice'];

export const DRAFT_FIELDS = [
  'title',
  'summary',
  'body',
  'byline',
  'format',
  'section.name',
  'section.slug',
  ...REFERENCE_FIELD_NAMES.map((field) => `references.${field}`),
  'images.sort',
  'images.alt',
  'images.caption',
  'images.credit',
  'images.file.id',
  'images.file.width',
  'images.file.height',
];
```

Each field list sits next to the schema that validates it, so a field added to one is visibly missing from the other in review.

`site/src/lib/cms-client.ts`:

```ts
import { z } from 'zod';

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export type CmsConnection = { baseUrl: string; fetch: FetchFunction };

export type CmsRequest = { path: string; params?: Record<string, string>; sessionToken?: string };

export class CmsRequestError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`CMS returned HTTP ${status} for ${path}.`);
    this.name = 'CmsRequestError';
    this.status = status;
  }
}

const ACCESS_DENIED_STATUSES = [401, 403, 404];

export async function fetchPublicData<T>(connection: CmsConnection, request: CmsRequest, schema: z.ZodType<T>): Promise<T> {
  const response = await send(connection, request);
  if (!response.ok) {
    throw new CmsRequestError(request.path, response.status);
  }
  return parseData(response, schema);
}

export async function fetchSessionData<T>(connection: CmsConnection, request: CmsRequest, schema: z.ZodType<T>): Promise<T | null> {
  const response = await send(connection, request);
  if (ACCESS_DENIED_STATUSES.includes(response.status)) {
    return null;
  }
  if (!response.ok) {
    throw new CmsRequestError(request.path, response.status);
  }
  return parseData(response, schema);
}

function send(connection: CmsConnection, request: CmsRequest): Promise<Response> {
  return connection.fetch(buildUrl(connection.baseUrl, request), { headers: buildHeaders(request) });
}

function buildUrl(baseUrl: string, request: CmsRequest): string {
  const url = new URL(request.path, baseUrl).toString();
  const query = new URLSearchParams(request.params ?? {}).toString();
  if (query === '') {
    return url;
  }
  return `${url}?${query}`;
}

function buildHeaders(request: CmsRequest): Record<string, string> {
  if (request.sessionToken === undefined) {
    return { Accept: 'application/json' };
  }
  return { Accept: 'application/json', Cookie: `directus_session_token=${request.sessionToken}` };
}

async function parseData<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json();
  return z.object({ data: schema }).parse(body).data;
}
```

`site/src/lib/view-models.ts`:

```ts
export type SectionLink = { name: string; href: string };

export type FigureImage = {
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type ArticleCard = {
  href: string;
  title: string;
  summary: string | null;
  byline: string | null;
  kicker: string | null;
  section: SectionLink | null;
  publishedAt: Date;
  image: FigureImage | null;
};

export type ArticleSource = {
  number: number;
  anchor: string;
  organization: string | null;
  title: string;
  url: string | null;
  details: string | null;
  note: string | null;
};

export type ArticleView = {
  title: string;
  summary: string | null;
  body: string;
  byline: string | null;
  kicker: string | null;
  section: SectionLink | null;
  firstPublishedAt: Date | null;
  lastPublishedAt: Date | null;
  images: FigureImage[];
  sources: ArticleSource[];
};

export type SiteIdentity = {
  mediaName: string;
  editionLabel: string | null;
  presentation: string | null;
  aboutBody: string | null;
  contactEmail: string | null;
  legalNotice: string | null;
};

export type SiteFrame = { identity: SiteIdentity; sections: SectionLink[] };

export type HomePage = { lead: ArticleCard | null; selection: ArticleCard[]; recent: ArticleCard[] };

export type SectionPage = { name: string; description: string | null; articles: ArticleCard[] };
```

`site/src/lib/mapping.ts`:

```ts
import type {
  ArticleCardRecord,
  DraftArticleRecord,
  HomeFeatureRecord,
  PublishedArticleRecord,
  PublishedImageRecord,
  SiteSettingsRecord,
} from './cms-records.ts';
import { formatCalendarDate } from './dates.ts';
import type { ArticleCard, ArticleSource, ArticleView, FigureImage, HomePage, SectionLink, SiteIdentity } from './view-models.ts';

type SectionValue = { name: string; slug: string } | null;

type ReferenceValue = {
  sort: number | null;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

const DEFAULT_MEDIA_NAME = 'Média';
const SELECTION_SIZE = 3;
const WEB_PROTOCOLS = ['http:', 'https:'];

export function sectionHref(slug: string): string {
  return `/rubriques/${slug}`;
}

export function toSectionLink(section: SectionValue): SectionLink | null {
  if (section === null) {
    return null;
  }
  return { name: section.name, href: sectionHref(section.slug) };
}

export function toArticleCard(record: ArticleCardRecord): ArticleCard {
  return {
    href: `/articles/${record.slug}`,
    title: record.title,
    summary: record.summary,
    byline: record.byline,
    kicker: record.format ?? record.section?.name ?? null,
    section: toSectionLink(record.section),
    publishedAt: new Date(record.first_published_at),
    image: firstFigure(record.images),
  };
}

export function toPublishedArticleView(record: PublishedArticleRecord): ArticleView {
  return {
    title: record.title,
    summary: record.summary,
    body: record.body ?? '',
    byline: record.byline,
    kicker: record.format ?? record.section?.name ?? null,
    section: toSectionLink(record.section),
    firstPublishedAt: new Date(record.first_published_at),
    lastPublishedAt: new Date(record.last_published_at),
    images: bySortPosition(record.images).map(toPublishedFigure),
    sources: toSources(record.references),
  };
}

export function toDraftArticleView(record: DraftArticleRecord, directusPublicUrl: string): ArticleView {
  return {
    title: record.title,
    summary: record.summary,
    body: record.body ?? '',
    byline: record.byline,
    kicker: record.format ?? record.section?.name ?? null,
    section: toSectionLink(record.section),
    firstPublishedAt: null,
    lastPublishedAt: null,
    images: bySortPosition(record.images).map((image) => ({
      src: `${directusPublicUrl}/assets/${image.file.id}?width=2000&format=webp`,
      width: image.file.width,
      height: image.file.height,
      alt: image.alt,
      caption: image.caption,
      credit: image.credit,
    })),
    sources: toSources(record.references),
  };
}

export function toSiteIdentity(record: SiteSettingsRecord | null): SiteIdentity {
  return {
    mediaName: record?.media_name ?? DEFAULT_MEDIA_NAME,
    editionLabel: record?.edition_label ?? null,
    presentation: record?.presentation ?? null,
    aboutBody: record?.about_body ?? null,
    contactEmail: record?.contact_email ?? null,
    legalNotice: record?.legal_notice ?? null,
  };
}

export function buildHomePage(features: HomeFeatureRecord[], recent: ArticleCardRecord[]): HomePage {
  const lead = chooseLead(features, recent);
  return {
    lead: mapOptional(lead, toArticleCard),
    selection: chooseSelection(features, recent, lead).map(toArticleCard),
    recent: recent.map(toArticleCard),
  };
}

export function wasUpdated(article: ArticleView): boolean {
  if (article.firstPublishedAt === null || article.lastPublishedAt === null) {
    return false;
  }
  return article.lastPublishedAt.getTime() !== article.firstPublishedAt.getTime();
}

export function composeDocumentTitle(title: string | null, mediaName: string): string {
  if (title === null) {
    return mediaName;
  }
  return `${title} — ${mediaName}`;
}

export function safeExternalUrl(url: string | null): string | null {
  if (url === null || !URL.canParse(url)) {
    return null;
  }
  if (!WEB_PROTOCOLS.includes(new URL(url).protocol)) {
    return null;
  }
  return url;
}

function chooseLead(features: HomeFeatureRecord[], recent: ArticleCardRecord[]): ArticleCardRecord | null {
  const featured = features.find((feature) => feature.placement === 'lead');
  if (featured !== undefined) {
    return featured.published_article;
  }
  return recent[0] ?? null;
}

function chooseSelection(features: HomeFeatureRecord[], recent: ArticleCardRecord[], lead: ArticleCardRecord | null): ArticleCardRecord[] {
  const featured = features.filter((feature) => feature.placement === 'selection').map((feature) => feature.published_article);
  if (featured.length > 0) {
    return featured.slice(0, SELECTION_SIZE);
  }
  return recent.filter((article) => article.slug !== lead?.slug).slice(0, SELECTION_SIZE);
}

function mapOptional<T, R>(value: T | null, map: (input: T) => R): R | null {
  if (value === null) {
    return null;
  }
  return map(value);
}

function bySortPosition<T extends { sort: number | null }>(items: T[]): T[] {
  return items.toSorted((first, second) => (first.sort ?? Number.MAX_SAFE_INTEGER) - (second.sort ?? Number.MAX_SAFE_INTEGER));
}

function firstFigure(images: PublishedImageRecord[]): FigureImage | null {
  const [first] = bySortPosition(images);
  return mapOptional(first ?? null, toPublishedFigure);
}

function toPublishedFigure(image: PublishedImageRecord): FigureImage {
  return {
    src: `/media/${image.public_file_name}`,
    width: image.width,
    height: image.height,
    alt: image.alt,
    caption: image.caption,
    credit: image.credit,
  };
}

function toSources(references: ReferenceValue[]): ArticleSource[] {
  return bySortPosition(references).map((reference, index) => ({
    number: index + 1,
    anchor: `source-${index + 1}`,
    organization: reference.organization,
    title: reference.title,
    url: safeExternalUrl(reference.url),
    details: describeReference(reference),
    note: reference.note,
  }));
}

function describeReference(reference: ReferenceValue): string | null {
  const parts = [reference.author, reference.publication, mapOptional(reference.published_on, formatCalendarDate)].filter(
    (part) => part !== null && part !== '',
  );
  if (parts.length === 0) {
    return null;
  }
  return parts.join(' · ');
}
```

Sources are numbered by display position, which is also how `[^N]` resolves; published sources already carry `sort` 1…n from the publish operation, and drafts get the same numbering in the preview.

- [ ] **Step 5: Implement the page queries and runtime wiring**

`site/src/lib/queries.ts`:

```ts
import { z } from 'zod';
import { fetchPublicData, fetchSessionData } from './cms-client.ts';
import type { CmsConnection } from './cms-client.ts';
import {
  ARTICLE_FIELDS,
  articleCardRecord,
  CARD_FIELDS,
  DRAFT_FIELDS,
  draftArticleRecord,
  HOME_FEATURE_FIELDS,
  homeFeatureRecord,
  publishedArticleRecord,
  SITE_SETTINGS_FIELDS,
  sectionPageRecord,
  siteSettingsRecord,
} from './cms-records.ts';
import type { ArticleCardRecord } from './cms-records.ts';
import { buildHomePage, sectionHref, toArticleCard, toDraftArticleView, toPublishedArticleView, toSiteIdentity } from './mapping.ts';
import type { ArticleCard, ArticleView, HomePage, SectionPage, SiteFrame } from './view-models.ts';

export const SESSION_COOKIE_NAME = 'directus_session_token';

const RECENT_LIMIT = '10';
const LIST_LIMIT = '50';
const SEARCH_LIMIT = '30';
const MAX_SEARCH_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ALL_RELATED_ITEMS = JSON.stringify({ references: { _limit: -1 }, images: { _limit: -1 } });

type DraftPreviewRequest = { articleId: string; sessionToken: string | null; directusPublicUrl: string };

const sectionLinkRecord = sectionPageRecord.pick({ name: true, slug: true });

export function createPublicQueries(connection: CmsConnection) {
  function fetchArticleRecords(params: Record<string, string>): Promise<ArticleCardRecord[]> {
    return fetchPublicData(
      connection,
      { path: '/items/published_articles', params: { fields: CARD_FIELDS.join(','), sort: '-first_published_at', ...params } },
      z.array(articleCardRecord),
    );
  }

  async function listArticles(params: Record<string, string>): Promise<ArticleCard[]> {
    const records = await fetchArticleRecords(params);
    return records.map(toArticleCard);
  }

  return {
    async siteFrame(): Promise<SiteFrame> {
      const [settings, sections] = await Promise.all([
        fetchPublicData(
          connection,
          { path: '/items/site_settings', params: { fields: SITE_SETTINGS_FIELDS.join(',') } },
          siteSettingsRecord.nullable(),
        ),
        fetchPublicData(
          connection,
          { path: '/items/sections', params: { fields: 'name,slug', sort: 'sort,name', limit: '-1' } },
          z.array(sectionLinkRecord),
        ),
      ]);
      return {
        identity: toSiteIdentity(settings),
        sections: sections.map((section) => ({ name: section.name, href: sectionHref(section.slug) })),
      };
    },

    async homePage(): Promise<HomePage> {
      const [features, recent] = await Promise.all([
        fetchPublicData(
          connection,
          { path: '/items/home_features', params: { fields: HOME_FEATURE_FIELDS.join(','), sort: 'sort', limit: '-1' } },
          z.array(homeFeatureRecord),
        ),
        fetchArticleRecords({ limit: RECENT_LIMIT }),
      ]);
      return buildHomePage(features, recent);
    },

    async sectionPage(slug: string): Promise<SectionPage | null> {
      const [section] = await fetchPublicData(
        connection,
        { path: '/items/sections', params: { fields: 'name,slug,description', filter: JSON.stringify({ slug: { _eq: slug } }), limit: '1' } },
        z.array(sectionPageRecord),
      );
      if (section === undefined) {
        return null;
      }
      const articles = await listArticles({ filter: JSON.stringify({ section: { slug: { _eq: slug } } }), limit: LIST_LIMIT });
      return { name: section.name, description: section.description, articles };
    },

    async article(slug: string): Promise<ArticleView | null> {
      const [record] = await fetchPublicData(
        connection,
        {
          path: '/items/published_articles',
          params: { fields: ARTICLE_FIELDS.join(','), filter: JSON.stringify({ slug: { _eq: slug } }), deep: ALL_RELATED_ITEMS, limit: '1' },
        },
        z.array(publishedArticleRecord),
      );
      if (record === undefined) {
        return null;
      }
      return toPublishedArticleView(record);
    },

    async searchOrList(query: string): Promise<ArticleCard[]> {
      const searchText = query.trim().slice(0, MAX_SEARCH_LENGTH);
      if (searchText === '') {
        return listArticles({ limit: LIST_LIMIT });
      }
      return listArticles({ search: searchText, limit: SEARCH_LIMIT });
    },
  };
}

export type PublicQueries = ReturnType<typeof createPublicQueries>;

export async function readDraftPreview(connection: CmsConnection, request: DraftPreviewRequest): Promise<ArticleView | null> {
  if (request.sessionToken === null || !UUID.test(request.articleId)) {
    return null;
  }
  const record = await fetchSessionData(
    connection,
    {
      path: `/items/articles/${request.articleId}`,
      params: { fields: DRAFT_FIELDS.join(','), deep: ALL_RELATED_ITEMS },
      sessionToken: request.sessionToken,
    },
    draftArticleRecord,
  );
  if (record === null) {
    return null;
  }
  return toDraftArticleView(record, request.directusPublicUrl);
}
```

The search uses the Directus `search` parameter on `published_articles` only, so a word that exists only in a draft can never match.

`site/src/lib/cms.ts`:

```ts
import { DIRECTUS_PUBLIC_URL, DIRECTUS_URL } from 'astro:env/server';
import type { CmsConnection } from './cms-client.ts';
import { createPublicQueries } from './queries.ts';

export const cmsConnection: CmsConnection = { baseUrl: DIRECTUS_URL, fetch };

export const publicQueries = createPublicQueries(cmsConnection);

export const directusPublicUrl = DIRECTUS_PUBLIC_URL;
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm --filter @my-media/site test && pnpm --filter @my-media/site typecheck`
Expected: PASS (dates, client and mapping tests); 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add site/src/lib
git diff --cached --check
git commit -m "feat(site): read published content from Directus"
```

---

### Task 3: Article body rendering

**Files:**
- Create: `site/src/lib/html.ts`, `site/src/lib/figure.ts`, `site/src/lib/article-body.ts`
- Test: `site/src/lib/article-body.test.ts`

**Interfaces:**
- Consumes: `FigureImage` (Task 2).
- Produces: `escapeHtml(text: string): string`; `renderFigure(image: FigureImage, options: { className: string; loading: 'eager' | 'lazy' }): string`; `renderArticleBody(markdown: string, context: { sourceCount: number; images: FigureImage[] }): string`; `renderMarkdown(markdown: string): string`.

- [ ] **Step 1: Write the failing tests**

`site/src/lib/article-body.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderArticleBody, renderMarkdown } from './article-body.ts';
import { renderFigure } from './figure.ts';
import type { FigureImage } from './view-models.ts';

const leadImage: FigureImage = { src: '/media/une.webp', width: 1200, height: 800, alt: 'Image principale', caption: null, credit: null };
const bodyImage: FigureImage = {
  src: '/media/corps.webp',
  width: 1000,
  height: 600,
  alt: 'Salle du conseil',
  caption: 'Le conseil réuni',
  credit: 'Rédaction',
};
const images: FigureImage[] = [leadImage, bodyImage];

describe('renderArticleBody', () => {
  it('renders Markdown paragraphs and headings', () => {
    const html = renderArticleBody('Premier paragraphe.\n\n## Intertitre', { sourceCount: 0, images: [] });

    expect(html).toContain('<p>Premier paragraphe.</p>');
    expect(html).toContain('<h2>Intertitre</h2>');
  });

  it('escapes raw HTML written in the text', () => {
    const html = renderArticleBody('<script>alert(1)</script>', { sourceCount: 0, images: [] });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('links a source call to its source', () => {
    const html = renderArticleBody('Un chiffre[^2].', { sourceCount: 2, images: [] });

    expect(html).toContain('<a class="reference" href="#source-2" aria-label="Source 2">2</a>');
  });

  it('drops a source call that points to no source', () => {
    const html = renderArticleBody('Un chiffre[^3].', { sourceCount: 2, images: [] });

    expect(html).toContain('<p>Un chiffre.</p>');
  });

  it('places image 2 where the marker stands alone on a line', () => {
    const html = renderArticleBody('Avant.\n\n[[image:2]]\n\nAprès.', { sourceCount: 0, images });

    expect(html).toContain('<figure class="body-figure"><img src="/media/corps.webp" alt="Salle du conseil" width="1000" height="600"');
    expect(html).toContain('<figcaption>Le conseil réuni <span class="credit">Rédaction</span></figcaption>');
  });

  it('places an image directly after a paragraph line', () => {
    const html = renderArticleBody('Avant.\n[[image:2]]', { sourceCount: 0, images });

    expect(html).toContain('<p>Avant.</p>');
    expect(html).toContain('class="body-figure"');
  });

  it('ignores the lead image, missing images and markers inside a sentence', () => {
    expect(renderArticleBody('[[image:1]]', { sourceCount: 0, images })).toBe('');
    expect(renderArticleBody('[[image:9]]', { sourceCount: 0, images })).toBe('');
    expect(renderArticleBody('Voir [[image:2]] ici.', { sourceCount: 0, images })).toContain('<p>Voir [[image:2]] ici.</p>');
  });
});

describe('renderFigure', () => {
  it('omits dimensions that are unknown', () => {
    const html = renderFigure({ ...bodyImage, width: null, height: null }, { className: 'lead-figure', loading: 'eager' });

    expect(html).not.toContain('width=');
    expect(html).toContain('loading="eager"');
  });

  it('escapes text coming from the CMS', () => {
    const html = renderFigure({ ...leadImage, alt: 'Un "titre" <b>' }, { className: 'lead-figure', loading: 'eager' });

    expect(html).toContain('alt="Un &quot;titre&quot; &lt;b&gt;"');
  });

  it('shows the credit alone when there is no caption', () => {
    const html = renderFigure({ ...leadImage, credit: 'Rédaction' }, { className: 'lead-figure', loading: 'eager' });

    expect(html).toContain('<figcaption><span class="credit">Rédaction</span></figcaption>');
  });
});

describe('renderMarkdown', () => {
  it('renders plain Markdown pages such as the about page', () => {
    expect(renderMarkdown('**Indépendant** et lisible.')).toBe('<p><strong>Indépendant</strong> et lisible.</p>\n');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @my-media/site test`
Expected: FAIL with `Failed to load url ./article-body.ts`.

- [ ] **Step 3: Implement escaping, figures and the renderer**

`site/src/lib/html.ts`:

```ts
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}
```

`site/src/lib/figure.ts`:

```ts
import { escapeHtml } from './html.ts';
import type { FigureImage } from './view-models.ts';

type FigureOptions = { className: string; loading: 'eager' | 'lazy' };

export function renderFigure(image: FigureImage, options: FigureOptions): string {
  const source = escapeHtml(image.src);
  const alternative = escapeHtml(image.alt);
  return `<figure class="${options.className}"><img src="${source}" alt="${alternative}"${renderDimensions(image)} loading="${options.loading}" decoding="async">${renderCaption(image)}</figure>`;
}

function renderDimensions(image: FigureImage): string {
  if (image.width === null || image.height === null) {
    return '';
  }
  return ` width="${image.width}" height="${image.height}"`;
}

function renderCaption(image: FigureImage): string {
  const parts = [renderCaptionText(image.caption), renderCredit(image.credit)].filter((part) => part !== '');
  if (parts.length === 0) {
    return '';
  }
  return `<figcaption>${parts.join(' ')}</figcaption>`;
}

function renderCaptionText(caption: string | null): string {
  if (caption === null) {
    return '';
  }
  return escapeHtml(caption);
}

function renderCredit(credit: string | null): string {
  if (credit === null || credit === '') {
    return '';
  }
  return `<span class="credit">${escapeHtml(credit)}</span>`;
}
```

`site/src/lib/article-body.ts`:

```ts
import MarkdownIt from 'markdown-it';
import type { StateBlock, StateInline } from 'markdown-it';
import { renderFigure } from './figure.ts';
import type { FigureImage } from './view-models.ts';

export type ArticleBodyContext = { sourceCount: number; images: FigureImage[] };

const REFERENCE_CALL = /^\[\^(\d{1,3})\]/;
const IMAGE_PLACEMENT = /^\[\[image:(\d{1,3})\]\]\s*$/;
const FIRST_PLACEABLE_IMAGE = 2;
const NO_MARKERS: ArticleBodyContext = { sourceCount: 0, images: [] };

export function renderArticleBody(markdown: string, context: ArticleBodyContext): string {
  return createRenderer(context).render(markdown);
}

export function renderMarkdown(markdown: string): string {
  return renderArticleBody(markdown, NO_MARKERS);
}

function createRenderer(context: ArticleBodyContext): MarkdownIt {
  const markdownIt = new MarkdownIt({ html: false, linkify: true, typographer: false });
  markdownIt.inline.ruler.before('link', 'reference_call', referenceCallRule);
  markdownIt.block.ruler.before('paragraph', 'image_placement', imagePlacementRule, { alt: ['paragraph'] });
  markdownIt.renderer.rules['reference_call'] = (tokens, index) =>
    renderReferenceCall(readNumber(tokens[index]?.meta), context.sourceCount);
  markdownIt.renderer.rules['image_placement'] = (tokens, index) => renderPlacedImage(readNumber(tokens[index]?.meta), context.images);
  return markdownIt;
}

function referenceCallRule(state: StateInline, silent: boolean): boolean {
  const match = REFERENCE_CALL.exec(state.src.slice(state.pos));
  if (match === null) {
    return false;
  }
  if (!silent) {
    const token = state.push('reference_call', '', 0);
    token.meta = { number: Number(match[1]) };
  }
  state.pos += match[0].length;
  return true;
}

function imagePlacementRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const lineStart = (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
  const lineEnd = state.eMarks[startLine] ?? lineStart;
  const match = IMAGE_PLACEMENT.exec(state.src.slice(lineStart, lineEnd));
  if (match === null) {
    return false;
  }
  if (silent) {
    return true;
  }
  const token = state.push('image_placement', '', 0);
  token.meta = { number: Number(match[1]) };
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

function readNumber(meta: Record<string, unknown> | null | undefined): number | null {
  const value = meta?.['number'];
  if (typeof value !== 'number') {
    return null;
  }
  return value;
}

function renderReferenceCall(number: number | null, sourceCount: number): string {
  if (number === null || number < 1 || number > sourceCount) {
    return '';
  }
  return `<a class="reference" href="#source-${number}" aria-label="Source ${number}">${number}</a>`;
}

function renderPlacedImage(number: number | null, images: FigureImage[]): string {
  if (number === null || number < FIRST_PLACEABLE_IMAGE) {
    return '';
  }
  const image = images[number - 1];
  if (image === undefined) {
    return '';
  }
  return renderFigure(image, { className: 'body-figure', loading: 'lazy' });
}
```

Markdown-it rules work by advancing the parser state (`state.pos`, `state.line`) and setting token metadata: that is the library's contract, so these assignments are the intended API, not shared mutable state.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter @my-media/site test && pnpm --filter @my-media/site typecheck`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib
git diff --cached --check
git commit -m "feat(site): render article bodies with source calls and placed images"
```

---

### Task 4: Layout, styles, home page and end-to-end harness

**Files:**
- Create: `site/playwright.config.ts`
- Create: `site/tests/e2e/support/environment.ts`, `site/tests/e2e/support/seed-data.ts`, `site/tests/e2e/support/test.ts`, `site/tests/e2e/global-setup.ts`
- Create: `site/src/styles/global.css`, `site/src/layouts/BaseLayout.astro`
- Create: `site/src/components/SiteHeader.astro`, `SiteFooter.astro`, `NotFound.astro`, `LeadStory.astro`, `SelectionStories.astro`, `RecentList.astro`, `AboutStrip.astro`
- Create: `site/src/pages/index.astro`, `site/src/pages/404.astro`, `site/src/pages/500.astro`
- Test: `site/tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `publicQueries` (Task 2), `renderFigure` (Task 3), dates (Task 1); the "Publier" flow and editor token from plan 1.
- Produces:
  - `e2eEnvironment` (`siteUrl`, `directusUrl`, `directusPublicUrl`, `publicMediaDirectory`, `editorEmail`, `editorPassword`, `editorToken`).
  - `SeedData` and a Playwright `test` with a `seed` fixture: `mediaName`, `suffix`, `sectionName`, `sectionSlug`, `articleSlug`, `articleTitle`, `articleSummary`, `bodyImageAlt`, `draftId`, `draftSlug`, `draftTitle`, `draftOnlyWord`, `privateTexts`.
  - `BaseLayout` props `{ title: string | null; description?: string | null; noindex?: boolean }`; `RecentList` props `{ title: string; articles: ArticleCard[]; hideTitle?: boolean }`.

- [ ] **Step 1: Write the end-to-end harness**

`site/tests/e2e/support/environment.ts`:

```ts
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repositoryRoot = new URL('../../../../', import.meta.url);
const values = parseEnv(readFileSync(new URL('.env', repositoryRoot), 'utf8'));

function requireValue(name: string): string {
  const value = values[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is missing from the .env file at the repository root.`);
  }
  return value;
}

function resolveFromRepository(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return fileURLToPath(new URL(path, repositoryRoot));
}

export const e2eEnvironment = {
  siteUrl: requireValue('SITE_URL'),
  directusUrl: requireValue('DIRECTUS_URL'),
  directusPublicUrl: requireValue('DIRECTUS_PUBLIC_URL'),
  publicMediaDirectory: resolveFromRepository(requireValue('PUBLIC_MEDIA_DIR')),
  editorEmail: requireValue('EDITOR_EMAIL'),
  editorPassword: requireValue('EDITOR_PASSWORD'),
  editorToken: requireValue('EDITOR_TOKEN'),
};
```

`site/tests/e2e/support/seed-data.ts`:

```ts
import { z } from 'zod';

export const SEED_VARIABLE = 'E2E_SEED';

const seedData = z.object({
  mediaName: z.string(),
  suffix: z.string(),
  sectionName: z.string(),
  sectionSlug: z.string(),
  articleSlug: z.string(),
  articleTitle: z.string(),
  articleSummary: z.string(),
  bodyImageAlt: z.string(),
  draftId: z.string(),
  draftSlug: z.string(),
  draftTitle: z.string(),
  draftOnlyWord: z.string(),
  privateTexts: z.array(z.string()),
});

export type SeedData = z.infer<typeof seedData>;

export function readSeedData(): SeedData {
  const serialized = process.env[SEED_VARIABLE];
  if (serialized === undefined) {
    throw new Error(`${SEED_VARIABLE} is missing: Playwright global setup did not run.`);
  }
  const parsed: unknown = JSON.parse(serialized);
  return seedData.parse(parsed);
}
```

`site/tests/e2e/support/test.ts`:

```ts
import { test as base } from '@playwright/test';
import { readSeedData } from './seed-data.ts';
import type { SeedData } from './seed-data.ts';

export const test = base.extend<{ seed: SeedData }>({
  seed: async ({}, use) => {
    await use(readSeedData());
  },
});

export { expect } from '@playwright/test';
```

The seed is read inside a fixture rather than at module load, so it is only read once global setup has run.

`site/tests/e2e/global-setup.ts`:

```ts
import { randomUUID } from 'node:crypto';
import {
  createDirectus,
  createItem,
  createItems,
  deleteItems,
  readFlows,
  readItems,
  rest,
  staticToken,
  updateSingleton,
  uploadFiles,
} from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';
import { e2eEnvironment } from './support/environment.ts';
import { SEED_VARIABLE } from './support/seed-data.ts';
import type { SeedData } from './support/seed-data.ts';

const MEDIA_NAME = 'La Revue d’essai';
const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgYGAAAAAEAAGjChXjAAAAAElFTkSuQmCC',
    'base64',
  ),
);

function createEditorClient() {
  return createDirectus<EditorialSchema>(e2eEnvironment.directusUrl).with(staticToken(e2eEnvironment.editorToken)).with(rest());
}

type EditorClient = ReturnType<typeof createEditorClient>;

export default async function globalSetup(): Promise<void> {
  const client = createEditorClient();
  const suffix = randomUUID().slice(0, 8);
  await updateSiteSettings(client);
  const sectionId = await ensureSection(client, 'Société', 'societe');
  await ensureSection(client, 'Culture', 'culture');
  const article = await createSourcedArticle(client, sectionId, suffix);
  await publish(client, article.id);
  await featureAsLead(client, article.id);
  const draft = await createDraftOnlyArticle(client, sectionId, suffix);
  const seed: SeedData = {
    mediaName: MEDIA_NAME,
    suffix,
    sectionName: 'Société',
    sectionSlug: 'societe',
    articleSlug: article.slug,
    articleTitle: article.title,
    articleSummary: article.summary,
    bodyImageAlt: 'Tableau des montants votés',
    draftId: draft.id,
    draftSlug: draft.slug,
    draftTitle: draft.title,
    draftOnlyWord: draft.onlyWord,
    privateTexts: article.privateTexts,
  };
  process.env[SEED_VARIABLE] = JSON.stringify(seed);
}

async function updateSiteSettings(client: EditorClient): Promise<void> {
  await client.request(
    updateSingleton('site_settings', {
      media_name: MEDIA_NAME,
      edition_label: 'Édition d’essai',
      presentation: 'Un média indépendant d’essai, sourcé et lisible.',
      about_body: '**Notre méthode** : chaque article cite ses sources publiques.',
      contact_email: 'contact@example.com',
      legal_notice: 'Directeur de la publication : Camille Durand. Hébergeur : OVHcloud, 2 rue Kellermann, 59100 Roubaix.',
    }),
  );
}

async function ensureSection(client: EditorClient, name: string, slug: string): Promise<string> {
  const [existing] = await client.request(readItems('sections', { filter: { slug: { _eq: slug } }, fields: ['id'], limit: 1 }));
  if (existing !== undefined) {
    return existing.id;
  }
  const created = await client.request(createItem('sections', { name, slug }, { fields: ['id'] }));
  return created.id;
}

async function uploadPng(client: EditorClient, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), fileName);
  const uploaded = await client.request(uploadFiles(form, { fields: ['id'] }));
  return uploaded.id;
}

async function createSourcedArticle(client: EditorClient, sectionId: string, suffix: string) {
  const title = `Enquête sur les budgets participatifs ${suffix}`;
  const slug = `enquete-budgets-${suffix}`;
  const summary = 'Ce que les chiffres publics disent vraiment des budgets participatifs.';
  const creationKey = `e2e-enquete-${suffix}`;
  const handoffNote = `Note de passage privée ${suffix}`;
  const materialTitle = `Notes privées ${suffix}`;
  const imageSourceNote = `Origine privée ${suffix}`;
  const verificationClaim = `Point de vérification privé ${suffix}`;

  const material = await client.request(createItem('materials', { title: materialTitle }, { fields: ['id'] }));
  const leadFileId = await uploadPng(client, `une-${suffix}.png`);
  const bodyFileId = await uploadPng(client, `corps-${suffix}.png`);
  const article = await client.request(
    createItem(
      'articles',
      {
        title,
        slug,
        summary,
        creation_key: creationKey,
        body: [
          `Premier paragraphe de l’enquête ${suffix}, appuyé sur un rapport public[^1].`,
          '',
          '## Ce que disent les chiffres',
          '',
          'Les montants votés ont doublé en cinq ans[^2].',
          '',
          '[[image:2]]',
          '',
          'Dernier paragraphe de l’enquête.',
        ].join('\n'),
        byline: 'Camille Durand',
        format: 'Enquête',
        section: sectionId,
        preparation_status: 'ready_for_review',
        handoff_note: handoffNote,
      },
      { fields: ['id'] },
    ),
  );
  await client.request(
    createItems('article_references', [
      {
        article: article.id,
        sort: 1,
        organization: 'Cour des comptes',
        title: 'Rapport public annuel 2026',
        url: 'https://www.ccomptes.fr/',
        publication: 'Cour des comptes',
        published_on: '2026-03-12',
        material: material.id,
      },
      { article: article.id, sort: 2, organization: 'Insee', title: 'Note de conjoncture', url: 'https://www.insee.fr/', published_on: '2026-06-20' },
    ]),
  );
  await client.request(
    createItems('article_images', [
      {
        article: article.id,
        sort: 1,
        file: leadFileId,
        alt: 'Une assemblée de quartier',
        caption: 'Réunion publique',
        credit: 'Rédaction',
        source_note: imageSourceNote,
      },
      { article: article.id, sort: 2, file: bodyFileId, alt: 'Tableau des montants votés', caption: 'Les montants votés', credit: 'Rédaction' },
    ]),
  );
  await client.request(createItem('verification_points', { article: article.id, claim: verificationClaim }));
  return {
    id: article.id,
    title,
    slug,
    summary,
    privateTexts: [creationKey, handoffNote, materialTitle, imageSourceNote, verificationClaim],
  };
}

async function createDraftOnlyArticle(client: EditorClient, sectionId: string, suffix: string) {
  const title = `Brouillon confidentiel ${suffix}`;
  const slug = `brouillon-${suffix}`;
  const onlyWord = `motbrouillon${suffix}`;
  const draft = await client.request(
    createItem(
      'articles',
      { title, slug, creation_key: `e2e-brouillon-${suffix}`, section: sectionId, body: `Ce texte contient le mot inédit ${onlyWord}.` },
      { fields: ['id'] },
    ),
  );
  return { id: draft.id, title, slug, onlyWord };
}

async function publish(client: EditorClient, articleId: string): Promise<void> {
  const [flow] = await client.request(readFlows({ filter: { name: { _eq: 'Publier' } }, fields: ['id'], limit: 1 }));
  if (flow === undefined) {
    throw new Error('Flow « Publier » introuvable : lancez pnpm provision.');
  }
  const response = await fetch(`${e2eEnvironment.directusUrl}/flows/trigger/${flow.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e2eEnvironment.editorToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: 'articles', keys: [articleId] }),
  });
  if (!response.ok) {
    throw new Error(`Test publication refused (HTTP ${response.status}): ${await response.text()}`);
  }
}

async function featureAsLead(client: EditorClient, articleId: string): Promise<void> {
  const [publication] = await client.request(
    readItems('published_articles', { filter: { article: { _eq: articleId } }, fields: ['id'], limit: 1 }),
  );
  if (publication === undefined) {
    throw new Error('Published article not found after publication.');
  }
  const features = await client.request(readItems('home_features', { fields: ['id'], limit: -1 }));
  if (features.length > 0) {
    await client.request(deleteItems('home_features', features.map((feature) => feature.id)));
  }
  await client.request(createItem('home_features', { published_article: publication.id, placement: 'lead', sort: 1 }));
}
```

The setup goes through the editor account and the real "Publier" flow, so every end-to-end run also exercises the publication path. It overwrites the local site settings and home selection; run it against the local stack only.

`site/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';
import { e2eEnvironment } from './tests/e2e/support/environment.ts';

const siteAddress = new URL(e2eEnvironment.siteUrl);

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: 'list',
  use: {
    baseURL: e2eEnvironment.siteUrl,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: e2eEnvironment.siteUrl,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    env: {
      HOST: siteAddress.hostname,
      PORT: siteAddress.port,
      DIRECTUS_URL: e2eEnvironment.directusUrl,
      DIRECTUS_PUBLIC_URL: e2eEnvironment.directusPublicUrl,
      PUBLIC_MEDIA_DIR: e2eEnvironment.publicMediaDirectory,
    },
  },
});
```

The suite runs against the production build (`astro build` then the standalone server), with the same three variables as production.

- [ ] **Step 2: Write the failing home page tests**

`site/tests/e2e/home.spec.ts`:

```ts
import { expect, test } from './support/test.ts';

test('presents the media and its lead story', async ({ page, seed }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(seed.mediaName);
  await expect(page.getByRole('link', { name: seed.mediaName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: seed.articleTitle })).toBeVisible();
  await expect(page.getByText(seed.articleSummary).first()).toBeVisible();
});

test('lists sections, all articles and the about page in the navigation', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Rubriques' });

  await expect(navigation.getByRole('link', { name: 'À la une' })).toHaveAttribute('aria-current', 'page');
  await expect(navigation.getByRole('link', { name: 'Société' })).toHaveAttribute('href', '/rubriques/societe');
  await expect(navigation.getByRole('link', { name: 'Tous les articles' })).toHaveAttribute('href', '/recherche');
  await expect(navigation.getByRole('link', { name: 'À propos' })).toHaveAttribute('href', '/a-propos');
});

test('links recent articles to their page', async ({ page, seed }) => {
  await page.goto('/');
  const recent = page.getByRole('region', { name: 'Derniers articles' });

  await expect(recent.getByRole('link', { name: seed.articleTitle })).toHaveAttribute('href', `/articles/${seed.articleSlug}`);
});

test('answers 404 with a way back for an unknown address', async ({ page }) => {
  const response = await page.goto('/cette-page-n-existe-pas');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/');
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm --filter @my-media/site exec playwright install chromium && pnpm cms:up && pnpm test:e2e`
Expected: FAIL: `presents the media and its lead story` receives status 404 because no page exists yet (the seed itself succeeds).

- [ ] **Step 4: Write the styles from the accepted mockup**

`site/src/styles/global.css`:

```css
:root {
  --paper: #fcfbf8;
  --ink: #20201e;
  --muted: #666660;
  --line: #d7d6ce;
  --rule: #77776f;
  --accent: #7a3d32;
  --highlight: #f3eee6;
  --serif: Georgia, 'Times New Roman', serif;
  --sans: Arial, Helvetica, sans-serif;
  --shell: min(1180px, calc(100% - 80px));
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  background: var(--paper);
  color: var(--ink);
}

body {
  margin: 0;
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  overflow-wrap: break-word;
}

a {
  color: inherit;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

a:focus-visible,
button:focus-visible,
input:focus-visible,
main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 5px;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

.shell {
  width: var(--shell);
  margin-inline: auto;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  top: -48px;
  left: 16px;
  z-index: 10;
  padding: 8px 12px;
  color: var(--paper);
  background: var(--ink);
}

.skip-link:focus {
  top: 12px;
}

/* Header */

.utility-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  font-size: 12px;
  color: var(--muted);
}

.search-link {
  font-weight: 700;
  letter-spacing: 0.08em;
  text-decoration: none;
  text-transform: uppercase;
  color: var(--ink);
}

.masthead {
  padding: 18px 0 22px;
  text-align: center;
}

.wordmark {
  font-family: var(--serif);
  font-size: 74px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -4px;
  text-decoration: none;
}

.site-nav {
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}

.site-nav ul {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px 37px;
  margin: 0;
  padding: 13px 0;
  list-style: none;
  font-size: 13px;
  font-weight: 700;
}

.site-nav a {
  text-decoration: none;
}

.site-nav a[aria-current='page'] {
  color: var(--accent);
  text-decoration: underline;
}

/* Shared typography */

.kicker {
  margin: 0 0 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.dek {
  font-family: var(--serif);
  font-size: 19px;
  line-height: 1.55;
}

.byline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.readlink {
  display: inline-block;
  margin-top: 18px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}

figcaption {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

figcaption .credit {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Home */

.hero {
  display: grid;
  grid-template-columns: 0.94fr 1.22fr;
  gap: 48px;
  align-items: start;
  padding: 48px 0;
  border-bottom: 1px solid var(--line);
}

.lead-title {
  margin: 0;
  font-family: var(--serif);
  font-size: clamp(44px, 4.6vw, 66px);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -1.5px;
}

.lead-title a {
  text-decoration: none;
}

.lead-photo {
  margin: 0;
}

.lead-photo img {
  width: 100%;
  height: 415px;
  object-fit: cover;
}

.selection {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 34px 0;
  border-bottom: 1px solid var(--line);
}

.selection-item {
  padding: 0 28px;
  border-left: 1px solid var(--line);
}

.selection-item:first-of-type {
  padding-left: 0;
  border-left: 0;
}

.selection-item h3 {
  margin: 0 0 10px;
  font-family: var(--serif);
  font-size: 25px;
  line-height: 1.15;
}

.selection-item h3 a {
  text-decoration: none;
}

.selection-item p {
  margin: 0 0 12px;
  font-family: var(--serif);
  color: var(--muted);
}

.recent {
  padding: 38px 0;
}

.recent h2,
.page-title {
  margin: 0 0 22px;
  font-family: var(--serif);
  font-size: 28px;
}

.recent-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.recent-list li {
  display: grid;
  grid-template-columns: 145px 1fr 100px;
  gap: 20px;
  align-items: baseline;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.recent-list time {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.recent-list a {
  font-family: var(--serif);
  font-size: 21px;
  text-decoration: none;
}

.recent-section {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-align: right;
  text-transform: uppercase;
  color: var(--accent);
}

.about-strip {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 32px;
  align-items: center;
  margin-bottom: 48px;
  padding: 32px 0;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--ink);
}

.about-strip p {
  max-width: 720px;
  margin: 0;
  font-family: var(--serif);
  font-size: 20px;
  line-height: 1.5;
}

/* Article */

.article-header {
  max-width: 860px;
  padding: 56px 0 32px;
  text-align: center;
}

.article-header h1 {
  margin: 0;
  font-family: var(--serif);
  font-size: clamp(42px, 5vw, 68px);
  line-height: 1.03;
  letter-spacing: -1.5px;
}

.article-header .dek {
  max-width: 720px;
  margin: 22px auto 0;
  font-size: 21px;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  color: var(--muted);
}

.byline-name {
  font-weight: 700;
  color: var(--ink);
}

.sources-shortcut {
  font-weight: 700;
  color: var(--accent);
}

.lead-figure {
  margin: 0 0 44px;
}

.lead-figure img {
  width: 100%;
  height: 435px;
  object-fit: cover;
}

.reading-layout {
  display: grid;
  grid-template-columns: 160px minmax(0, 660px) 1fr;
  gap: 40px;
  padding-bottom: 56px;
}

.reading-aside {
  padding-top: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}

.reading-aside a {
  text-decoration: none;
}

.reading-body {
  font-family: var(--serif);
  font-size: 20px;
  line-height: 1.8;
}

.reading-body > p:first-of-type::first-letter {
  float: left;
  margin: 8px 10px 0 0;
  font-size: 72px;
  font-weight: 700;
  line-height: 0.8;
  color: var(--accent);
}

.reading-body h2 {
  margin: 44px 0 12px;
  font-size: 28px;
  line-height: 1.2;
}

.reading-body blockquote {
  margin: 32px 0;
  padding-left: 24px;
  border-left: 3px solid var(--accent);
  font-style: italic;
}

.reference {
  margin-left: 2px;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  line-height: 0;
  vertical-align: super;
  text-decoration: none;
  color: var(--accent);
}

.body-figure {
  margin: 36px 0;
}

.sources {
  max-width: 860px;
  padding: 40px 0 64px;
  border-top: 1px solid var(--ink);
}

.sources h2 {
  margin: 0 0 24px;
  font-family: var(--serif);
  font-size: 28px;
}

.source-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.source-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  scroll-margin-top: 24px;
}

.source-item:target {
  background: var(--highlight);
}

.source-number {
  font-family: var(--serif);
  font-size: 17px;
  font-style: italic;
  color: var(--accent);
}

.source-item strong {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.source-item a,
.source-title {
  display: block;
  margin: 4px 0;
  font-family: var(--serif);
  font-size: 17px;
}

.source-item small {
  display: block;
  font-size: 11px;
  color: var(--muted);
}

.source-note {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--muted);
}

/* Other pages */

.page {
  max-width: 860px;
  padding: 48px 0 32px;
}

.page h1 {
  margin: 0 0 24px;
  font-family: var(--serif);
  font-size: clamp(36px, 4vw, 52px);
  letter-spacing: -1px;
}

.page h2 {
  margin: 40px 0 12px;
  font-family: var(--serif);
  font-size: 26px;
}

.page-header {
  padding: 48px 0 8px;
}

.prose {
  font-family: var(--serif);
  font-size: 19px;
  line-height: 1.7;
}

.search-form {
  display: flex;
  gap: 12px;
}

.search-form input {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  font: inherit;
  font-size: 17px;
  color: var(--ink);
  background: #fff;
  border: 1px solid var(--rule);
}

.search-form button {
  padding: 12px 20px;
  font: inherit;
  font-weight: 700;
  color: var(--paper);
  background: var(--ink);
  border: 0;
  cursor: pointer;
}

.empty-state {
  padding: 32px 0 48px;
  font-family: var(--serif);
  font-size: 20px;
  color: var(--muted);
}

.preview-banner {
  margin: 0;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  color: var(--paper);
  background: var(--accent);
}

/* Footer */

.site-footer {
  padding: 28px 0 48px;
  font-size: 13px;
  color: var(--muted);
  border-top: 1px solid var(--ink);
}

.site-footer .shell {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.site-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.footer-name {
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

@media (max-width: 800px) {
  :root {
    --shell: calc(100% - 40px);
  }

  .wordmark {
    font-size: 48px;
    letter-spacing: -2px;
  }

  .edition-label {
    display: none;
  }

  .site-nav ul {
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 24px;
    overflow-x: auto;
    white-space: nowrap;
  }

  .hero {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 32px 0;
  }

  .hero .lead-photo {
    order: -1;
  }

  .lead-photo img,
  .lead-figure img {
    height: 260px;
  }

  .selection {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .selection-item,
  .selection-item:first-of-type {
    padding: 0 0 24px;
    border-bottom: 1px solid var(--line);
    border-left: 0;
  }

  .recent-list li {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .recent-section {
    text-align: left;
  }

  .about-strip {
    grid-template-columns: 1fr;
  }

  .reading-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .reading-body {
    font-size: 18px;
  }
}

@media (max-width: 420px) {
  :root {
    --shell: calc(100% - 32px);
  }

  .wordmark {
    font-size: 40px;
  }

  .article-header {
    padding-top: 36px;
    text-align: left;
  }

  .article-meta {
    justify-content: flex-start;
  }

  .search-form {
    flex-direction: column;
  }
}
```

Values (palette, 74 px wordmark, `.94fr 1.22fr` hero, `145px 1fr 100px` list, `160px minmax(0, 660px) 1fr` reading grid, 20 px / 1.8 serif body, drop cap, 800 px and 420 px breakpoints, 2 px accent focus ring) come from the accepted mockup "proposition 2".

- [ ] **Step 5: Write the layout and shared components**

`site/src/layouts/BaseLayout.astro`:

```astro
---
import SiteFooter from '../components/SiteFooter.astro';
import SiteHeader from '../components/SiteHeader.astro';
import { publicQueries } from '../lib/cms.ts';
import { composeDocumentTitle } from '../lib/mapping.ts';
import '../styles/global.css';

type Props = {
  title: string | null;
  description?: string | null;
  noindex?: boolean;
};

const { title, description = null, noindex = false } = Astro.props;
const frame = await publicQueries.siteFrame();
const documentTitle = composeDocumentTitle(title, frame.identity.mediaName);
---

<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{documentTitle}</title>
    {description && <meta name="description" content={description} />}
    {noindex && <meta name="robots" content="noindex, nofollow" />}
  </head>
  <body>
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <SiteHeader identity={frame.identity} sections={frame.sections} />
    <main id="contenu" tabindex="-1">
      <slot />
    </main>
    <SiteFooter identity={frame.identity} />
  </body>
</html>
```

`site/src/components/SiteHeader.astro`:

```astro
---
import { formatEditionDate } from '../lib/dates.ts';
import type { SectionLink, SiteIdentity } from '../lib/view-models.ts';

type Props = { identity: SiteIdentity; sections: SectionLink[] };

const { identity, sections } = Astro.props;
const currentPath = Astro.url.pathname;
const navigation: SectionLink[] = [
  { name: 'À la une', href: '/' },
  ...sections,
  { name: 'Tous les articles', href: '/recherche' },
  { name: 'À propos', href: '/a-propos' },
];
---

<header class="site-header">
  <div class="shell utility-bar">
    <span class="edition-label">{identity.editionLabel}</span>
    <span>{formatEditionDate(new Date())}</span>
    <a class="search-link" href="/recherche">Rechercher</a>
  </div>
  <div class="shell masthead">
    <a class="wordmark" href="/">{identity.mediaName}</a>
  </div>
  <nav class="site-nav" aria-label="Rubriques">
    <ul class="shell">
      {
        navigation.map((item) => (
          <li>
            <a href={item.href} aria-current={item.href === currentPath ? 'page' : undefined}>
              {item.name}
            </a>
          </li>
        ))
      }
    </ul>
  </nav>
</header>
```

`site/src/components/SiteFooter.astro`:

```astro
---
import type { SiteIdentity } from '../lib/view-models.ts';

type Props = { identity: SiteIdentity };

const { identity } = Astro.props;
const year = new Date().getFullYear();
---

<footer class="site-footer">
  <div class="shell">
    <p class="footer-name">{identity.mediaName}</p>
    <nav aria-label="Informations">
      <a href="/a-propos">À propos</a>
      <a href="/a-propos#mentions-legales">Mentions légales</a>
      {identity.contactEmail && <a href={`mailto:${identity.contactEmail}`}>Contact</a>}
    </nav>
    <p>© {year} {identity.mediaName}</p>
  </div>
</footer>
```

`site/src/components/NotFound.astro`:

```astro
<section class="shell page">
  <h1>Page introuvable</h1>
  <p class="prose">Cette page n’existe pas ou n’est plus en ligne.</p>
  <p><a class="readlink" href="/">Retour à l’accueil</a></p>
</section>
```

`site/src/components/LeadStory.astro`:

```astro
---
import { formatLongDate, toDateTimeAttribute } from '../lib/dates.ts';
import { renderFigure } from '../lib/figure.ts';
import type { ArticleCard } from '../lib/view-models.ts';

type Props = { article: ArticleCard };

const { article } = Astro.props;
---

<section class="shell hero" aria-labelledby="titre-une">
  <div>
    {article.kicker && <p class="kicker">{article.kicker}</p>}
    <h2 id="titre-une" class="lead-title"><a href={article.href}>{article.title}</a></h2>
    {article.summary && <p class="dek">{article.summary}</p>}
    <p class="byline">
      {article.byline && <span>{article.byline}</span>}
      <time datetime={toDateTimeAttribute(article.publishedAt)}>{formatLongDate(article.publishedAt)}</time>
    </p>
    <a class="readlink" href={article.href} aria-label={`Lire l’article : ${article.title}`}>Lire l’article</a>
  </div>
  {article.image && <Fragment set:html={renderFigure(article.image, { className: 'lead-photo', loading: 'eager' })} />}
</section>
```

`site/src/components/SelectionStories.astro`:

```astro
---
import { formatLongDate, toDateTimeAttribute } from '../lib/dates.ts';
import type { ArticleCard } from '../lib/view-models.ts';

type Props = { articles: ArticleCard[] };

const { articles } = Astro.props;
---

<section class="shell selection" aria-labelledby="titre-selection">
  <h2 id="titre-selection" class="visually-hidden">Sélection de la rédaction</h2>
  {
    articles.map((article) => (
      <article class="selection-item">
        {article.kicker && <p class="kicker">{article.kicker}</p>}
        <h3>
          <a href={article.href}>{article.title}</a>
        </h3>
        {article.summary && <p>{article.summary}</p>}
        <p class="byline">
          {article.byline && <span>{article.byline}</span>}
          <time datetime={toDateTimeAttribute(article.publishedAt)}>{formatLongDate(article.publishedAt)}</time>
        </p>
      </article>
    ))
  }
</section>
```

`site/src/components/RecentList.astro`:

```astro
---
import { formatShortDate, toDateTimeAttribute } from '../lib/dates.ts';
import type { ArticleCard } from '../lib/view-models.ts';

type Props = { title: string; articles: ArticleCard[]; hideTitle?: boolean };

const { title, articles, hideTitle = false } = Astro.props;
---

<section class="shell recent" aria-labelledby="titre-liste">
  <h2 id="titre-liste" class:list={[{ 'visually-hidden': hideTitle }]}>{title}</h2>
  <ol class="recent-list">
    {
      articles.map((article) => (
        <li>
          <time datetime={toDateTimeAttribute(article.publishedAt)}>{formatShortDate(article.publishedAt)}</time>
          <a href={article.href}>{article.title}</a>
          <span class="recent-section">{article.section?.name}</span>
        </li>
      ))
    }
  </ol>
</section>
```

`site/src/components/AboutStrip.astro`:

```astro
---
import type { SiteIdentity } from '../lib/view-models.ts';

type Props = { identity: SiteIdentity };

const { identity } = Astro.props;
---

{
  identity.presentation && (
    <section class="shell about-strip" aria-label="À propos du média">
      <p>{identity.presentation}</p>
      <a class="readlink" href="/a-propos">
        Découvrir le média
      </a>
    </section>
  )
}
```

- [ ] **Step 6: Write the home and error pages**

`site/src/pages/index.astro`:

```astro
---
import AboutStrip from '../components/AboutStrip.astro';
import LeadStory from '../components/LeadStory.astro';
import RecentList from '../components/RecentList.astro';
import SelectionStories from '../components/SelectionStories.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
import { publicQueries } from '../lib/cms.ts';

const [home, frame] = await Promise.all([publicQueries.homePage(), publicQueries.siteFrame()]);
---

<BaseLayout title={null} description={frame.identity.presentation}>
  <h1 class="visually-hidden">{frame.identity.mediaName} — À la une</h1>
  {home.lead === null && <p class="shell empty-state">Aucun article publié pour le moment.</p>}
  {home.lead !== null && <LeadStory article={home.lead} />}
  {home.selection.length > 0 && <SelectionStories articles={home.selection} />}
  {home.recent.length > 0 && <RecentList title="Derniers articles" articles={home.recent} />}
  <AboutStrip identity={frame.identity} />
</BaseLayout>
```

`site/src/pages/404.astro`:

```astro
---
import NotFound from '../components/NotFound.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Page introuvable">
  <NotFound />
</BaseLayout>
```

`site/src/pages/500.astro`:

```astro
---
import '../styles/global.css';
---

<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Site momentanément indisponible</title>
  </head>
  <body>
    <main class="shell page">
      <h1>Le site est momentanément indisponible</h1>
      <p class="prose">Réessayez dans quelques minutes.</p>
    </main>
  </body>
</html>
```

The 500 page does not use `BaseLayout`, because the most likely cause of an error is the CMS being unreachable and the layout reads from it.

- [ ] **Step 7: Run the tests to see them pass**

Run: `pnpm test:e2e && pnpm --filter @my-media/site typecheck`
Expected: PASS, 4 tests; 0 type errors.

- [ ] **Step 8: Commit**

```bash
git add site
git diff --cached --check
git commit -m "feat(site): add the editorial layout and home page"
```

---

### Task 5: Article page and published images

**Files:**
- Create: `site/src/lib/media.ts`, `site/src/pages/media/[name].ts`
- Create: `site/src/components/ArticleView.astro`, `site/src/components/SourcesList.astro`, `site/src/pages/articles/[slug].astro`
- Test: `site/src/lib/media.test.ts`, `site/tests/e2e/article.spec.ts`

**Interfaces:**
- Consumes: `publicQueries.article`, `renderArticleBody`, `renderFigure`, `wasUpdated`; files written by the publish operation (plan 1) into `PUBLIC_MEDIA_DIR` as `<uuid>.webp`.
- Produces: `isPublicFileName(name: string): boolean`, `publicFilePath(directory: string, name: string): string | null`; `ArticleView` component props `{ article: ArticleView }` (reused by the preview in Task 7); route `/articles/[slug]`; route `/media/[name]`.

- [ ] **Step 1: Write the failing media name test**

`site/src/lib/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { publicFilePath } from './media.ts';

const PUBLISHED_NAME = '3f2b8c1e-5a4d-4b7e-9c21-8d6f0a1b2c3d.webp';

describe('publicFilePath', () => {
  it('resolves a published file name inside the media directory', () => {
    expect(publicFilePath('/srv/public-media', PUBLISHED_NAME)).toBe(`/srv/public-media/${PUBLISHED_NAME}`);
  });

  it.each(['../secret.webp', '../../etc/passwd', 'photo.png', PUBLISHED_NAME.toUpperCase(), `dossier/${PUBLISHED_NAME}`, ''])(
    'refuses %s',
    (name) => {
      expect(publicFilePath('/srv/public-media', name)).toBeNull();
    },
  );
});
```

- [ ] **Step 2: Write the failing article tests**

`site/tests/e2e/article.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { expect, test } from './support/test.ts';

test('shows title, summary, byline, date and sources', async ({ page, seed }) => {
  const response = await page.goto(`/articles/${seed.articleSlug}`);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(`${seed.articleTitle} — ${seed.mediaName}`);
  await expect(page.getByRole('heading', { level: 1, name: seed.articleTitle })).toBeVisible();
  await expect(page.getByText(seed.articleSummary)).toBeVisible();
  await expect(page.getByText('Camille Durand', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Publié le/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Sources et documents' })).toBeVisible();
  await expect(page.locator('#sources li')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Rapport public annuel 2026' })).toHaveAttribute('href', 'https://www.ccomptes.fr/');
  await expect(page.locator('#source-1')).toContainText('Cour des comptes · 12 mars 2026');
});

test('jumps from a source call to its source', async ({ page, seed }) => {
  await page.goto(`/articles/${seed.articleSlug}`);

  await page.getByRole('link', { name: 'Source 1', exact: true }).click();

  await expect(page).toHaveURL(/#source-1$/);
  await expect(page.locator('#source-1')).toContainText('Rapport public annuel 2026');
});

test('serves the lead and body images from the site', async ({ page, seed }) => {
  await page.goto(`/articles/${seed.articleSlug}`);
  const leadImage = page.getByRole('img', { name: 'Une assemblée de quartier' });
  const bodyImage = page.getByRole('img', { name: seed.bodyImageAlt });

  await expect(leadImage).toHaveAttribute('src', /^\/media\/[0-9a-f-]{36}\.webp$/);
  await bodyImage.scrollIntoViewIfNeeded();
  for (const image of [leadImage, bodyImage]) {
    await expect.poll(() => image.evaluate((element) => element instanceof HTMLImageElement && element.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('figure.body-figure figcaption')).toContainText('Les montants votés');
});

test('never shows private editorial data', async ({ page, seed }) => {
  await page.goto(`/articles/${seed.articleSlug}`);
  const html = await page.content();

  for (const privateText of seed.privateTexts) {
    expect(html).not.toContain(privateText);
  }
});

test('answers 404 for a draft or unknown slug', async ({ page, seed }) => {
  const response = await page.goto(`/articles/${seed.draftSlug}`);

  expect(response?.status()).toBe(404);
  await expect(page.getByText(seed.draftTitle)).toHaveCount(0);
});

test('serves only published media file names', async ({ request }) => {
  for (const path of ['/media/inconnu.webp', '/media/..%2F..%2Fpackage.json', `/media/${randomUUID()}.webp`]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm --filter @my-media/site test && pnpm test:e2e`
Expected: FAIL: `Failed to load url ./media.ts`; the article tests receive 404 for the published slug.

- [ ] **Step 4: Implement the media route**

`site/src/lib/media.ts`:

```ts
import { join } from 'node:path';

const PUBLIC_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isPublicFileName(name: string): boolean {
  return PUBLIC_FILE_NAME.test(name);
}

export function publicFilePath(directory: string, name: string): string | null {
  if (!isPublicFileName(name)) {
    return null;
  }
  return join(directory, name);
}
```

The name pattern is the one the publish operation generates (`randomUUID()` + `.webp`), so nothing else in the directory, and nothing outside it, can be requested.

`site/src/pages/media/[name].ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { APIRoute } from 'astro';
import { PUBLIC_MEDIA_DIR } from 'astro:env/server';
import { publicFilePath } from '../../lib/media.ts';

export const GET: APIRoute = async ({ params }) => {
  const path = publicFilePath(PUBLIC_MEDIA_DIR, params.name ?? '');
  if (path === null) {
    return notFound();
  }
  const content = await readOptionalFile(path);
  if (content === null) {
    return notFound();
  }
  return new Response(new Uint8Array(content), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

async function readOptionalFile(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function notFound(): Response {
  return new Response('Introuvable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

Published file names never change content (a republish writes new names), so they can be cached for a year.

- [ ] **Step 5: Implement the article view and page**

`site/src/components/SourcesList.astro`:

```astro
---
import type { ArticleSource } from '../lib/view-models.ts';

type Props = { sources: ArticleSource[] };

const { sources } = Astro.props;
---

<section id="sources" class="shell sources" aria-labelledby="titre-sources">
  <h2 id="titre-sources">Sources et documents</h2>
  <ol class="source-list">
    {
      sources.map((source) => (
        <li id={source.anchor} class="source-item">
          <span class="source-number" aria-hidden="true">
            {source.number}
          </span>
          <div>
            {source.organization && <strong>{source.organization}</strong>}
            {source.url !== null && (
              <a href={source.url} rel="noopener noreferrer">
                {source.title}
              </a>
            )}
            {source.url === null && <span class="source-title">{source.title}</span>}
            {source.details && <small>{source.details}</small>}
            {source.note && <p class="source-note">{source.note}</p>}
          </div>
        </li>
      ))
    }
  </ol>
</section>
```

`site/src/components/ArticleView.astro`:

```astro
---
import { renderArticleBody } from '../lib/article-body.ts';
import { formatLongDate, toDateTimeAttribute } from '../lib/dates.ts';
import { renderFigure } from '../lib/figure.ts';
import { wasUpdated } from '../lib/mapping.ts';
import type { ArticleView } from '../lib/view-models.ts';
import SourcesList from './SourcesList.astro';

type Props = { article: ArticleView };

const { article } = Astro.props;
const [leadImage] = article.images;
const bodyHtml = renderArticleBody(article.body, { sourceCount: article.sources.length, images: article.images });
const showUpdate = wasUpdated(article);
---

<article>
  <header class="shell article-header">
    {article.kicker && <p class="kicker">{article.kicker}</p>}
    <h1>{article.title}</h1>
    {article.summary && <p class="dek">{article.summary}</p>}
    <div class="article-meta">
      {article.byline && <span class="byline-name">{article.byline}</span>}
      {
        article.firstPublishedAt && (
          <span>
            Publié le <time datetime={toDateTimeAttribute(article.firstPublishedAt)}>{formatLongDate(article.firstPublishedAt)}</time>
          </span>
        )
      }
      {
        showUpdate && article.lastPublishedAt && (
          <span>
            Mis à jour le <time datetime={toDateTimeAttribute(article.lastPublishedAt)}>{formatLongDate(article.lastPublishedAt)}</time>
          </span>
        )
      }
      {
        article.sources.length > 0 && (
          <a class="sources-shortcut" href="#sources">
            Sources et documents ({article.sources.length})
          </a>
        )
      }
    </div>
  </header>
  {
    leadImage && (
      <div class="shell">
        <Fragment set:html={renderFigure(leadImage, { className: 'lead-figure', loading: 'eager' })} />
      </div>
    )
  }
  <div class="shell reading-layout">
    <aside class="reading-aside" aria-label="Rubrique">
      {article.section && <a href={article.section.href}>{article.section.name}</a>}
    </aside>
    <div class="reading-body">
      <Fragment set:html={bodyHtml} />
    </div>
  </div>
  {article.sources.length > 0 && <SourcesList sources={article.sources} />}
</article>
```

`site/src/pages/articles/[slug].astro`:

```astro
---
import ArticleView from '../../components/ArticleView.astro';
import NotFound from '../../components/NotFound.astro';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { publicQueries } from '../../lib/cms.ts';

const article = await publicQueries.article(Astro.params.slug ?? '');
if (article === null) {
  Astro.response.status = 404;
}
---

<BaseLayout title={article?.title ?? 'Page introuvable'} description={article?.summary ?? null}>
  {article === null && <NotFound />}
  {article !== null && <ArticleView article={article} />}
</BaseLayout>
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm --filter @my-media/site test && pnpm test:e2e && pnpm --filter @my-media/site typecheck`
Expected: PASS (unit tests and 10 end-to-end tests); 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add site
git diff --cached --check
git commit -m "feat(site): show published articles with their sources and images"
```

---

### Task 6: Sections, search and about pages

**Files:**
- Create: `site/src/lib/search-copy.ts`, `site/src/pages/rubriques/[slug].astro`, `site/src/pages/recherche.astro`, `site/src/pages/a-propos.astro`
- Test: `site/src/lib/search-copy.test.ts`, `site/tests/e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `publicQueries.sectionPage`, `publicQueries.searchOrList`, `publicQueries.siteFrame`, `renderMarkdown`, `RecentList`, `NotFound`.
- Produces: `searchResultsTitle(query: string): string`, `emptySearchMessage(query: string): string`; routes `/rubriques/[slug]`, `/recherche?q=`, `/a-propos` (anchor `#mentions-legales`).

- [ ] **Step 1: Write the failing tests**

`site/src/lib/search-copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptySearchMessage, searchResultsTitle } from './search-copy.ts';

describe('search copy', () => {
  it('titles the full list when nothing is searched', () => {
    expect(searchResultsTitle('')).toBe('Tous les articles');
    expect(emptySearchMessage('')).toBe('Aucun article publié pour le moment.');
  });

  it('quotes the searched words', () => {
    expect(searchResultsTitle('budget')).toBe('Résultats pour « budget »');
    expect(emptySearchMessage('budget')).toBe('Aucun article publié ne correspond à « budget ».');
  });
});
```

`site/tests/e2e/navigation.spec.ts`:

```ts
import { expect, test } from './support/test.ts';

test('a section page lists its published articles', async ({ page, seed }) => {
  const response = await page.goto(`/rubriques/${seed.sectionSlug}`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: seed.sectionName })).toBeVisible();
  await expect(page.getByRole('link', { name: seed.articleTitle })).toHaveAttribute('href', `/articles/${seed.articleSlug}`);
  await expect(page.getByRole('navigation', { name: 'Rubriques' }).getByRole('link', { name: seed.sectionName })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('an unknown section answers 404', async ({ page }) => {
  const response = await page.goto('/rubriques/rubrique-inconnue');

  expect(response?.status()).toBe(404);
});

test('search finds a published article and ignores drafts', async ({ page, seed }) => {
  await page.goto('/recherche');

  await page.getByRole('searchbox', { name: 'Rechercher dans les articles publiés' }).fill(seed.suffix);
  await page.getByRole('button', { name: 'Rechercher' }).click();

  await expect(page).toHaveURL(new RegExp(`/recherche\\?q=${seed.suffix}$`));
  await expect(page.getByRole('heading', { level: 2, name: `Résultats pour « ${seed.suffix} »` })).toBeVisible();
  await expect(page.getByRole('link', { name: seed.articleTitle })).toBeVisible();
  await expect(page.getByText(seed.draftTitle)).toHaveCount(0);
});

test('a word that exists only in a draft finds nothing', async ({ page, seed }) => {
  await page.goto(`/recherche?q=${seed.draftOnlyWord}`);

  await expect(page.getByText(`Aucun article publié ne correspond à « ${seed.draftOnlyWord} ».`)).toBeVisible();
});

test('an empty search lists all published articles', async ({ page, seed }) => {
  await page.goto('/recherche');

  await expect(page.getByRole('heading', { level: 2, name: 'Tous les articles' })).toBeVisible();
  await expect(page.getByRole('link', { name: seed.articleTitle })).toBeVisible();
});

test('the about page presents the media, its contact and the legal notice', async ({ page }) => {
  await page.goto('/a-propos');

  await expect(page.getByRole('heading', { level: 1, name: 'À propos' })).toBeVisible();
  await expect(page.getByText('Un média indépendant d’essai, sourcé et lisible.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'contact@example.com' })).toHaveAttribute('href', 'mailto:contact@example.com');
  await expect(page.locator('#mentions-legales')).toContainText('Directeur de la publication');
});

test('the footer leads to the legal notice', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('contentinfo').getByRole('link', { name: 'Mentions légales' }).click();

  await expect(page).toHaveURL(/\/a-propos#mentions-legales$/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @my-media/site test && pnpm test:e2e`
Expected: FAIL: `Failed to load url ./search-copy.ts`; the section, search and about tests receive 404.

- [ ] **Step 3: Implement the copy helpers and the three pages**

`site/src/lib/search-copy.ts`:

```ts
export function searchResultsTitle(query: string): string {
  if (query === '') {
    return 'Tous les articles';
  }
  return `Résultats pour « ${query} »`;
}

export function emptySearchMessage(query: string): string {
  if (query === '') {
    return 'Aucun article publié pour le moment.';
  }
  return `Aucun article publié ne correspond à « ${query} ».`;
}
```

`site/src/pages/rubriques/[slug].astro`:

```astro
---
import NotFound from '../../components/NotFound.astro';
import RecentList from '../../components/RecentList.astro';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { publicQueries } from '../../lib/cms.ts';

const section = await publicQueries.sectionPage(Astro.params.slug ?? '');
if (section === null) {
  Astro.response.status = 404;
}
---

<BaseLayout title={section?.name ?? 'Page introuvable'} description={section?.description ?? null}>
  {section === null && <NotFound />}
  {
    section !== null && (
      <>
        <header class="shell page-header">
          <h1 class="page-title">{section.name}</h1>
          {section.description && <p class="dek">{section.description}</p>}
        </header>
        {section.articles.length === 0 && <p class="shell empty-state">Aucun article publié dans cette rubrique pour le moment.</p>}
        {section.articles.length > 0 && <RecentList title={`Articles de la rubrique ${section.name}`} articles={section.articles} hideTitle />}
      </>
    )
  }
</BaseLayout>
```

`site/src/pages/recherche.astro`:

```astro
---
import RecentList from '../components/RecentList.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
import { publicQueries } from '../lib/cms.ts';
import { emptySearchMessage, searchResultsTitle } from '../lib/search-copy.ts';

const query = (Astro.url.searchParams.get('q') ?? '').trim();
const results = await publicQueries.searchOrList(query);
---

<BaseLayout title="Rechercher" noindex={query !== ''}>
  <section class="shell page">
    <h1>Rechercher</h1>
    <form class="search-form" role="search" action="/recherche" method="get">
      <label class="visually-hidden" for="recherche-texte">Rechercher dans les articles publiés</label>
      <input id="recherche-texte" type="search" name="q" value={query} maxlength="200" />
      <button type="submit">Rechercher</button>
    </form>
  </section>
  {results.length === 0 && <p class="shell empty-state">{emptySearchMessage(query)}</p>}
  {results.length > 0 && <RecentList title={searchResultsTitle(query)} articles={results} />}
</BaseLayout>
```

`site/src/pages/a-propos.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { renderMarkdown } from '../lib/article-body.ts';
import { publicQueries } from '../lib/cms.ts';

const { identity } = await publicQueries.siteFrame();
---

<BaseLayout title="À propos" description={identity.presentation}>
  <article class="shell page">
    <h1>À propos</h1>
    {identity.presentation && <p class="dek">{identity.presentation}</p>}
    {
      identity.aboutBody && (
        <div class="prose">
          <Fragment set:html={renderMarkdown(identity.aboutBody)} />
        </div>
      )
    }
    {
      identity.contactEmail && (
        <section aria-labelledby="titre-contact">
          <h2 id="titre-contact">Contact</h2>
          <p class="prose">
            <a href={`mailto:${identity.contactEmail}`}>{identity.contactEmail}</a>
          </p>
        </section>
      )
    }
    <section id="mentions-legales" aria-labelledby="titre-mentions">
      <h2 id="titre-mentions">Mentions légales</h2>
      {
        identity.legalNotice && (
          <div class="prose">
            <Fragment set:html={renderMarkdown(identity.legalNotice)} />
          </div>
        )
      }
    </section>
  </article>
</BaseLayout>
```

Search result pages are `noindex` so search engines do not index arbitrary queries.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm --filter @my-media/site test && pnpm test:e2e && pnpm --filter @my-media/site typecheck`
Expected: PASS (unit tests and 17 end-to-end tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add site
git diff --cached --check
git commit -m "feat(site): add section, search and about pages"
```

---

### Task 7: Authenticated draft preview

**Files:**
- Create: `site/src/pages/apercu/[id].astro`, `site/tests/e2e/support/directus-session.ts`
- Modify: `compose.yaml` (Directus content security policy for the Studio live preview)
- Test: `site/tests/e2e/preview.spec.ts`

**Interfaces:**
- Consumes: `readDraftPreview`, `SESSION_COOKIE_NAME`, `cmsConnection`, `directusPublicUrl`, `ArticleView` component; the `preview_url` `{SITE_URL}/apercu/{{id}}` set on `articles` by plan 1.
- Produces: route `/apercu/[id]` (404 without a valid session; a rendered draft carries `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`); `signInToDirectus(request: APIRequestContext): Promise<string>`.

- [ ] **Step 1: Write the failing tests**

`site/tests/e2e/support/directus-session.ts`:

```ts
import type { APIRequestContext } from '@playwright/test';
import { e2eEnvironment } from './environment.ts';

const SESSION_COOKIE = /^directus_session_token=([^;]+)/;

export async function signInToDirectus(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${e2eEnvironment.directusUrl}/auth/login`, {
    data: { email: e2eEnvironment.editorEmail, password: e2eEnvironment.editorPassword, mode: 'session' },
  });
  if (!response.ok()) {
    throw new Error(`Connexion à Directus refusée (HTTP ${response.status()}).`);
  }
  const token = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => SESSION_COOKIE.exec(header.value)?.[1])
    .find((value) => value !== undefined);
  if (token === undefined) {
    throw new Error('Directus n’a pas renvoyé de cookie de session.');
  }
  return token;
}
```

`site/tests/e2e/preview.spec.ts`:

```ts
import { e2eEnvironment } from './support/environment.ts';
import { signInToDirectus } from './support/directus-session.ts';
import { expect, test } from './support/test.ts';

test('an anonymous visitor cannot preview a draft', async ({ page, seed }) => {
  const response = await page.goto(`/apercu/${seed.draftId}`);

  expect(response?.status()).toBe(404);
  await expect(page.getByText(seed.draftTitle)).toHaveCount(0);
});

test('an editor signed in to Directus previews the draft, unindexed and uncached', async ({ page, context, request, seed }) => {
  const sessionToken = await signInToDirectus(request);
  await context.addCookies([{ name: 'directus_session_token', value: sessionToken, url: e2eEnvironment.siteUrl }]);

  const response = await page.goto(`/apercu/${seed.draftId}`);

  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toBe('private, no-store');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.getByRole('status')).toHaveText('Aperçu du brouillon — non publié');
  await expect(page.getByRole('heading', { level: 1, name: seed.draftTitle })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('a malformed preview address answers 404 even when signed in', async ({ page, context, request }) => {
  const sessionToken = await signInToDirectus(request);
  await context.addCookies([{ name: 'directus_session_token', value: sessionToken, url: e2eEnvironment.siteUrl }]);

  const response = await page.goto('/apercu/pas-un-identifiant');

  expect(response?.status()).toBe(404);
});
```

The session cookie is set explicitly on the site address so the test does not depend on how the browser shares cookies between the two local ports.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:e2e`
Expected: FAIL: `an editor signed in to Directus previews the draft` receives 404 because the route does not exist. The two 404 tests already pass at this point; they guard the behaviour once the route exists.

- [ ] **Step 3: Implement the preview route**

`site/src/pages/apercu/[id].astro`:

```astro
---
import ArticleView from '../../components/ArticleView.astro';
import NotFound from '../../components/NotFound.astro';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { cmsConnection, directusPublicUrl } from '../../lib/cms.ts';
import { readDraftPreview, SESSION_COOKIE_NAME } from '../../lib/queries.ts';

Astro.response.headers.set('Cache-Control', 'private, no-store');
Astro.response.headers.set('X-Robots-Tag', 'noindex, nofollow');

const draft = await readDraftPreview(cmsConnection, {
  articleId: Astro.params.id ?? '',
  sessionToken: Astro.cookies.get(SESSION_COOKIE_NAME)?.value ?? null,
  directusPublicUrl,
});
if (draft === null) {
  Astro.response.status = 404;
}
---

<BaseLayout title={draft?.title ?? 'Page introuvable'} noindex>
  {draft === null && <NotFound />}
  {
    draft !== null && (
      <>
        <p class="preview-banner" role="status">
          Aperçu du brouillon — non publié
        </p>
        <ArticleView article={draft} />
      </>
    )
  }
</BaseLayout>
```

The site holds no Directus token: it forwards the visitor's own session cookie, so Directus applies that person's permissions. The anonymous role cannot read `articles` (plan 1), so without a session the request is refused and the page answers 404, which reveals nothing about whether the draft exists. Draft images load from `DIRECTUS_PUBLIC_URL/assets/…` with the same browser session.

- [ ] **Step 4: Allow the Studio live preview to frame the site**

In `compose.yaml`, add to the `directus` service `environment`:

```yaml
      CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC: "'self',${SITE_URL}"
```

Then run `pnpm cms:up`. The Studio's split-screen preview loads `preview_url` in a frame; without this directive the Directus content security policy blocks it. The "open preview" button (new tab) works either way.

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test:e2e && pnpm --filter @my-media/site typecheck`
Expected: PASS, 20 end-to-end tests; 0 type errors.

- [ ] **Step 6: Check the preview from the Studio**

1. `pnpm dev:site` in one terminal; open `http://localhost:8055/admin`, sign in as the editor (`EDITOR_EMAIL`).
2. Open any draft article and open the live preview panel: the draft renders with the "Aperçu du brouillon — non publié" banner.
3. Open `http://localhost:4321/apercu/<that id>` in a private window: "Page introuvable".

Expected: both observations as described. If the panel stays blank, read the browser console for a `frame-src` violation and adjust the directive value (Directus reads comma-separated lists).

- [ ] **Step 7: Commit**

```bash
git add site compose.yaml
git diff --cached --check
git commit -m "feat(site): preview drafts with the editor's Directus session"
```

---

### Task 8: Accessibility, mobile reading and public copy

**Files:**
- Test: `site/tests/e2e/quality.spec.ts`
- Create: `docs/validation/2026-10-site-public.md`

**Interfaces:**
- Consumes: every route from Tasks 4–7, the seed.
- Produces: an automated quality gate (mobile overflow, keyboard path, headings, image alternatives, no mention of AI) and a signed visual check against the mockup.

- [ ] **Step 1: Write the quality tests**

`site/tests/e2e/quality.spec.ts`:

```ts
import type { SeedData } from './support/seed-data.ts';
import { expect, test } from './support/test.ts';

function publicPaths(seed: SeedData): string[] {
  return ['/', '/recherche', '/a-propos', `/articles/${seed.articleSlug}`, `/rubriques/${seed.sectionSlug}`];
}

test.describe('on a 390 px wide phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pages fit the screen without horizontal scrolling', async ({ page, seed }) => {
    for (const path of publicPaths(seed)) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('the article opens on its title and keeps a readable text size', async ({ page, seed }) => {
    await page.goto(`/articles/${seed.articleSlug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    const fontSize = await page
      .locator('.reading-body p')
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(17);
  });
});

test('the first Tab reaches the skip link, which moves focus to the content', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page.locator('main#contenu')).toBeFocused();
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const outlineStyle = await page.evaluate(() => {
    const focused = document.activeElement;
    if (focused === null) {
      return 'none';
    }
    return getComputedStyle(focused).outlineStyle;
  });

  expect(outlineStyle).toBe('solid');
});

test('every page is in French, has one main heading and describes its images', async ({ page, seed }) => {
  for (const path of publicPaths(seed)) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 }), path).toHaveCount(1);
    await expect(page.locator('img:not([alt])'), path).toHaveCount(0);
  }
});

test('public pages never mention artificial intelligence', async ({ page, seed }) => {
  for (const path of publicPaths(seed)) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text, path).not.toMatch(/\bIA\b/);
    expect(text, path).not.toMatch(/intelligence artificielle|chatgpt|openai|anthropic|généré automatiquement|assistant/i);
  }
});
```

- [ ] **Step 2: Run them**

Run: `pnpm test:e2e`
Expected: PASS, 26 end-to-end tests. These tests guard properties already built in Tasks 4–7; if one fails, fix the component or style it names (for example a long word overflowing at 390 px) and rerun before continuing.

- [ ] **Step 3: Check the site visually against the mockup**

1. Publish one real article from the Studio with two real photographs (one landscape, one portrait), a long title (over 90 characters) and five sources.
2. Open it at 1280 px, 800 px and 390 px wide, next to the accepted mockup (`docs/maquettes.md`, "proposition 2").
3. Navigate the home page and the article with the keyboard only, then with VoiceOver (macOS: Cmd+F5) for one article.
4. Run Lighthouse (Chrome DevTools, "Accessibility" category) on the home page and the article.

Record in `docs/validation/2026-10-site-public.md`:

```markdown
# Public site validation — October 2026

| Check | Result | Notes |
| --- | --- | --- |
| Home matches mockup “proposition 2” (1280 px) | ✅ / ❌ | |
| Article matches mockup “proposition 2” (1280 px) | ✅ / ❌ | |
| Reading at 800 px | ✅ / ❌ | |
| Reading at 390 px, portrait and landscape photos | ✅ / ❌ | |
| Long title without overflow | ✅ / ❌ | |
| Keyboard navigation, visible focus | ✅ / ❌ | |
| VoiceOver: title, lead, source links, captions | ✅ / ❌ | |
| Lighthouse accessibility home / article | score / score | |
| No mention of AI on public pages | ✅ / ❌ | |

Accepted gaps: …
Checked by: … on …
```

Expected: every line filled in; any ❌ is fixed in the site before Step 4, or written under “Accepted gaps” with the reason.

- [ ] **Step 4: Run the complete site verification**

Run: `pnpm --filter @my-media/site test && pnpm --filter @my-media/site typecheck && pnpm test:e2e`
Expected: all unit tests PASS; 0 type errors; 26 end-to-end tests PASS.

- [ ] **Step 5: Commit**

```bash
git add site/tests/e2e/quality.spec.ts docs/validation/2026-10-site-public.md
git diff --cached --check
git commit -m "test(site): guard accessibility, mobile reading and public copy"
```

---

## Self-review

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| §2 public site separate from the CMS, published version only | 2 (queries read `published_*` only), 5 (private data test), 6 (search ignores drafts) |
| §6 pages: home, sections, search, article, about/contact | 4, 5, 6 |
| §6 article: title, summary, body, images, byline, dates, sources block | 3, 5 |
| §6 public sources with numbered calls | 3 (`[^N]`), 5 (`#source-N` jump) |
| §6 no invented byline or source | 2 (empty byline stays empty), 3 (call without source dropped) |
| §6 authenticated draft preview | 7 |
| §7 no public mention of AI | 8 |
| §10 mockup "proposition 2", mobile, keyboard | 4 (styles), 8 (automated and manual checks) |
| §12 acceptance: published article visible, draft invisible, private data absent | 5, 6, 7 |
| §11 hosting of the site | plan 3 |

**Placeholder scan:** no "TBD" or "similar to"; the validation template's "…" and "✅ / ❌" are fields the person running Task 8 fills in.

**Type consistency:** `FigureImage.width/height` are `number | null` everywhere (published images always have numbers; preview images may not), and `renderFigure` omits the attributes for `null`. `ArticleView` is produced by `toPublishedArticleView` and `toDraftArticleView` and consumed only by `ArticleView.astro`. `SeedData` fields used in specs match those produced by `global-setup.ts`. `SESSION_COOKIE_NAME` (`queries.ts`) and the cookie name in `directus-session.ts` and the preview spec are the same string, `directus_session_token`.
