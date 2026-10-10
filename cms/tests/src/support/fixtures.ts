import { randomUUID } from 'node:crypto';
import { createItem, uploadFiles } from '@directus/sdk';
import type { NestedPartial } from '@directus/sdk';
import type { Article } from '@my-media/cms-schema';
import type { EditorialClient } from './clients.ts';

export const ONE_PIXEL_PNG = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgYGAAAAAEAAGjChXjAAAAAElFTkSuQmCC',
    'base64',
  ),
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
