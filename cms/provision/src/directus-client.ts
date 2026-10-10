import { createDirectus, rest, staticToken } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';

export type Log = (message: string) => void;

export function createAdminClient(url: string, token: string) {
  return createDirectus<EditorialSchema>(url).with(staticToken(token)).with(rest());
}

export type AdminClient = ReturnType<typeof createAdminClient>;
