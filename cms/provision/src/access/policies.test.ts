import { describe, expect, it } from 'vitest';
import { assistantPolicy, editorPolicy, grantKeys, publicCollections, publicGrants, toPermissionRows } from './policies.ts';
import type { CollectionGrant } from './policies.ts';

function actionsOn(grants: CollectionGrant[], collection: string): string[] {
  return grants.filter((grant) => grant.collection === collection).flatMap((grant) => grant.actions);
}

describe('public policy', () => {
  it('only reads public collections', () => {
    expect(grantKeys(publicGrants)).toEqual(publicCollections.map((collection) => `${collection}:read`).toSorted());
  });
});

describe('assistant policy', () => {
  const grants = assistantPolicy(false).grants;

  it('cannot write any public collection', () => {
    const publicWrites = publicCollections.flatMap((collection) =>
      actionsOn(grants, collection).filter((action) => action !== 'read'),
    );

    expect(publicWrites).toEqual([]);
  });

  it('cannot reach administration collections', () => {
    const administration = ['directus_users', 'directus_flows', 'directus_operations', 'directus_permissions', 'directus_policies', 'directus_roles', 'directus_settings'];
    const reachable = administration.filter((collection) => actionsOn(grants, collection).length > 0);

    expect(reachable).toEqual([]);
  });

  it('cannot delete articles, verification points, remarks or files', () => {
    const deletable = ['articles', 'verification_points', 'review_remarks', 'directus_files'].filter((collection) =>
      actionsOn(grants, collection).includes('delete'),
    );

    expect(deletable).toEqual([]);
  });

  it('only changes human-owned settings by reading them', () => {
    expect(actionsOn(grants, 'editorial_line')).toEqual(['read']);
    expect(actionsOn(grants, 'watch_sources')).toEqual(['read']);
    expect(actionsOn(grants, 'materials')).toEqual(['read']);
  });

  it('follows the requested Studio access flag', () => {
    expect(assistantPolicy(true).appAccess).toBe(true);
    expect(assistantPolicy(false).appAccess).toBe(false);
  });
});

describe('editor policy', () => {
  it('can read the flows that render the Publier button', () => {
    expect(actionsOn(editorPolicy.grants, 'directus_flows')).toEqual(['read']);
    expect(actionsOn(editorPolicy.grants, 'directus_operations')).toEqual(['read']);
  });
});

describe('permission rows', () => {
  it('only produces rows allowed by Directus Core', () => {
    const rows = toPermissionRows('policy-id', [...editorPolicy.grants, ...assistantPolicy(false).grants, ...publicGrants]);
    const restrictedRows = rows.filter(
      (row) => row.fields.join(',') !== '*' || row.permissions !== null || row.validation !== null || row.presets !== null,
    );

    expect(restrictedRows).toEqual([]);
  });
});
