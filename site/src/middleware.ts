import { DIRECTUS_PUBLIC_URL } from 'astro:env/server';
import { defineMiddleware } from 'astro:middleware';
import { securityHeaders, withSecurityHeaders } from './lib/security-headers.ts';

const headers = securityHeaders(DIRECTUS_PUBLIC_URL);

export const onRequest = defineMiddleware(async (_context, next) => withSecurityHeaders(await next(), headers));
