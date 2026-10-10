import type { DirectusRelation, NestedPartial } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';

export type RelationDefinition = NestedPartial<DirectusRelation<EditorialSchema>> & {
  collection: string;
  field: string;
};

type DeleteAction = 'CASCADE' | 'SET NULL' | 'RESTRICT';

function manyToOne(collection: string, field: string, relatedCollection: string, onDelete: DeleteAction): RelationDefinition {
  return {
    collection,
    field,
    related_collection: relatedCollection,
    meta: { one_field: null, sort_field: null, one_deselect_action: 'nullify' },
    schema: { on_delete: onDelete },
  };
}

function childOf(
  collection: string,
  field: string,
  relatedCollection: string,
  aliasField: string,
  sortFieldName: string | null,
): RelationDefinition {
  return {
    collection,
    field,
    related_collection: relatedCollection,
    meta: { one_field: aliasField, sort_field: sortFieldName, one_deselect_action: 'delete' },
    schema: { on_delete: 'CASCADE' },
  };
}

export const editorialRelations: RelationDefinition[] = [
  manyToOne('materials', 'file', 'directus_files', 'SET NULL'),
  manyToOne('materials', 'user_created', 'directus_users', 'SET NULL'),
  manyToOne('articles', 'section', 'sections', 'SET NULL'),
  manyToOne('articles', 'user_created', 'directus_users', 'SET NULL'),
  manyToOne('articles', 'user_updated', 'directus_users', 'SET NULL'),
  childOf('article_references', 'article', 'articles', 'references', 'sort'),
  manyToOne('article_references', 'material', 'materials', 'SET NULL'),
  childOf('article_images', 'article', 'articles', 'images', 'sort'),
  manyToOne('article_images', 'file', 'directus_files', 'RESTRICT'),
  childOf('verification_points', 'article', 'articles', 'verification_points', null),
  manyToOne('verification_points', 'user_created', 'directus_users', 'SET NULL'),
  childOf('review_remarks', 'article', 'articles', 'review_remarks', null),
  manyToOne('review_remarks', 'user_created', 'directus_users', 'SET NULL'),
  {
    collection: 'published_articles',
    field: 'article',
    related_collection: 'articles',
    meta: { one_field: 'publication', sort_field: null, one_deselect_action: 'nullify' },
    schema: { on_delete: 'RESTRICT' },
  },
  manyToOne('published_articles', 'section', 'sections', 'SET NULL'),
  childOf('published_references', 'published_article', 'published_articles', 'references', 'sort'),
  childOf('published_images', 'published_article', 'published_articles', 'images', 'sort'),
  manyToOne('home_features', 'published_article', 'published_articles', 'CASCADE'),
];
