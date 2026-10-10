import { createFlow, createOperation, readFlows, readOperations, updateFlow } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';

export const PUBLICATION_FLOW_NAME = 'Publier';

const PUBLICATION_OPERATION_KEY = 'publish';

const publicationFlow = {
  name: PUBLICATION_FLOW_NAME,
  icon: 'publish',
  color: '#7A3D32',
  description: 'Publie la version de travail de l’article sur le site.',
  status: 'active',
  trigger: 'manual',
  accountability: 'all',
  options: {
    collections: ['articles'],
    location: 'item',
    requireSelection: true,
    requireConfirmation: false,
    async: false,
    error_on_reject: true,
  },
};

export async function ensurePublicationFlow(client: AdminClient, log: Log): Promise<void> {
  const flowId = await ensureFlow(client, log);
  await ensureOperation(client, flowId, log);
}

async function ensureFlow(client: AdminClient, log: Log): Promise<string> {
  const [existing] = await client.request(readFlows({ filter: { name: { _eq: PUBLICATION_FLOW_NAME } }, fields: ['id'], limit: 1 }));
  if (existing === undefined) {
    const created = await client.request(createFlow(publicationFlow, { fields: ['id'] }));
    log('Flow « Publier » créé');
    return created.id;
  }
  await client.request(updateFlow(existing.id, publicationFlow));
  return existing.id;
}

async function ensureOperation(client: AdminClient, flowId: string, log: Log): Promise<void> {
  const [existing] = await client.request(
    readOperations({ filter: { flow: { _eq: flowId }, key: { _eq: PUBLICATION_OPERATION_KEY } }, fields: ['id'], limit: 1 }),
  );
  if (existing !== undefined) {
    await client.request(updateFlow(flowId, { operation: existing.id }));
    return;
  }
  const created = await client.request(
    createOperation(
      { flow: flowId, key: PUBLICATION_OPERATION_KEY, type: 'publish-article', name: 'Publier l’article', position_x: 19, position_y: 1, options: {} },
      { fields: ['id'] },
    ),
  );
  await client.request(updateFlow(flowId, { operation: created.id }));
  log('Opération de publication créée');
}
