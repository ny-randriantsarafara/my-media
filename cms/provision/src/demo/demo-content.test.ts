import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { demoArticles, demoSections } from './demo-content.ts';
import { gradientPng } from './png.ts';

describe('demo content', () => {
  it('places every article in a declared section, with unique slugs and keys', () => {
    const sections = new Set(demoSections.map((section) => section.slug));
    expect(demoArticles.every((article) => sections.has(article.sectionSlug))).toBe(true);
    expect(new Set(demoArticles.map((article) => article.slug)).size).toBe(demoArticles.length);
    expect(new Set(demoArticles.map((article) => article.key)).size).toBe(demoArticles.length);
  });

  it('has exactly one lead article', () => {
    expect(demoArticles.filter((article) => article.placement === 'lead')).toHaveLength(1);
  });

  it('cites only existing references and images', () => {
    for (const article of demoArticles) {
      const notes = [...article.body.matchAll(/\[\^(\d+)\]/g)].map((match) => Number(match[1]));
      const images = [...article.body.matchAll(/\[\[image:(\d+)\]\]/g)].map((match) => Number(match[1]));
      expect(notes.every((note) => note >= 1 && note <= article.references.length), article.key).toBe(true);
      expect(images.every((image) => image >= 2 && image <= article.images.length), article.key).toBe(true);
      expect(article.images.length, article.key).toBeGreaterThan(0);
    }
  });

  it('never mentions artificial intelligence, as the public site forbids', () => {
    const text = JSON.stringify(demoArticles);
    expect(text).not.toMatch(/\bIA\b/);
    expect(text).not.toMatch(/intelligence artificielle|chatgpt|openai|anthropic|généré automatiquement|assistant/i);
  });
});

describe('gradientPng', () => {
  it('writes a valid RGB PNG of the requested size', () => {
    const png = Buffer.from(gradientPng(4, 3, [0, 0, 0], [255, 255, 255]));

    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(4);
    expect(png.readUInt32BE(20)).toBe(3);
    const dataLength = png.readUInt32BE(33);
    const pixels = inflateSync(png.subarray(41, 41 + dataLength));
    expect(pixels).toHaveLength(3 * (1 + 4 * 3));
    expect([...pixels.subarray(1, 4)]).toEqual([0, 0, 0]);
    expect([...pixels.subarray(27, 30)]).toEqual([255, 255, 255]);
  });
});
