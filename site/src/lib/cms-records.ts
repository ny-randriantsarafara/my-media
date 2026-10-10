import { z } from 'zod';

const sectionRecord = z.object({ name: z.string(), slug: z.string() });

const publishedImageRecord = z.object({
  sort: z.number(),
  public_file_name: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
});

const referenceFields = {
  organization: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  publication: z.string().nullable(),
  published_on: z.string().nullable(),
  note: z.string().nullable(),
};

const publishedReferenceRecord = z.object({ sort: z.number(), ...referenceFields });

const draftReferenceRecord = z.object({ sort: z.number().nullable(), ...referenceFields });

const draftImageRecord = z.object({
  sort: z.number().nullable(),
  alt: z.string(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
  file: z.object({ id: z.string(), width: z.number().nullable(), height: z.number().nullable() }),
});

export const articleCardRecord = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  byline: z.string().nullable(),
  format: z.string().nullable(),
  first_published_at: z.string(),
  section: sectionRecord.nullable(),
  images: z.array(publishedImageRecord),
});

export const publishedArticleRecord = articleCardRecord.extend({
  body: z.string().nullable(),
  last_published_at: z.string(),
  references: z.array(publishedReferenceRecord),
});

export const homeFeatureRecord = z.object({
  placement: z.enum(['lead', 'selection']),
  published_article: articleCardRecord,
});

export const sectionPageRecord = z.object({ name: z.string(), slug: z.string(), description: z.string().nullable() });

export const siteSettingsRecord = z.object({
  media_name: z.string().nullable().default(null),
  edition_label: z.string().nullable().default(null),
  presentation: z.string().nullable().default(null),
  about_body: z.string().nullable().default(null),
  contact_email: z.string().nullable().default(null),
  legal_notice: z.string().nullable().default(null),
});

export const draftArticleRecord = z.object({
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string().nullable(),
  byline: z.string().nullable(),
  format: z.string().nullable(),
  section: sectionRecord.nullable(),
  references: z.array(draftReferenceRecord),
  images: z.array(draftImageRecord),
});

export type PublishedImageRecord = z.infer<typeof publishedImageRecord>;
export type ArticleCardRecord = z.infer<typeof articleCardRecord>;
export type PublishedArticleRecord = z.infer<typeof publishedArticleRecord>;
export type HomeFeatureRecord = z.infer<typeof homeFeatureRecord>;
export type SectionPageRecord = z.infer<typeof sectionPageRecord>;
export type SiteSettingsRecord = z.infer<typeof siteSettingsRecord>;
export type DraftArticleRecord = z.infer<typeof draftArticleRecord>;

const REFERENCE_FIELD_NAMES = ['sort', 'organization', 'title', 'url', 'author', 'publication', 'published_on', 'note'];

export const CARD_FIELDS = [
  'slug',
  'title',
  'summary',
  'byline',
  'format',
  'first_published_at',
  'section.name',
  'section.slug',
  'images.sort',
  'images.public_file_name',
  'images.width',
  'images.height',
  'images.alt',
  'images.caption',
  'images.credit',
];

export const ARTICLE_FIELDS = [
  ...CARD_FIELDS,
  'body',
  'last_published_at',
  ...REFERENCE_FIELD_NAMES.map((field) => `references.${field}`),
];

export const HOME_FEATURE_FIELDS = ['placement', ...CARD_FIELDS.map((field) => `published_article.${field}`)];

export const SITE_SETTINGS_FIELDS = ['media_name', 'edition_label', 'presentation', 'about_body', 'contact_email', 'legal_notice'];

export const DRAFT_FIELDS = [
  'title',
  'summary',
  'body',
  'byline',
  'format',
  'section.name',
  'section.slug',
  ...REFERENCE_FIELD_NAMES.map((field) => `references.${field}`),
  'images.sort',
  'images.alt',
  'images.caption',
  'images.credit',
  'images.file.id',
  'images.file.width',
  'images.file.height',
];
