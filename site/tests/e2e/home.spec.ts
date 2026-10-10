import { expect, test } from './support/test.ts';

test('presents the media and its lead story', async ({ page, seed }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(seed.mediaName);
  await expect(page.getByRole('link', { name: seed.mediaName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: seed.articleTitle })).toBeVisible();
  await expect(page.getByText(seed.articleSummary).first()).toBeVisible();
});

test('lists sections, all articles and the about page in the navigation', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Rubriques' });

  await expect(navigation.getByRole('link', { name: 'À la une' })).toHaveAttribute('aria-current', 'page');
  await expect(navigation.getByRole('link', { name: 'Société' })).toHaveAttribute('href', '/rubriques/societe');
  await expect(navigation.getByRole('link', { name: 'Tous les articles' })).toHaveAttribute('href', '/recherche');
  await expect(navigation.getByRole('link', { name: 'À propos' })).toHaveAttribute('href', '/a-propos');
});

test('links recent articles to their page', async ({ page, seed }) => {
  await page.goto('/');
  const recent = page.getByRole('region', { name: 'Derniers articles' });

  await expect(recent.getByRole('link', { name: seed.articleTitle })).toHaveAttribute('href', `/articles/${seed.articleSlug}`);
});

test('answers 404 with a way back for an unknown address', async ({ page }) => {
  const response = await page.goto('/cette-page-n-existe-pas');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/');
});
