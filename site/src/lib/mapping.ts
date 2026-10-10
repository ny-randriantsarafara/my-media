import type {
  ArticleCardRecord,
  DraftArticleRecord,
  HomeFeatureRecord,
  PublishedArticleRecord,
  PublishedImageRecord,
  SiteSettingsRecord,
} from './cms-records.ts';
import { formatCalendarDate } from './dates.ts';
import type { ArticleCard, ArticleSource, ArticleView, FigureImage, HomePage, SectionLink, SiteIdentity } from './view-models.ts';

type SectionValue = { name: string; slug: string } | null;

type ReferenceValue = {
  sort: number | null;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

const DEFAULT_MEDIA_NAME = 'Média';
const SELECTION_SIZE = 3;
const WEB_PROTOCOLS = ['http:', 'https:'];

export function sectionHref(slug: string): string {
  return `/rubriques/${slug}`;
}

export function toSectionLink(section: SectionValue): SectionLink | null {
  if (section === null) {
    return null;
  }
  return { name: section.name, href: sectionHref(section.slug) };
}

export function toArticleCard(record: ArticleCardRecord): ArticleCard {
  return {
    href: `/articles/${record.slug}`,
    title: record.title,
    summary: record.summary,
    byline: record.byline,
    kicker: record.format ?? record.section?.name ?? null,
    section: toSectionLink(record.section),
    publishedAt: new Date(record.first_published_at),
    image: firstFigure(record.images),
  };
}

export function toPublishedArticleView(record: PublishedArticleRecord): ArticleView {
  return {
    title: record.title,
    summary: record.summary,
    body: record.body ?? '',
    byline: record.byline,
    kicker: record.format ?? record.section?.name ?? null,
    section: toSectionLink(record.section),
    firstPublishedAt: new Date(record.first_published_at),
    lastPublishedAt: new Date(record.last_published_at),
    images: bySortPosition(record.images).map(toPublishedFigure),
    sources: toSources(record.references),
  };
}

export function toDraftArticleView(record: DraftArticleRecord, directusPublicUrl: string): ArticleView {
  return {
    title: record.title,
    summary: record.summary,
    body: record.body ?? '',
    byline: record.byline,
    kicker: record.format ?? record.section?.name ?? null,
    section: toSectionLink(record.section),
    firstPublishedAt: null,
    lastPublishedAt: null,
    images: bySortPosition(record.images).map((image) => ({
      src: `${directusPublicUrl}/assets/${image.file.id}?width=2000&format=webp`,
      width: image.file.width,
      height: image.file.height,
      alt: image.alt,
      caption: image.caption,
      credit: image.credit,
    })),
    sources: toSources(record.references),
  };
}

export function toSiteIdentity(record: SiteSettingsRecord | null): SiteIdentity {
  return {
    mediaName: record?.media_name ?? DEFAULT_MEDIA_NAME,
    editionLabel: record?.edition_label ?? null,
    presentation: record?.presentation ?? null,
    aboutBody: record?.about_body ?? null,
    contactEmail: record?.contact_email ?? null,
    legalNotice: record?.legal_notice ?? null,
  };
}

export function buildHomePage(features: HomeFeatureRecord[], recent: ArticleCardRecord[]): HomePage {
  const lead = chooseLead(features, recent);
  return {
    lead: mapOptional(lead, toArticleCard),
    selection: chooseSelection(features, recent, lead).map(toArticleCard),
    recent: recent.map(toArticleCard),
  };
}

export function wasUpdated(article: ArticleView): boolean {
  if (article.firstPublishedAt === null || article.lastPublishedAt === null) {
    return false;
  }
  return article.lastPublishedAt.getTime() !== article.firstPublishedAt.getTime();
}

export function composeDocumentTitle(title: string | null, mediaName: string): string {
  if (title === null) {
    return mediaName;
  }
  return `${title} — ${mediaName}`;
}

export function safeExternalUrl(url: string | null): string | null {
  if (url === null || !URL.canParse(url)) {
    return null;
  }
  if (!WEB_PROTOCOLS.includes(new URL(url).protocol)) {
    return null;
  }
  return url;
}

function chooseLead(features: HomeFeatureRecord[], recent: ArticleCardRecord[]): ArticleCardRecord | null {
  const featured = features.find((feature) => feature.placement === 'lead');
  if (featured !== undefined) {
    return featured.published_article;
  }
  return recent[0] ?? null;
}

function chooseSelection(features: HomeFeatureRecord[], recent: ArticleCardRecord[], lead: ArticleCardRecord | null): ArticleCardRecord[] {
  const featured = features.filter((feature) => feature.placement === 'selection').map((feature) => feature.published_article);
  if (featured.length > 0) {
    return featured.slice(0, SELECTION_SIZE);
  }
  return recent.filter((article) => article.slug !== lead?.slug).slice(0, SELECTION_SIZE);
}

function mapOptional<T, R>(value: T | null, map: (input: T) => R): R | null {
  if (value === null) {
    return null;
  }
  return map(value);
}

function bySortPosition<T extends { sort: number | null }>(items: T[]): T[] {
  return items.toSorted((first, second) => (first.sort ?? Number.MAX_SAFE_INTEGER) - (second.sort ?? Number.MAX_SAFE_INTEGER));
}

function firstFigure(images: PublishedImageRecord[]): FigureImage | null {
  const [first] = bySortPosition(images);
  return mapOptional(first ?? null, toPublishedFigure);
}

function toPublishedFigure(image: PublishedImageRecord): FigureImage {
  return {
    src: `/media/${image.public_file_name}`,
    width: image.width,
    height: image.height,
    alt: image.alt,
    caption: image.caption,
    credit: image.credit,
  };
}

function toSources(references: ReferenceValue[]): ArticleSource[] {
  return bySortPosition(references).map((reference, index) => ({
    number: index + 1,
    anchor: `source-${index + 1}`,
    organization: reference.organization,
    title: reference.title,
    url: safeExternalUrl(reference.url),
    details: describeReference(reference),
    note: reference.note,
  }));
}

function describeReference(reference: ReferenceValue): string | null {
  const parts = [reference.author, reference.publication, mapOptional(reference.published_on, formatCalendarDate)].filter(
    (part) => part !== null && part !== '',
  );
  if (parts.length === 0) {
    return null;
  }
  return parts.join(' · ');
}
