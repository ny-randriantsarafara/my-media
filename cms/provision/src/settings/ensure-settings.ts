import { updateSettings } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import type { ProvisionEnvironment } from '../environment.ts';

export async function ensureSettings(
  client: AdminClient,
  environment: ProvisionEnvironment,
  assistantProtocol: string,
  log: Log,
): Promise<void> {
  await client.request(
    updateSettings({
      project_name: 'Rédaction',
      default_language: 'fr-FR',
      mcp_enabled: true,
      mcp_allow_deletes: true,
      mcp_system_prompt_enabled: true,
      mcp_system_prompt: assistantProtocol,
      mcp_oauth_enabled: environment.mcpOAuth.enabled,
      mcp_oauth_cimd_enabled: environment.mcpOAuth.cimdEnabled,
      mcp_oauth_dcr_enabled: environment.mcpOAuth.dcrEnabled,
    }),
  );
  log('MCP settings applied');
}
