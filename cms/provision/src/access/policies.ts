import type { EditorialSchema } from '@my-media/cms-schema';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export type SystemCollection = 'directus_files' | 'directus_folders' | 'directus_users' | 'directus_flows' | 'directus_operations';

export type GrantedCollection = keyof EditorialSchema | SystemCollection;

export type CollectionGrant = { collection: GrantedCollection; actions: PermissionAction[] };

export type PolicyDefinition = {
  name: string;
  icon: string;
  description: string;
  appAccess: boolean;
  grants: CollectionGrant[];
};

export type PermissionRow = {
  policy: string;
  collection: GrantedCollection;
  action: PermissionAction;
  fields: string[];
  permissions: null;
  validation: null;
  presets: null;
};

export const PUBLIC_POLICY_ID = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17';

export const publicCollections: (keyof EditorialSchema)[] = [
  'site_settings',
  'sections',
  'published_articles',
  'published_references',
  'published_images',
  'home_features',
];

export const privateCollections: (keyof EditorialSchema)[] = [
  'editorial_line',
  'watch_sources',
  'materials',
  'articles',
  'article_references',
  'article_images',
  'verification_points',
  'review_remarks',
];

const allActions: PermissionAction[] = ['create', 'read', 'update', 'delete'];

function grant(collections: GrantedCollection[], actions: PermissionAction[]): CollectionGrant[] {
  return collections.map((collection) => ({ collection, actions }));
}

export const publicGrants: CollectionGrant[] = grant(publicCollections, ['read']);

export const editorPolicy: PolicyDefinition = {
  name: 'Rédaction',
  icon: 'edit_note',
  description: 'Prépare, relit et publie les articles.',
  appAccess: true,
  grants: [
    ...grant(publicCollections, allActions),
    ...grant(privateCollections, allActions),
    ...grant(['directus_files', 'directus_folders'], allActions),
    ...grant(['directus_users', 'directus_flows', 'directus_operations'], ['read']),
  ],
};

export function assistantPolicy(appAccess: boolean): PolicyDefinition {
  return {
    name: 'Assistant IA',
    icon: 'smart_toy',
    description: 'Prépare des brouillons via MCP. Ne publie pas et n’administre pas.',
    appAccess,
    grants: [
      ...grant(publicCollections, ['read']),
      ...grant(['editorial_line', 'watch_sources', 'materials'], ['read']),
      ...grant(['articles', 'verification_points'], ['create', 'read', 'update']),
      ...grant(['article_references', 'article_images'], allActions),
      ...grant(['review_remarks'], ['read', 'update']),
      ...grant(['directus_files'], ['create', 'read', 'update']),
      ...grant(['directus_folders'], ['read']),
    ],
  };
}

export function toPermissionRows(policyId: string, grants: CollectionGrant[]): PermissionRow[] {
  return grants.flatMap((collectionGrant) =>
    collectionGrant.actions.map((action) => ({
      policy: policyId,
      collection: collectionGrant.collection,
      action,
      fields: ['*'],
      permissions: null,
      validation: null,
      presets: null,
    })),
  );
}

export function grantKeys(grants: CollectionGrant[]): string[] {
  return grants.flatMap((collectionGrant) => collectionGrant.actions.map((action) => `${collectionGrant.collection}:${action}`)).toSorted();
}
