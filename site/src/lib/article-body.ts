import MarkdownIt from 'markdown-it';
import type { MarkdownIt as MarkdownItInstance, StateBlock, StateInline } from 'markdown-it';
import { renderFigure } from './figure.ts';
import type { FigureImage } from './view-models.ts';

export type ArticleBodyContext = { sourceCount: number; images: FigureImage[] };

const REFERENCE_CALL = /^\[\^(\d{1,3})\]/;
const IMAGE_PLACEMENT = /^\[\[image:(\d{1,3})\]\]\s*$/;
const FIRST_PLACEABLE_IMAGE = 2;
const NO_MARKERS: ArticleBodyContext = { sourceCount: 0, images: [] };

export function renderArticleBody(markdown: string, context: ArticleBodyContext): string {
  return createRenderer(context).render(markdown);
}

export function renderMarkdown(markdown: string): string {
  return renderArticleBody(markdown, NO_MARKERS);
}

function createRenderer(context: ArticleBodyContext): MarkdownItInstance {
  const markdownIt = new MarkdownIt({ html: false, linkify: true, typographer: false });
  markdownIt.inline.ruler.before('link', 'reference_call', referenceCallRule);
  markdownIt.block.ruler.before('paragraph', 'image_placement', imagePlacementRule, { alt: ['paragraph'] });
  markdownIt.renderer.rules['reference_call'] = (tokens, index) =>
    renderReferenceCall(readNumber(tokens[index]?.meta), context.sourceCount);
  markdownIt.renderer.rules['image_placement'] = (tokens, index) => renderPlacedImage(readNumber(tokens[index]?.meta), context.images);
  return markdownIt;
}

function referenceCallRule(state: StateInline, silent: boolean): boolean {
  const match = REFERENCE_CALL.exec(state.src.slice(state.pos));
  if (match === null) {
    return false;
  }
  if (!silent) {
    const token = state.push('reference_call', '', 0);
    token.meta = { number: Number(match[1]) };
  }
  state.pos += match[0].length;
  return true;
}

function imagePlacementRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const lineStart = (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
  const lineEnd = state.eMarks[startLine] ?? lineStart;
  const match = IMAGE_PLACEMENT.exec(state.src.slice(lineStart, lineEnd));
  if (match === null) {
    return false;
  }
  if (silent) {
    return true;
  }
  const token = state.push('image_placement', '', 0);
  token.meta = { number: Number(match[1]) };
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

function readNumber(meta: Record<string, unknown> | null | undefined): number | null {
  const value = meta?.['number'];
  if (typeof value !== 'number') {
    return null;
  }
  return value;
}

function renderReferenceCall(number: number | null, sourceCount: number): string {
  if (number === null || number < 1 || number > sourceCount) {
    return '';
  }
  return `<a class="reference" href="#source-${number}" aria-label="Source ${number}">${number}</a>`;
}

function renderPlacedImage(number: number | null, images: FigureImage[]): string {
  if (number === null || number < FIRST_PLACEABLE_IMAGE) {
    return '';
  }
  const image = images[number - 1];
  if (image === undefined) {
    return '';
  }
  return renderFigure(image, { className: 'body-figure', loading: 'lazy' });
}
