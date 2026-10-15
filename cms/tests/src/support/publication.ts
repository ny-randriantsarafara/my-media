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
    throw new Error(`Error response without details (HTTP ${response.status}).`);
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
