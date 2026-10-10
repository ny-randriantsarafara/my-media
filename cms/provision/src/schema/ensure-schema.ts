import { createCollection, createField, createRelation, readCollections, readFieldsByCollection, readRelations } from '@directus/sdk';
import type { AdminClient, Log } from '../directus-client.ts';
import type { CollectionDefinition } from './collections.ts';
import type { RelationDefinition } from './relations.ts';

export async function ensureSchema(
  client: AdminClient,
  collections: CollectionDefinition[],
  relations: RelationDefinition[],
  log: Log,
): Promise<void> {
  const existingCollections = await client.request(readCollections());
  const existingCollectionNames = new Set(existingCollections.map((collection) => collection.collection));
  for (const definition of collections) {
    await ensureCollection(client, definition, existingCollectionNames.has(definition.collection), log);
  }

  const existingRelations = await client.request(readRelations());
  const existingRelationKeys = new Set(existingRelations.map((relation) => relationKey(relation.collection, relation.field)));
  for (const definition of relations) {
    await ensureRelation(client, definition, existingRelationKeys.has(relationKey(definition.collection, definition.field)), log);
  }
}

async function ensureCollection(client: AdminClient, definition: CollectionDefinition, exists: boolean, log: Log): Promise<void> {
  if (!exists) {
    await client.request(createCollection(toCollectionPayload(definition)));
    log(`Collection créée : ${definition.collection}`);
    return;
  }
  await ensureMissingFields(client, definition, log);
}

async function ensureMissingFields(client: AdminClient, definition: CollectionDefinition, log: Log): Promise<void> {
  const existingFields = await client.request(readFieldsByCollection(definition.collection));
  const existingFieldNames = new Set(existingFields.map((field) => field.field));
  const missingFields = definition.fields.filter((field) => !existingFieldNames.has(field.field));
  for (const field of missingFields) {
    await client.request(createField(definition.collection, field));
    log(`Champ créé : ${definition.collection}.${field.field}`);
  }
}

async function ensureRelation(client: AdminClient, definition: RelationDefinition, exists: boolean, log: Log): Promise<void> {
  if (exists) {
    return;
  }
  await client.request(createRelation(definition));
  log(`Relation créée : ${definition.collection}.${definition.field}`);
}

function relationKey(collection: string, field: string): string {
  return `${collection}.${field}`;
}

function toCollectionPayload(definition: CollectionDefinition) {
  return {
    collection: definition.collection,
    meta: {
      icon: definition.icon,
      note: definition.note,
      singleton: definition.singleton,
      hidden: definition.hidden,
      sort_field: definition.sortField,
      display_template: definition.displayTemplate,
      preview_url: definition.previewUrl,
      accountability: 'all',
      translations: [
        {
          language: 'fr-FR',
          translation: definition.label.plural,
          singular: definition.label.singular,
          plural: definition.label.plural,
        },
      ],
    },
    schema: {},
    fields: definition.fields,
  };
}
