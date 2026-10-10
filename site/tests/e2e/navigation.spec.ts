import { expect, test } from './support/test.ts';

test('a section page lists its published articles', async ({ page, seed }) => {
  const response = await page.goto(`/rubriques/${seed.sectionSlug}`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: seed.sectionName })).toBeVisible();
  await expect(page.getByRole('link', { name: seed.articleTitle })).toHaveAttribute('href', `/articles/${seed.articleSlug}`);
  await expect(page.getByRole('navigation', { name: 'Rubriques' }).getByRole('link', { name: seed.sectionName })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('an unknown section answers 404', async ({ page }) => {
  const response = await page.goto('/rubriques/rubrique-inconnue');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
});

test('search finds a published article and ignores drafts', async ({ page, seed }) => {
  await page.goto('/recherche');

  await page.getByRole('searchbox', { name: 'Rechercher dans les articles publiés' }).fill(seed.suffix);
  await page.getByRole('button', { name: 'Rechercher' }).click();

  await expect(page).toHaveURL(new RegExp(`/recherche\\?q=${seed.suffix}$`));
  await expect(page.getByRole('heading', { level: 2, name: `Résultats pour « ${seed.suffix} »` })).toBeVisible();
  await expect(page.getByRole('link', { name: seed.articleTitle })).toBeVisible();
  await expect(page.getByText(seed.draftTitle)).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('a word that exists only in a draft finds nothing', async ({ page, seed }) => {
  await page.goto(`/recherche?q=${seed.draftOnlyWord}`);

  await expect(page.getByText(`Aucun article publié ne correspond à « ${seed.draftOnlyWord} ».`)).toBeVisible();
});

test('an empty search lists all published articles', async ({ page, seed }) => {
  await page.goto('/recherche');

  await expect(page.getByRole('heading', { level: 2, name: 'Tous les articles' })).toBeVisible();
  await expect(page.getByRole('link', { name: seed.articleTitle })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('the about page presents the media, its contact and the legal notice', async ({ page }) => {
  await page.goto('/a-propos');

  await expect(page.getByRole('heading', { level: 1, name: 'À propos' })).toBeVisible();
  await expect(page.getByText('Un média indépendant d’essai, sourcé et lisible.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'contact@example.com' })).toHaveAttribute('href', 'mailto:contact@example.com');
  await expect(page.locator('#mentions-legales')).toContainText('Directeur de la publication');
});

test('the footer leads to the legal notice', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('contentinfo').getByRole('link', { name: 'Mentions légales' }).click();

  await expect(page).toHaveURL(/\/a-propos#mentions-legales$/);
});
