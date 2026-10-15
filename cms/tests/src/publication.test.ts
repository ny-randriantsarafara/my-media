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
    throw new Error(`Setup publication was rejected: ${attempt.code} ${attempt.message}`);
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
      throw new Error('Publication should have been rejected.');
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
