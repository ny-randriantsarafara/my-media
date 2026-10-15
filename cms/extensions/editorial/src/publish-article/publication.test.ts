import { describe, expect, it } from 'vitest';
import { PublicationError } from '../errors.ts';
import { buildPublication } from './publication.ts';
import type { DraftArticle, DraftImage, DraftReference } from './publication.ts';

const publishedAt = new Date('2026-10-10T08:30:00.000Z');

function reference(title: string, sort: number | null): DraftReference {
  return { sort, organization: 'Insee', title, url: 'https://example.org', author: null, publication: null, published_on: '2026-09-01', note: null };
}

function image(fileId: string, sort: number | null, width: number | null, height: number | null, type: string | null): DraftImage {
  return { sort, alt: `Image ${fileId}`, caption: null, credit: 'Rédaction', file: { id: fileId, type, width, height } };
}

function draft(overrides: Partial<DraftArticle>): DraftArticle {
  return {
    id: 'article-1',
    title: 'Le budget local',
    slug: 'le-budget-local',
    summary: 'Chapô',
    body: 'Texte[^1]',
    byline: 'La rédaction',
    format: 'Enquête',
    section: 'section-1',
    references: [],
    images: [],
    ...overrides,
  };
}

function fileNames(...names: string[]): () => string {
  const queue = names.values();
  return () => {
    const next = queue.next();
    if (next.done === true) {
      throw new Error('No more test file names');
    }
    return next.value;
  };
}

describe('buildPublication', () => {
  it('copies the public article fields and stamps the publication time', () => {
    const plan = buildPublication(draft({}), publishedAt, fileNames());

    expect(plan.article).toEqual({
      article: 'article-1',
      slug: 'le-budget-local',
      title: 'Le budget local',
      summary: 'Chapô',
      body: 'Texte[^1]',
      byline: 'La rédaction',
      format: 'Enquête',
      section: 'section-1',
      last_published_at: '2026-10-10T08:30:00.000Z',
    });
  });

  it('orders sources by position, puts unpositioned ones last and renumbers from 1', () => {
    const plan = buildPublication(
      draft({ references: [reference('Sans position', null), reference('Deuxième', 7), reference('Première', 3)] }),
      publishedAt,
      fileNames(),
    );

    expect(plan.references.map((item) => [item.sort, item.title])).toEqual([
      [1, 'Première'],
      [2, 'Deuxième'],
      [3, 'Sans position'],
    ]);
  });

  it('only copies public reference and image fields', () => {
    const plan = buildPublication(
      draft({ references: [reference('Rapport', 1)], images: [image('file-1', 1, 800, 600, 'image/jpeg')] }),
      publishedAt,
      fileNames('a.webp'),
    );

    expect(Object.keys(plan.references[0] ?? {}).toSorted()).toEqual(
      ['author', 'note', 'organization', 'published_on', 'publication', 'sort', 'title', 'url'].toSorted(),
    );
    expect(Object.keys(plan.images[0]?.values ?? {}).toSorted()).toEqual(
      ['alt', 'caption', 'credit', 'height', 'public_file_name', 'sort', 'width'].toSorted(),
    );
  });

  it('gives each image a fresh public file name in display order', () => {
    const plan = buildPublication(
      draft({ images: [image('second', 2, 800, 600, 'image/png'), image('first', 1, 800, 600, 'image/jpeg')] }),
      publishedAt,
      fileNames('one.webp', 'two.webp'),
    );

    expect(plan.images.map((item) => [item.sourceFileId, item.values.sort, item.values.public_file_name])).toEqual([
      ['first', 1, 'one.webp'],
      ['second', 2, 'two.webp'],
    ]);
  });

  it('scales wide images to 2000 pixels and keeps the ratio', () => {
    const plan = buildPublication(
      draft({ images: [image('wide', 1, 4000, 3000, 'image/jpeg'), image('small', 2, 1200, 900, 'image/webp')] }),
      publishedAt,
      fileNames('wide.webp', 'small.webp'),
    );

    expect(plan.images.map((item) => [item.values.width, item.values.height])).toEqual([
      [2000, 1500],
      [1200, 900],
    ]);
  });

  it('refuses an unsupported file type with a readable reason', () => {
    const action = () => buildPublication(draft({ images: [image('doc', 1, 100, 100, 'application/pdf')] }), publishedAt, fileNames('x.webp'));

    expect(action).toThrow(PublicationError);
    expect(action).toThrow('n’est pas pris en charge');
  });

  it('refuses an image whose dimensions are unknown', () => {
    const action = () => buildPublication(draft({ images: [image('broken', 1, null, null, 'image/png')] }), publishedAt, fileNames('x.webp'));

    expect(action).toThrow('dimensions');
  });
});
