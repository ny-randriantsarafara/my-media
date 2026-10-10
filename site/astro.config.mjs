import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';

const repositoryRoot = new URL('../', import.meta.url);

// Development shares the repository .env, whose relative paths start at the repository root.
function useRepositoryEnvironment() {
  const environmentFile = new URL('.env', repositoryRoot);
  if (!existsSync(environmentFile)) {
    return;
  }
  process.loadEnvFile(fileURLToPath(environmentFile));
  const mediaDirectory = process.env.PUBLIC_MEDIA_DIR;
  if (mediaDirectory === undefined || isAbsolute(mediaDirectory)) {
    return;
  }
  process.env.PUBLIC_MEDIA_DIR = fileURLToPath(new URL(mediaDirectory, repositoryRoot));
}

useRepositoryEnvironment();

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  session: false,
  compressHTML: true,
  env: {
    schema: {
      DIRECTUS_URL: envField.string({ context: 'server', access: 'secret' }),
      DIRECTUS_PUBLIC_URL: envField.string({ context: 'server', access: 'secret' }),
      PUBLIC_MEDIA_DIR: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
