import { readFile } from 'node:fs/promises';
import { isDirectusError } from '@directus/sdk';
import { ensureAccess } from './access/ensure-access.ts';
import { createAdminClient } from './directus-client.ts';
import { seedDemoContent } from './demo/seed-demo.ts';
import { readProvisionEnvironment } from './environment.ts';
import { ensurePublicationFlow } from './flows/ensure-publication-flow.ts';
import { editorialCollections } from './schema/collections.ts';
import { ensureSchema } from './schema/ensure-schema.ts';
import { editorialRelations } from './schema/relations.ts';
import { ensureSettings } from './settings/ensure-settings.ts';

function log(message: string): void {
  console.log(message);
}

async function provision(): Promise<void> {
  const environment = readProvisionEnvironment(process.env);
  const client = createAdminClient(environment.directusUrl, environment.adminToken);
  const assistantProtocol = await readFile(new URL('./assistant-protocol.md', import.meta.url), 'utf8');

  await ensureSchema(client, editorialCollections(environment.siteUrl), editorialRelations, log);
  await ensureAccess(client, environment, log);
  await ensurePublicationFlow(client, log);
  await ensureSettings(client, environment, assistantProtocol, log);
  log('Provisionnement terminé.');
  if (environment.demoContent) {
    await seedDemoContent({ directusUrl: environment.directusUrl, email: environment.editor.email, password: environment.editor.password }, log);
  }
}

function describeFailure(error: unknown): string {
  if (isDirectusError(error)) {
    return error.errors.map((detail) => `${detail.extensions.code} : ${detail.message}`).join('\n');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

try {
  await provision();
} catch (error) {
  console.error(`Échec du provisionnement :\n${describeFailure(error)}`);
  process.exitCode = 1;
}
