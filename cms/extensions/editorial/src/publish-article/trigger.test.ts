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
