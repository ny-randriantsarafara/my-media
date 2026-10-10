import { createFlow, createOperation, readFlows, readOperations, updateFlow, updateOperation } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import {
  declaredPublicationOperationFields,
  operationFieldsDiffer,
  PUBLICATION_OPERATION_KEY,
  type PublicationOperationFields,
} from './publication-operation.ts';

export const PUBLICATION_FLOW_NAME = 'Publier';

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
  const declared = declaredPublicationOperationFields();
  const [existing] = await client.request(
    readOperations({
      filter: { flow: { _eq: flowId }, key: { _eq: PUBLICATION_OPERATION_KEY } },
      fields: ['id', 'type', 'name', 'position_x', 'position_y', 'options'],
      limit: 1,
    }),
  );
  if (existing !== undefined) {
    const stored = storedOperationFields(existing);
    if (operationFieldsDiffer(stored, declared)) {
      await client.request(
        updateOperation(existing.id, { flow: flowId, key: PUBLICATION_OPERATION_KEY, ...declared }),
      );
      log('Opération de publication mise à jour');
    }
    await client.request(updateFlow(flowId, { operation: existing.id }));
    return;
  }
  const created = await client.request(
    createOperation(
      { flow: flowId, key: PUBLICATION_OPERATION_KEY, ...declared },
      { fields: ['id'] },
    ),
  );
  await client.request(updateFlow(flowId, { operation: created.id }));
  log('Opération de publication créée');
}

function storedOperationFields(operation: {
  type: string;
  name: string | null;
  position_x: number;
  position_y: number;
  options: PublicationOperationFields['options'];
}): PublicationOperationFields {
  return {
    type: operation.type,
    name: operation.name ?? '',
    position_x: operation.position_x,
    position_y: operation.position_y,
    options: operation.options,
  };
}
