import { randomUUID } from 'node:crypto';
import { expect, test } from './support/test.ts';

test('shows title, summary, byline, date and sources', async ({ page, seed }) => {
  const response = await page.goto(`/articles/${seed.articleSlug}`);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(`${seed.articleTitle} — ${seed.mediaName}`);
  await expect(page.getByRole('heading', { level: 1, name: seed.articleTitle })).toBeVisible();
  await expect(page.getByText(seed.articleSummary)).toBeVisible();
  await expect(page.getByText('Camille Durand', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Publié le/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Sources et documents' })).toBeVisible();
  await expect(page.locator('#sources li')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Rapport public annuel 2026' })).toHaveAttribute('href', 'https://www.ccomptes.fr/');
  await expect(page.locator('#source-1')).toContainText('Cour des comptes · 12 mars 2026');
});

test('jumps from a source call to its source', async ({ page, seed }) => {
  await page.goto(`/articles/${seed.articleSlug}`);

  await page.getByRole('link', { name: 'Source 1', exact: true }).click();

  await expect(page).toHaveURL(/#source-1$/);
  await expect(page.locator('#source-1')).toContainText('Rapport public annuel 2026');
});

test('serves the lead and body images from the site', async ({ page, seed }) => {
  await page.goto(`/articles/${seed.articleSlug}`);
  const leadImage = page.getByRole('img', { name: 'Une assemblée de quartier' });
  const bodyImage = page.getByRole('img', { name: seed.bodyImageAlt });

  await expect(leadImage).toHaveAttribute('src', /^\/media\/[0-9a-f-]{36}\.webp$/);
  await bodyImage.scrollIntoViewIfNeeded();
  for (const image of [leadImage, bodyImage]) {
    await expect.poll(() => image.evaluate((element) => element instanceof HTMLImageElement && element.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('figure.body-figure figcaption')).toContainText('Les montants votés');
});

test('never shows private editorial data', async ({ page, seed }) => {
  await page.goto(`/articles/${seed.articleSlug}`);
  const html = await page.content();

  for (const privateText of seed.privateTexts) {
    expect(html).not.toContain(privateText);
  }
});

test('answers 404 for a draft or unknown slug', async ({ page, seed }) => {
  for (const slug of [seed.draftSlug, 'slug-inconnu-e2e']) {
    const response = await page.goto(`/articles/${slug}`);

    expect(response?.status(), slug).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
    await expect(page.getByText(seed.draftTitle)).toHaveCount(0);
  }
});

test('serves only published media file names', async ({ request }) => {
  for (const path of ['/media/inconnu.webp', '/media/..%2F..%2Fpackage.json', `/media/${randomUUID()}.webp`]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});
