import { readCollections, readFlows, readUsers } from '@directus/sdk';
import { describe, expect, it } from 'vitest';
import { adminClient } from './support/clients.ts';

describe('Directus Core limits', () => {
  it('uses at most 25 custom collections', async () => {
    const collections = await adminClient.request(readCollections());
    const customCollections = collections.filter((collection) => !collection.collection.startsWith('directus_'));

    expect(customCollections.length).toBeLessThanOrEqual(25);
  });

  it('uses at most 5 flows', async () => {
    const flows = await adminClient.request(readFlows({ fields: ['id'], limit: -1 }));

    expect(flows.length).toBeLessThanOrEqual(5);
  });

  it('keeps at most 3 active users, the seat limit', async () => {
    const users = await adminClient.request(readUsers({ filter: { status: { _eq: 'active' } }, fields: ['id'], limit: -1 }));

    expect(users.length).toBeLessThanOrEqual(3);
  });
});
