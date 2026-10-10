import type { SeedData } from './support/seed-data.ts';
import { expect, test } from './support/test.ts';

function publicPaths(seed: SeedData): string[] {
  return ['/', '/recherche', '/a-propos', `/articles/${seed.articleSlug}`, `/rubriques/${seed.sectionSlug}`];
}

test.describe('on a 390 px wide phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pages fit the screen without horizontal scrolling', async ({ page, seed }) => {
    for (const path of publicPaths(seed)) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('the article opens on its title and keeps a readable text size', async ({ page, seed }) => {
    await page.goto(`/articles/${seed.articleSlug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    const fontSize = await page
      .locator('.reading-body p')
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(17);
  });
});

test('the first Tab reaches the skip link, which moves focus to the content', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page.locator('main#contenu')).toBeFocused();
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const outlineStyle = await page.evaluate(() => {
    const focused = document.activeElement;
    if (focused === null) {
      return 'none';
    }
    return getComputedStyle(focused).outlineStyle;
  });

  expect(outlineStyle).toBe('solid');
});

test('every page is in French, has one main heading and describes its images', async ({ page, seed }) => {
  for (const path of publicPaths(seed)) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 }), path).toHaveCount(1);
    await expect(page.locator('img:not([alt])'), path).toHaveCount(0);
  }
});

test('public pages never mention artificial intelligence', async ({ page, seed }) => {
  for (const path of publicPaths(seed)) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const text = await page.locator('body').innerText();
    expect(text, path).not.toMatch(/\bIA\b/);
    expect(text, path).not.toMatch(/intelligence artificielle|chatgpt|openai|anthropic|généré automatiquement|assistant/i);
  }
});
