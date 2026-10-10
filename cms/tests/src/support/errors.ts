import { isDirectusError } from '@directus/sdk';

export async function captureErrorCode(request: Promise<unknown>): Promise<string> {
  try {
    await request;
  } catch (error) {
    return readErrorCode(error);
  }
  throw new Error('La requête devait être refusée mais elle a réussi.');
}

function readErrorCode(error: unknown): string {
  if (!isDirectusError(error)) {
    throw error;
  }
  const [firstError] = error.errors;
  if (firstError === undefined) {
    throw new Error(`Erreur Directus sans détail (HTTP ${error.response.status}).`);
  }
  return firstError.extensions.code;
}
