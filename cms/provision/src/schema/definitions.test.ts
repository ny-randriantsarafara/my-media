import { describe, expect, it } from 'vitest';
import { editorialCollections } from './collections.ts';
import { editorialRelations } from './relations.ts';

const collections = editorialCollections('http://localhost:4321');
const collectionNames = new Set<string>(collections.map((definition) => definition.collection));

function fieldsOf(collection: string): string[] {
  const definition = collections.find((candidate) => candidate.collection === collection);
  if (definition === undefined) {
    throw new Error(`Collection ${collection} absente`);
  }
  return definition.fields.map((field) => field.field);
}

describe('editorial collections', () => {
  it('stays within the 25 collections allowed by Directus Core', () => {
    expect(collections.length).toBeLessThanOrEqual(25);
  });

  it('gives every collection an id primary key', () => {
    const collectionsWithoutId = collections.filter(
      (definition) => !definition.fields.some((field) => field.field === 'id' && field.schema?.is_primary_key === true),
    );

    expect(collectionsWithoutId).toEqual([]);
  });

  it('enforces a unique creation key on articles', () => {
    const articles = collections.find((definition) => definition.collection === 'articles');
    const creationKey = articles?.fields.find((field) => field.field === 'creation_key');

    expect(creationKey?.schema?.is_unique).toBe(true);
  });

  it('keeps private fields out of the published collections', () => {
    expect(fieldsOf('published_references')).not.toContain('material');
    expect(fieldsOf('published_images')).not.toContain('source_note');
    expect(fieldsOf('published_images')).not.toContain('file');
  });

  it('points the article preview at the site preview route', () => {
    const articles = collections.find((definition) => definition.collection === 'articles');

    expect(articles?.previewUrl).toBe('http://localhost:4321/apercu/{{id}}');
  });
});

describe('editorial relations', () => {
  it('only links declared fields to declared or system collections', () => {
    const invalidRelations = editorialRelations.filter((relation) => {
      const sourceIsDeclared = fieldsOf(relation.collection).includes(relation.field);
      const target = relation.related_collection ?? '';
      const targetIsKnown = collectionNames.has(target) || target.startsWith('directus_');
      return !sourceIsDeclared || !targetIsKnown;
    });

    expect(invalidRelations).toEqual([]);
  });

  it('declares every one-to-many alias through a relation', () => {
    const aliasFields = collections.flatMap((definition) =>
      definition.fields
        .filter((field) => field.type === 'alias')
        .map((field) => `${definition.collection}.${field.field}`),
    );
    const relationAliases = editorialRelations
      .filter((relation) => relation.meta?.one_field !== null && relation.meta?.one_field !== undefined)
      .map((relation) => `${relation.related_collection ?? ''}.${relation.meta?.one_field ?? ''}`);

    expect(relationAliases.toSorted()).toEqual(aliasFields.toSorted());
  });
});
