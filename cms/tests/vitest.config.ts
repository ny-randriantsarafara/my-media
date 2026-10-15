import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const environmentFile = fileURLToPath(new URL('../../.env', import.meta.url));

if (!existsSync(environmentFile)) {
  throw new Error('Missing .env file: copy .env.example to .env at the repository root.');
}

export default defineConfig({
  test: {
    env: parseEnv(readFileSync(environmentFile, 'utf8')),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
