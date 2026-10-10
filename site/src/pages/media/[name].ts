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
