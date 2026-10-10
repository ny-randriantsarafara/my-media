import { join } from 'node:path';

const PUBLIC_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isPublicFileName(name: string): boolean {
  return PUBLIC_FILE_NAME.test(name);
}

export function publicFilePath(directory: string, name: string): string | null {
  if (!isPublicFileName(name)) {
    return null;
  }
  return join(directory, name);
}
