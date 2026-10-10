import { describe, expect, it } from 'vitest';
import type { ArticleCardRecord, DraftArticleRecord, HomeFeatureRecord } from './cms-records.ts';
import { buildHomePage, composeDocumentTitle, safeExternalUrl, toArticleCard, toDraftArticleView, toSiteIdentity } from './mapping.ts';

function card(slug: string, overrides: Partial<ArticleCardRecord> = {}): ArticleCardRecord {
  return {
    slug,
    title: `Titre ${slug}`,
    summary: 'Chapô',
    byline: null,
    format: null,
    first_published_at: '2026-10-10T08:30:00.000Z',
    section: { name: 'Société', slug: 'societe' },
    images: [],
    ...overrides,
  };
}

function image(sort: number, fileName: string) {
  return { sort, public_file_name: fileName, width: 1200, height: 800, alt: `Image ${sort}`, caption: null, credit: null };
}

describe('toArticleCard', () => {
  it('links to the article, uses the format as kicker and the first image as lead', () => {
    const result = toArticleCard(card('budget', { format: 'Enquête', images: [image(2, 'b.webp'), image(1, 'a.webp')] }));

    expect(result.href).toBe('/articles/budget');
    expect(result.kicker).toBe('Enquête');
    expect(result.image?.src).toBe('/media/a.webp');
    expect(result.section).toEqual({ name: 'Société', href: '/rubriques/societe' });
  });

  it('falls back to the section name as kicker and keeps an empty byline empty', () => {
    const result = toArticleCard(card('budget'));

    expect(result.kicker).toBe('Société');
    expect(result.byline).toBeNull();
    expect(result.image).toBeNull();
  });
});

describe('buildHomePage', () => {
  const recent = [card('un'), card('deux'), card('trois'), card('quatre'), card('cinq')];

  it('uses the editorial lead and selection when they exist', () => {
    const features: HomeFeatureRecord[] = [
      { placement: 'selection', published_article: card('quatre') },
      { placement: 'lead', published_article: card('trois') },
    ];

    const home = buildHomePage(features, recent);

    expect(home.lead?.href).toBe('/articles/trois');
    expect(home.selection.map((item) => item.href)).toEqual(['/articles/quatre']);
    expect(home.recent).toHaveLength(5);
  });

  it('falls back to the most recent articles, without repeating the lead', () => {
    const home = buildHomePage([], recent);

    expect(home.lead?.href).toBe('/articles/un');
    expect(home.selection.map((item) => item.href)).toEqual(['/articles/deux', '/articles/trois', '/articles/quatre']);
  });

  it('has no lead when nothing is published', () => {
    expect(buildHomePage([], []).lead).toBeNull();
  });
});

describe('toDraftArticleView', () => {
  const draft: DraftArticleRecord = {
    title: 'Brouillon',
    summary: null,
    body: 'Texte[^1]',
    byline: null,
    format: 'Analyse',
    section: null,
    references: [
      { sort: 2, organization: null, title: 'Second', url: null, author: null, publication: null, published_on: null, note: null },
      { sort: 1, organization: 'Insee', title: 'Premier', url: 'https://www.insee.fr/', author: 'A. Martin', publication: 'Insee Première', published_on: '2026-03-12', note: null },
    ],
    images: [{ sort: 1, alt: 'Photo', caption: null, credit: null, file: { id: 'file-1', width: null, height: null } }],
  };

  it('numbers sources in order and describes them', () => {
    const view = toDraftArticleView(draft, 'http://cms.test');

    expect(view.sources.map((source) => [source.number, source.anchor, source.title])).toEqual([
      [1, 'source-1', 'Premier'],
      [2, 'source-2', 'Second'],
    ]);
    expect(view.sources[0]?.details).toBe('A. Martin · Insee Première · 12 mars 2026');
    expect(view.sources[1]?.details).toBeNull();
  });

  it('shows private draft images through the editor session on Directus', () => {
    const view = toDraftArticleView(draft, 'http://cms.test');

    expect(view.images[0]).toMatchObject({ src: 'http://cms.test/assets/file-1?width=2000&format=webp', width: null, height: null });
    expect(view.firstPublishedAt).toBeNull();
  });
});

describe('small helpers', () => {
  it('keeps only web links for sources', () => {
    expect(safeExternalUrl('https://example.org/rapport')).toBe('https://example.org/rapport');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('pas une adresse')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });

  it('composes the document title', () => {
    expect(composeDocumentTitle(null, 'La Revue')).toBe('La Revue');
    expect(composeDocumentTitle('Le budget', 'La Revue')).toBe('Le budget — La Revue');
  });

  it('uses a neutral name until the media name is set', () => {
    expect(toSiteIdentity(null).mediaName).toBe('Média');
  });
});
