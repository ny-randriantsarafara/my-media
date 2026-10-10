import { PublicationError } from '../errors.ts';

export type DraftImageFile = {
  id: string;
  type: string | null;
  width: number | null;
  height: number | null;
};

export type DraftReference = {
  sort: number | null;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

export type DraftImage = {
  sort: number | null;
  alt: string;
  caption: string | null;
  credit: string | null;
  file: DraftImageFile;
};

export type DraftArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | null;
  references: DraftReference[];
  images: DraftImage[];
};

export type PublishedArticleValues = {
  article: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | null;
  last_published_at: string;
};

export type PublishedReferenceValues = {
  sort: number;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

export type PublishedImageValues = {
  sort: number;
  public_file_name: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type PlannedImage = { sourceFileId: string; values: PublishedImageValues };

export type PublicationPlan = {
  article: PublishedArticleValues;
  references: PublishedReferenceValues[];
  images: PlannedImage[];
};

type Dimensions = { width: number; height: number };

export const PUBLIC_IMAGE_MAX_WIDTH = 2000;

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function buildPublication(draft: DraftArticle, publishedAt: Date, createPublicFileName: () => string): PublicationPlan {
  return {
    article: {
      article: draft.id,
      slug: draft.slug,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      byline: draft.byline,
      format: draft.format,
      section: draft.section,
      last_published_at: publishedAt.toISOString(),
    },
    references: sortByPosition(draft.references).map((reference, index) => toPublishedReference(reference, index + 1)),
    images: sortByPosition(draft.images).map((image, index) => planImage(image, index + 1, createPublicFileName())),
  };
}

function sortByPosition<T extends { sort: number | null }>(items: T[]): T[] {
  return items.toSorted((first, second) => position(first) - position(second));
}

function position(item: { sort: number | null }): number {
  return item.sort ?? Number.MAX_SAFE_INTEGER;
}

function toPublishedReference(reference: DraftReference, sort: number): PublishedReferenceValues {
  return {
    sort,
    organization: reference.organization,
    title: reference.title,
    url: reference.url,
    author: reference.author,
    publication: reference.publication,
    published_on: reference.published_on,
    note: reference.note,
  };
}

function planImage(image: DraftImage, sort: number, publicFileName: string): PlannedImage {
  const dimensions = publicDimensions(image.file);
  return {
    sourceFileId: image.file.id,
    values: {
      sort,
      public_file_name: publicFileName,
      width: dimensions.width,
      height: dimensions.height,
      alt: image.alt,
      caption: image.caption,
      credit: image.credit,
    },
  };
}

function publicDimensions(file: DraftImageFile): Dimensions {
  if (file.type === null || !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new PublicationError({ reason: `le format de l’image ${file.id} n’est pas pris en charge (${file.type ?? 'inconnu'})` });
  }
  if (file.width === null || file.height === null) {
    throw new PublicationError({ reason: `les dimensions de l’image ${file.id} sont inconnues` });
  }
  if (file.width <= PUBLIC_IMAGE_MAX_WIDTH) {
    return { width: file.width, height: file.height };
  }
  return {
    width: PUBLIC_IMAGE_MAX_WIDTH,
    height: Math.round((file.height * PUBLIC_IMAGE_MAX_WIDTH) / file.width),
  };
}
