import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PublicationError } from '../errors.ts';
import { createFileSystemMediaStore } from './public-media-store.ts';

const FILE_NAME = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e.webp';

async function withTemporaryDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'public-media-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function content(text: string): Readable {
  return Readable.from([Buffer.from(text)]);
}

describe('createFileSystemMediaStore', () => {
  it('writes a public copy under its generated name', async () => {
    await withTemporaryDirectory(async (directory) => {
      await createFileSystemMediaStore(directory).write(FILE_NAME, content('image'));

      expect(await readFile(join(directory, FILE_NAME), 'utf8')).toBe('image');
    });
  });

  it('never overwrites an existing copy', async () => {
    await withTemporaryDirectory(async (directory) => {
      const store = createFileSystemMediaStore(directory);
      await store.write(FILE_NAME, content('première'));

      await expect(store.write(FILE_NAME, content('seconde'))).rejects.toThrow('EEXIST');
    });
  });

  it('removes a copy and accepts removing a missing one', async () => {
    await withTemporaryDirectory(async (directory) => {
      const store = createFileSystemMediaStore(directory);
      await store.write(FILE_NAME, content('image'));
      await store.remove(FILE_NAME);
      await store.remove(FILE_NAME);

      expect(await readdir(directory)).toEqual([]);
    });
  });

  it.each(['../evasion.webp', 'photo.jpg', `${FILE_NAME}/../../etc/passwd`, ''])('refuses the file name "%s"', async (fileName) => {
    await withTemporaryDirectory(async (directory) => {
      const store = createFileSystemMediaStore(directory);

      await expect(store.write(fileName, content('x'))).rejects.toThrow(PublicationError);
      await expect(store.remove(fileName)).rejects.toThrow(PublicationError);
    });
  });
});
