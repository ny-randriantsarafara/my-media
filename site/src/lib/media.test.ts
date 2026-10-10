import { describe, expect, it } from 'vitest';
import { publicFilePath } from './media.ts';

const PUBLISHED_NAME = '3f2b8c1e-5a4d-4b7e-9c21-8d6f0a1b2c3d.webp';

describe('publicFilePath', () => {
  it('resolves a published file name inside the media directory', () => {
    expect(publicFilePath('/srv/public-media', PUBLISHED_NAME)).toBe(`/srv/public-media/${PUBLISHED_NAME}`);
  });

  it.each(['../secret.webp', '../../etc/passwd', 'photo.png', PUBLISHED_NAME.toUpperCase(), `dossier/${PUBLISHED_NAME}`, ''])(
    'refuses %s',
    (name) => {
      expect(publicFilePath('/srv/public-media', name)).toBeNull();
    },
  );
});
