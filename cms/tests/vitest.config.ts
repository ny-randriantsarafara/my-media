import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const environmentFile = fileURLToPath(new URL('../../.env', import.meta.url));

if (!existsSync(environmentFile)) {
  throw new Error('Fichier .env absent : copiez .env.example vers .env à la racine du dépôt.');
}

export default defineConfig({
  test: {
    env: parseEnv(readFileSync(environmentFile, 'utf8')),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
