import type { APIRequestContext } from '@playwright/test';
import { e2eEnvironment } from './environment.ts';

const SESSION_COOKIE = /^directus_session_token=([^;]+)/;

export async function signInToDirectus(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${e2eEnvironment.directusUrl}/auth/login`, {
    data: { email: e2eEnvironment.editorEmail, password: e2eEnvironment.editorPassword, mode: 'session' },
  });
  if (!response.ok()) {
    throw new Error(`Directus login refused (HTTP ${response.status()}).`);
  }
  const token = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => SESSION_COOKIE.exec(header.value)?.[1])
    .find((value) => value !== undefined);
  if (token === undefined) {
    throw new Error('Directus did not return a session cookie.');
  }
  return token;
}
