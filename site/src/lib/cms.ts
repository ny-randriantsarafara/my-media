import { DIRECTUS_PUBLIC_URL, DIRECTUS_URL } from 'astro:env/server';
import type { CmsConnection } from './cms-client.ts';
import { createPublicQueries } from './queries.ts';

export const cmsConnection: CmsConnection = { baseUrl: DIRECTUS_URL, fetch };

export const publicQueries = createPublicQueries(cmsConnection);

export const directusPublicUrl = DIRECTUS_PUBLIC_URL;
