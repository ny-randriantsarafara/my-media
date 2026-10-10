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
