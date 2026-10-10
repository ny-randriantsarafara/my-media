import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { testEnvironment } from './support/environment.ts';

const serverInfoResponse = z.object({ data: z.object({ version: z.string() }) });
const healthResponse = z.object({ status: z.string() });

describe('local Directus server', () => {
  it('runs the pinned Directus version', async () => {
    const response = await fetch(`${testEnvironment.directusUrl}/server/info`, {
      headers: { Authorization: `Bearer ${testEnvironment.adminToken}` },
    });

    expect(response.status).toBe(200);
    expect(serverInfoResponse.parse(await response.json()).data.version).toBe('12.5.0');
  });

  it('reports a healthy status', async () => {
    const response = await fetch(`${testEnvironment.directusUrl}/server/health`);

    expect(healthResponse.parse(await response.json()).status).toBe('ok');
  });
});
