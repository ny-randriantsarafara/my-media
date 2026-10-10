import { escapeHtml } from './html.ts';
import type { FigureImage } from './view-models.ts';

type FigureOptions = { className: string; loading: 'eager' | 'lazy' };

export function renderFigure(image: FigureImage, options: FigureOptions): string {
  const source = escapeHtml(image.src);
  const alternative = escapeHtml(image.alt);
  return `<figure class="${options.className}"><img src="${source}" alt="${alternative}"${renderDimensions(image)} loading="${options.loading}" decoding="async">${renderCaption(image)}</figure>`;
}

function renderDimensions(image: FigureImage): string {
  if (image.width === null || image.height === null) {
    return '';
  }
  return ` width="${image.width}" height="${image.height}"`;
}

function renderCaption(image: FigureImage): string {
  const parts = [renderCaptionText(image.caption), renderCredit(image.credit)].filter((part) => part !== '');
  if (parts.length === 0) {
    return '';
  }
  return `<figcaption>${parts.join(' ')}</figcaption>`;
}

function renderCaptionText(caption: string | null): string {
  if (caption === null) {
    return '';
  }
  return escapeHtml(caption);
}

function renderCredit(credit: string | null): string {
  if (credit === null || credit === '') {
    return '';
  }
  return `<span class="credit">${escapeHtml(credit)}</span>`;
}
