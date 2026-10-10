import { describe, expect, it } from 'vitest';
import { renderArticleBody, renderMarkdown } from './article-body.ts';
import { renderFigure } from './figure.ts';
import type { FigureImage } from './view-models.ts';

const leadImage: FigureImage = { src: '/media/une.webp', width: 1200, height: 800, alt: 'Image principale', caption: null, credit: null };
const bodyImage: FigureImage = {
  src: '/media/corps.webp',
  width: 1000,
  height: 600,
  alt: 'Salle du conseil',
  caption: 'Le conseil réuni',
  credit: 'Rédaction',
};
const images: FigureImage[] = [leadImage, bodyImage];

describe('renderArticleBody', () => {
  it('renders Markdown paragraphs and headings', () => {
    const html = renderArticleBody('Premier paragraphe.\n\n## Intertitre', { sourceCount: 0, images: [] });

    expect(html).toContain('<p>Premier paragraphe.</p>');
    expect(html).toContain('<h2>Intertitre</h2>');
  });

  it('escapes raw HTML written in the text', () => {
    const html = renderArticleBody('<script>alert(1)</script>', { sourceCount: 0, images: [] });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('links a source call to its source', () => {
    const html = renderArticleBody('Un chiffre[^2].', { sourceCount: 2, images: [] });

    expect(html).toContain('<a class="reference" href="#source-2" aria-label="Source 2">2</a>');
  });

  it('drops a source call that points to no source', () => {
    const html = renderArticleBody('Un chiffre[^3].', { sourceCount: 2, images: [] });

    expect(html).toContain('<p>Un chiffre.</p>');
  });

  it('places image 2 where the marker stands alone on a line', () => {
    const html = renderArticleBody('Avant.\n\n[[image:2]]\n\nAprès.', { sourceCount: 0, images });

    expect(html).toContain('<figure class="body-figure"><img src="/media/corps.webp" alt="Salle du conseil" width="1000" height="600"');
    expect(html).toContain('<figcaption>Le conseil réuni <span class="credit">Rédaction</span></figcaption>');
  });

  it('places an image directly after a paragraph line', () => {
    const html = renderArticleBody('Avant.\n[[image:2]]', { sourceCount: 0, images });

    expect(html).toContain('<p>Avant.</p>');
    expect(html).toContain('class="body-figure"');
  });

  it('ignores the lead image, missing images and markers inside a sentence', () => {
    expect(renderArticleBody('[[image:1]]', { sourceCount: 0, images })).toBe('');
    expect(renderArticleBody('[[image:9]]', { sourceCount: 0, images })).toBe('');
    expect(renderArticleBody('Voir [[image:2]] ici.', { sourceCount: 0, images })).toContain('<p>Voir [[image:2]] ici.</p>');
  });
});

describe('renderFigure', () => {
  it('omits dimensions that are unknown', () => {
    const html = renderFigure({ ...bodyImage, width: null, height: null }, { className: 'lead-figure', loading: 'eager' });

    expect(html).not.toContain('width=');
    expect(html).toContain('loading="eager"');
  });

  it('escapes text coming from the CMS', () => {
    const html = renderFigure({ ...leadImage, alt: 'Un "titre" <b>' }, { className: 'lead-figure', loading: 'eager' });

    expect(html).toContain('alt="Un &quot;titre&quot; &lt;b&gt;"');
  });

  it('shows the credit alone when there is no caption', () => {
    const html = renderFigure({ ...leadImage, credit: 'Rédaction' }, { className: 'lead-figure', loading: 'eager' });

    expect(html).toContain('<figcaption><span class="credit">Rédaction</span></figcaption>');
  });
});

describe('renderMarkdown', () => {
  it('renders plain Markdown pages such as the about page', () => {
    expect(renderMarkdown('**Indépendant** et lisible.')).toBe('<p><strong>Indépendant</strong> et lisible.</p>\n');
  });
});
