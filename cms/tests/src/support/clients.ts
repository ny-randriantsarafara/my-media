import { createDirectus, rest, staticToken } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';
import { testEnvironment } from './environment.ts';

function createTokenClient(token: string) {
  return createDirectus<EditorialSchema>(testEnvironment.directusUrl).with(staticToken(token)).with(rest());
}

export type EditorialClient = ReturnType<typeof createTokenClient>;

export const adminClient = createTokenClient(testEnvironment.adminToken);
export const editorClient = createTokenClient(testEnvironment.editorToken);
export const assistantClient = createTokenClient(testEnvironment.assistantToken);
export const anonymousClient = createDirectus<EditorialSchema>(testEnvironment.directusUrl).with(rest());

export const systemAdminClient = createDirectus(testEnvironment.directusUrl)
  .with(staticToken(testEnvironment.adminToken))
  .with(rest());
