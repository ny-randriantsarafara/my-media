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
