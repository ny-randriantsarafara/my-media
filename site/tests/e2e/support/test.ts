import { test as base } from '@playwright/test';
import { readSeedData } from './seed-data.ts';
import type { SeedData } from './seed-data.ts';

export const test = base.extend<{ seed: SeedData }>({
  seed: async ({}, use) => {
    await use(readSeedData());
  },
});

export { expect } from '@playwright/test';
