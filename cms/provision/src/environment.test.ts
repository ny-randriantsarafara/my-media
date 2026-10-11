import { describe, expect, it } from 'vitest';
import { readProvisionEnvironment } from './environment.ts';

const completeSource = {
  DIRECTUS_URL: 'http://localhost:8055',
  ADMIN_TOKEN: 'admin-token',
  SITE_URL: 'http://localhost:4321',
  EDITOR_EMAIL: 'redaction@example.com',
  EDITOR_PASSWORD: 'editor-password',
  EDITOR_TOKEN: 'editor-token',
  EDITOR_ROLE_ID: '2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42',
  AI_EMAIL: 'assistant@example.com',
  AI_PASSWORD: 'assistant-password',
  AI_TOKEN: '',
  AI_ROLE_ID: '6f1d1f4e-2b7a-4c55-9f58-4c1b3e8a9d21',
  AI_APP_ACCESS: 'false',
  MCP_OAUTH_ENABLED: 'true',
  MCP_OAUTH_CIMD_ENABLED: 'true',
  MCP_OAUTH_DCR_ENABLED: 'false',
};

describe('readProvisionEnvironment', () => {
  it('reads accounts, roles and MCP OAuth switches', () => {
    const environment = readProvisionEnvironment(completeSource);

    expect(environment.editor).toEqual({
      email: 'redaction@example.com',
      password: 'editor-password',
      token: 'editor-token',
      roleId: '2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42',
    });
    expect(environment.assistant.appAccess).toBe(false);
    expect(environment.mcpOAuth).toEqual({ enabled: true, cimdEnabled: true, dcrEnabled: false });
  });

  it('loads the demo content only when DEMO_CONTENT is true', () => {
    expect(readProvisionEnvironment(completeSource).demoContent).toBe(false);
    expect(readProvisionEnvironment({ ...completeSource, DEMO_CONTENT: 'true' }).demoContent).toBe(true);
  });

  it('treats an empty token as no static token', () => {
    expect(readProvisionEnvironment(completeSource).assistant.token).toBeNull();
  });

  it('rejects a missing required variable with its name', () => {
    const { ADMIN_TOKEN: _removed, ...incompleteSource } = completeSource;

    expect(() => readProvisionEnvironment(incompleteSource)).toThrow('ADMIN_TOKEN');
  });
});
