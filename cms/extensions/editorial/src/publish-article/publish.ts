import { isDirectusError } from '@directus/errors';
import type {
  AbstractService,
  Accountability,
  ApiExtensionContext,
  PrimaryKey,
  Query,
  SchemaOverview,
  TransformationSet,
} from '@directus/types';
import type { Knex } from 'knex';
import { PublicationError } from '../errors.ts';
import type { PublicMediaStore } from './public-media-store.ts';
import { buildPublication, PUBLIC_IMAGE_MAX_WIDTH } from './publication.ts';
import type {
  DraftArticle,
  PlannedImage,
  PublicationPlan,
  PublishedArticleValues,
  PublishedImageValues,
  PublishedReferenceValues,
} from './publication.ts';

export type PublishDependencies = {
  articleId: string;
  accountability: Accountability;
  services: ApiExtensionContext['services'];
  database: ApiExtensionContext['database'];
  logger: ApiExtensionContext['logger'];
  schema: SchemaOverview;
  mediaStore: PublicMediaStore;
  now: () => Date;
  createPublicFileName: () => string;
};

export type PublishResult = { article: string; slug: string; published_at: string };

type ExistingPublication = { id: string; images: { public_file_name: string }[] };
type PublishedArticleRecord = PublishedArticleValues & { first_published_at: string };
type PublishedReferenceRecord = PublishedReferenceValues & { published_article: string };
type PublishedImageRecord = PublishedImageValues & { published_article: string };
type AssetReader = InstanceType<ApiExtensionContext['services']['AssetsService']>;

const DRAFT_QUERY: Query = {
  fields: [
    'id',
    'title',
    'slug',
    'summary',
    'body',
    'byline',
    'format',
    'section',
    'references.sort',
    'references.organization',
    'references.title',
    'references.url',
    'references.author',
    'references.publication',
    'references.published_on',
    'references.note',
    'images.sort',
    'images.alt',
    'images.caption',
    'images.credit',
    'images.file.id',
    'images.file.type',
    'images.file.width',
    'images.file.height',
  ],
  deep: { references: { _limit: -1 }, images: { _limit: -1 } },
};

const PUBLIC_IMAGE_TRANSFORMATION: TransformationSet = {
  transformationParams: { width: PUBLIC_IMAGE_MAX_WIDTH, withoutEnlargement: true, format: 'webp', quality: 82 },
};

export async function publishArticle(dependencies: PublishDependencies): Promise<PublishResult> {
  const draft = await readDraftArticle(dependencies);
  const publishedAt = dependencies.now();
  const plan = buildPublication(draft, publishedAt, dependencies.createPublicFileName);
  const replacedFileNames = await writePublicationOrRollBack(dependencies, plan, publishedAt);
  await removePublicFiles(dependencies, replacedFileNames);
  return { article: draft.id, slug: plan.article.slug, published_at: publishedAt.toISOString() };
}

async function readDraftArticle(dependencies: PublishDependencies): Promise<DraftArticle> {
  const { services, accountability, schema, articleId } = dependencies;
  const articles = new services.ItemsService<DraftArticle>('articles', { accountability, schema });
  return articles.readOne(articleId, DRAFT_QUERY);
}

async function writePublicationOrRollBack(dependencies: PublishDependencies, plan: PublicationPlan, publishedAt: Date): Promise<string[]> {
  try {
    return await dependencies.database.transaction((transaction) => writePublication(dependencies, transaction, plan, publishedAt));
  } catch (error) {
    dependencies.logger.error({ err: error }, `Publication rolled back for article ${plan.article.article}`);
    await removePublicFiles(dependencies, plan.images.map((image) => image.values.public_file_name));
    throw toPublicationFailure(error);
  }
}

async function writePublication(
  dependencies: PublishDependencies,
  transaction: Knex.Transaction,
  plan: PublicationPlan,
  publishedAt: Date,
): Promise<string[]> {
  const { services, accountability, schema, mediaStore } = dependencies;
  const options = { knex: transaction, accountability, schema };
  const publicationReader = new services.ItemsService<ExistingPublication>('published_articles', options);
  const publicationWriter = new services.ItemsService<PublishedArticleRecord>('published_articles', options);
  const referenceWriter = new services.ItemsService<PublishedReferenceRecord>('published_references', options);
  const imageWriter = new services.ItemsService<PublishedImageRecord>('published_images', options);
  const assets = new services.AssetsService(options);

  const [existing] = await publicationReader.readByQuery({
    filter: { article: { _eq: plan.article.article } },
    fields: ['id', 'images.public_file_name'],
    deep: { images: { _limit: -1 } },
    limit: 1,
  });
  const publishedArticleId = await saveArticle(publicationWriter, existing, plan.article, publishedAt);
  const childrenOfPublication: Query = { filter: { published_article: { _eq: publishedArticleId } }, limit: -1 };
  await referenceWriter.deleteByQuery(childrenOfPublication);
  await imageWriter.deleteByQuery(childrenOfPublication);
  await copyImages(assets, mediaStore, plan.images);
  await referenceWriter.createMany(plan.references.map((reference) => ({ ...reference, published_article: publishedArticleId })));
  await imageWriter.createMany(plan.images.map((image) => ({ ...image.values, published_article: publishedArticleId })));
  return replacedFileNames(existing);
}

async function saveArticle(
  writer: AbstractService<PublishedArticleRecord>,
  existing: ExistingPublication | undefined,
  article: PublishedArticleValues,
  publishedAt: Date,
): Promise<string> {
  if (existing !== undefined) {
    await writer.updateOne(existing.id, article);
    return existing.id;
  }
  const createdKey = await writer.createOne({ ...article, first_published_at: publishedAt.toISOString() });
  return requireStringKey(createdKey);
}

function requireStringKey(key: PrimaryKey): string {
  if (typeof key !== 'string') {
    throw new PublicationError({ reason: `identifiant de version publiée inattendu (${String(key)})` });
  }
  return key;
}

async function copyImages(assets: AssetReader, mediaStore: PublicMediaStore, images: PlannedImage[]): Promise<void> {
  for (const image of images) {
    const asset = await assets.getAsset(image.sourceFileId, PUBLIC_IMAGE_TRANSFORMATION);
    await mediaStore.write(image.values.public_file_name, asset.stream);
  }
}

function replacedFileNames(existing: ExistingPublication | undefined): string[] {
  if (existing === undefined) {
    return [];
  }
  return existing.images.map((image) => image.public_file_name);
}

async function removePublicFiles(dependencies: PublishDependencies, fileNames: string[]): Promise<void> {
  const results = await Promise.allSettled(fileNames.map((fileName) => dependencies.mediaStore.remove(fileName)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      dependencies.logger.warn({ err: result.reason }, `Public file not removed: ${fileNames[index] ?? ''}`);
    }
  });
}

function toPublicationFailure(error: unknown): unknown {
  if (isDirectusError(error, 'FORBIDDEN') || isDirectusError(error, 'PUBLICATION_FAILED')) {
    return error;
  }
  if (isDirectusError(error, 'RECORD_NOT_UNIQUE')) {
    return new PublicationError({ reason: 'cet identifiant d’URL est déjà utilisé par un autre article publié' });
  }
  return new PublicationError({ reason: describeError(error) });
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\.$/, '');
  }
  return 'erreur inconnue';
}
