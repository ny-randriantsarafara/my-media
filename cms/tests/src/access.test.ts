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
import { adminClient, anonymousClient, assistantClient, editorClient, systemAdminClient } from './support/clients.ts';
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
      await systemAdminClient.request(readRole(testEnvironment.assistantRoleId, { fields: [{ policies: [{ policy: ['name'] }] }] })),
    );

    expect(role.policies.map((access) => access.policy.name)).toEqual(['Assistant IA']);
  });

  it('attaches no extra policy directly to assistant users', async () => {
    const users = userPolicies.parse(
      await systemAdminClient.request(readUsers({ filter: { role: { _eq: testEnvironment.assistantRoleId } }, fields: [{ policies: ['id'] }] })),
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
