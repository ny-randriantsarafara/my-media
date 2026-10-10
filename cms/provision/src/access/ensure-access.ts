import {
  createPermissions,
  createPolicy,
  createRole,
  createUser,
  deletePermissions,
  readPermissions,
  readPolicies,
  readRoles,
  readUsers,
  updatePolicy,
  updateUser,
} from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import type { AccountEnvironment, ProvisionEnvironment } from '../environment.ts';
import { assistantPolicy, editorPolicy, PUBLIC_POLICY_ID, publicGrants, toPermissionRows } from './policies.ts';
import type { CollectionGrant, PolicyDefinition } from './policies.ts';

type RoleDefinition = { id: string; name: string; icon: string; policyId: string };

type UserDefinition = { account: AccountEnvironment; firstName: string };

export async function ensureAccess(client: AdminClient, environment: ProvisionEnvironment, log: Log): Promise<void> {
  const assistant = assistantPolicy(environment.assistant.appAccess);
  const editorPolicyId = await ensurePolicy(client, editorPolicy, log);
  const assistantPolicyId = await ensurePolicy(client, assistant, log);

  await replacePermissions(client, PUBLIC_POLICY_ID, publicGrants, log);
  await replacePermissions(client, editorPolicyId, editorPolicy.grants, log);
  await replacePermissions(client, assistantPolicyId, assistant.grants, log);

  await ensureRole(client, { id: environment.editor.roleId, name: 'Rédaction', icon: 'edit_note', policyId: editorPolicyId }, log);
  await ensureRole(client, { id: environment.assistant.roleId, name: 'Assistant IA', icon: 'smart_toy', policyId: assistantPolicyId }, log);

  await ensureUser(client, { account: environment.editor, firstName: 'Rédaction' }, log);
  await ensureUser(client, { account: environment.assistant, firstName: 'Assistant' }, log);
}

async function ensurePolicy(client: AdminClient, definition: PolicyDefinition, log: Log): Promise<string> {
  const values = {
    name: definition.name,
    icon: definition.icon,
    description: definition.description,
    app_access: definition.appAccess,
    admin_access: false,
    enforce_tfa: false,
  };
  const [existing] = await client.request(readPolicies({ filter: { name: { _eq: definition.name } }, fields: ['id'], limit: 1 }));
  if (existing === undefined) {
    const created = await client.request(createPolicy(values, { fields: ['id'] }));
    log(`Politique créée : ${definition.name}`);
    return created.id;
  }
  await client.request(updatePolicy(existing.id, values));
  return existing.id;
}

async function replacePermissions(client: AdminClient, policyId: string, grants: CollectionGrant[], log: Log): Promise<void> {
  const existing = await client.request(readPermissions({ filter: { policy: { _eq: policyId } }, fields: ['id'], limit: -1 }));
  // Directus can add synthetic app permissions without an id to this list; only stored rows can be deleted.
  const storedIds = existing.map((permission) => permission.id).filter((id) => typeof id === 'number');
  if (storedIds.length > 0) {
    await client.request(deletePermissions(storedIds));
  }
  await client.request(createPermissions(toPermissionRows(policyId, grants)));
  log(`Permissions appliquées à la politique ${policyId}`);
}

async function ensureRole(client: AdminClient, definition: RoleDefinition, log: Log): Promise<void> {
  const [existing] = await client.request(readRoles({ filter: { id: { _eq: definition.id } }, fields: ['id'], limit: 1 }));
  if (existing !== undefined) {
    return;
  }
  await client.request(
    createRole({ id: definition.id, name: definition.name, icon: definition.icon, policies: [{ policy: definition.policyId }] }),
  );
  log(`Rôle créé : ${definition.name}`);
}

async function ensureUser(client: AdminClient, definition: UserDefinition, log: Log): Promise<void> {
  const { account } = definition;
  const [existing] = await client.request(readUsers({ filter: { email: { _eq: account.email } }, fields: ['id'], limit: 1 }));
  if (existing === undefined) {
    await client.request(
      createUser({
        email: account.email,
        password: account.password,
        first_name: definition.firstName,
        role: account.roleId,
        status: 'active',
        token: account.token,
      }),
    );
    log(`Utilisateur créé : ${account.email}`);
    return;
  }
  await client.request(updateUser(existing.id, { role: account.roleId, status: 'active', token: account.token }));
}
