import { z } from 'zod';

export const SEED_VARIABLE = 'E2E_SEED';

const seedData = z.object({
  mediaName: z.string(),
  suffix: z.string(),
  sectionName: z.string(),
  sectionSlug: z.string(),
  articleSlug: z.string(),
  articleTitle: z.string(),
  articleSummary: z.string(),
  bodyImageAlt: z.string(),
  draftId: z.string(),
  draftSlug: z.string(),
  draftTitle: z.string(),
  draftOnlyWord: z.string(),
  privateTexts: z.array(z.string()),
});

export type SeedData = z.infer<typeof seedData>;

export function readSeedData(): SeedData {
  const serialized = process.env[SEED_VARIABLE];
  if (serialized === undefined) {
    throw new Error(`${SEED_VARIABLE} is missing: Playwright global setup did not run.`);
  }
  const parsed: unknown = JSON.parse(serialized);
  return seedData.parse(parsed);
}
