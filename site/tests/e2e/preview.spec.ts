import { e2eEnvironment } from './support/environment.ts';
import { signInToDirectus } from './support/directus-session.ts';
import { expect, test } from './support/test.ts';

test('an anonymous visitor cannot preview a draft', async ({ page, seed }) => {
  const response = await page.goto(`/apercu/${seed.draftId}`);

  expect(response?.status()).toBe(404);
  expect(response?.headers()['cache-control']).toBe('private, no-store');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.getByText(seed.draftTitle)).toHaveCount(0);
});

test('an editor signed in to Directus previews the draft, unindexed and uncached', async ({ page, context, request, seed }) => {
  const sessionToken = await signInToDirectus(request);
  await context.addCookies([{ name: 'directus_session_token', value: sessionToken, url: e2eEnvironment.siteUrl }]);

  const response = await page.goto(`/apercu/${seed.draftId}`);

  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toBe('private, no-store');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.getByRole('status')).toHaveText('Aperçu du brouillon — non publié');
  await expect(page.getByRole('heading', { level: 1, name: seed.draftTitle })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('a malformed preview address answers 404 even when signed in', async ({ page, context, request }) => {
  const sessionToken = await signInToDirectus(request);
  await context.addCookies([{ name: 'directus_session_token', value: sessionToken, url: e2eEnvironment.siteUrl }]);

  const response = await page.goto('/apercu/pas-un-identifiant');

  expect(response?.status()).toBe(404);
  expect(response?.headers()['cache-control']).toBe('private, no-store');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
});
