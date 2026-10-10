import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`La variable ${name} est absente du fichier .env.`);
  }
  return value;
}

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const testEnvironment = {
  directusUrl: requireEnvironment('DIRECTUS_URL'),
  adminToken: requireEnvironment('ADMIN_TOKEN'),
  editorToken: requireEnvironment('EDITOR_TOKEN'),
  assistantToken: requireEnvironment('AI_TOKEN'),
  editorRoleId: requireEnvironment('EDITOR_ROLE_ID'),
  assistantRoleId: requireEnvironment('AI_ROLE_ID'),
  assistantAppAccess: requireEnvironment('AI_APP_ACCESS') === 'true',
  publicMediaDirectory: resolve(repositoryRoot, requireEnvironment('PUBLIC_MEDIA_DIR')),
};
