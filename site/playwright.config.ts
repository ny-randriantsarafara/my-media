import { defineConfig, devices } from '@playwright/test';
import { e2eEnvironment } from './tests/e2e/support/environment.ts';

const siteAddress = new URL(e2eEnvironment.siteUrl);

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: 'list',
  use: {
    baseURL: e2eEnvironment.siteUrl,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: e2eEnvironment.siteUrl,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      HOST: siteAddress.hostname,
      PORT: siteAddress.port,
      DIRECTUS_URL: e2eEnvironment.directusUrl,
      DIRECTUS_PUBLIC_URL: e2eEnvironment.directusPublicUrl,
      PUBLIC_MEDIA_DIR: e2eEnvironment.publicMediaDirectory,
    },
  },
});
