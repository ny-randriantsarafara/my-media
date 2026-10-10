export type AccountEnvironment = {
  email: string;
  password: string;
  token: string | null;
  roleId: string;
};

export type ProvisionEnvironment = {
  directusUrl: string;
  adminToken: string;
  siteUrl: string;
  editor: AccountEnvironment;
  assistant: AccountEnvironment & { appAccess: boolean };
  mcpOAuth: { enabled: boolean; cimdEnabled: boolean; dcrEnabled: boolean };
};

type EnvironmentSource = Record<string, string | undefined>;

export function readProvisionEnvironment(source: EnvironmentSource): ProvisionEnvironment {
  return {
    directusUrl: requireValue(source, 'DIRECTUS_URL'),
    adminToken: requireValue(source, 'ADMIN_TOKEN'),
    siteUrl: requireValue(source, 'SITE_URL'),
    editor: {
      email: requireValue(source, 'EDITOR_EMAIL'),
      password: requireValue(source, 'EDITOR_PASSWORD'),
      token: optionalValue(source, 'EDITOR_TOKEN'),
      roleId: requireValue(source, 'EDITOR_ROLE_ID'),
    },
    assistant: {
      email: requireValue(source, 'AI_EMAIL'),
      password: requireValue(source, 'AI_PASSWORD'),
      token: optionalValue(source, 'AI_TOKEN'),
      roleId: requireValue(source, 'AI_ROLE_ID'),
      appAccess: readFlag(source, 'AI_APP_ACCESS'),
    },
    mcpOAuth: {
      enabled: readFlag(source, 'MCP_OAUTH_ENABLED'),
      cimdEnabled: readFlag(source, 'MCP_OAUTH_CIMD_ENABLED'),
      dcrEnabled: readFlag(source, 'MCP_OAUTH_DCR_ENABLED'),
    },
  };
}

function requireValue(source: EnvironmentSource, name: string): string {
  const value = optionalValue(source, name);
  if (value === null) {
    throw new Error(`La variable d’environnement ${name} est obligatoire.`);
  }
  return value;
}

function optionalValue(source: EnvironmentSource, name: string): string | null {
  const value = source[name];
  if (value === undefined || value.trim() === '') {
    return null;
  }
  return value;
}

function readFlag(source: EnvironmentSource, name: string): boolean {
  return source[name] === 'true';
}
