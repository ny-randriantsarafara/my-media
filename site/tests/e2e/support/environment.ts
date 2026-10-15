import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repositoryRoot = new URL('../../../../', import.meta.url);
const values = parseEnv(readFileSync(new URL('.env', repositoryRoot), 'utf8'));

function requireValue(name: string): string {
  const value = values[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is missing from the .env file at the repository root.`);
  }
  return value;
}

function resolveFromRepository(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return fileURLToPath(new URL(path, repositoryRoot));
}

export const e2eEnvironment = {
  siteUrl: requireValue('SITE_URL'),
  directusUrl: requireValue('DIRECTUS_URL'),
  directusPublicUrl: requireValue('DIRECTUS_PUBLIC_URL'),
  publicMediaDirectory: resolveFromRepository(requireValue('PUBLIC_MEDIA_DIR')),
  editorEmail: requireValue('EDITOR_EMAIL'),
  editorPassword: requireValue('EDITOR_PASSWORD'),
  editorToken: requireValue('EDITOR_TOKEN'),
};
