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
