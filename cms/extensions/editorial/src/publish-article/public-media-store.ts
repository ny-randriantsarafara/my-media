import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PublicationError } from '../errors.ts';

export type PublicMediaStore = {
  write(fileName: string, content: Readable): Promise<void>;
  remove(fileName: string): Promise<void>;
};

const PUBLIC_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function createFileSystemMediaStore(directory: string): PublicMediaStore {
  return {
    async write(fileName, content) {
      const path = resolvePublicFile(directory, fileName);
      await pipeline(content, createWriteStream(path, { flags: 'wx' }));
    },
    async remove(fileName) {
      const path = resolvePublicFile(directory, fileName);
      await rm(path, { force: true });
    },
  };
}

function resolvePublicFile(directory: string, fileName: string): string {
  if (!PUBLIC_FILE_NAME.test(fileName)) {
    throw new PublicationError({ reason: `nom de fichier public refusé « ${fileName} »` });
  }
  return join(directory, fileName);
}
