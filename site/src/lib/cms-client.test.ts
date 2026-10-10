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
