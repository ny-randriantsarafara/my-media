import { isDirectusError } from '@directus/sdk';

export async function captureErrorCode(request: Promise<unknown>): Promise<string> {
  try {
    await request;
  } catch (error) {
    return readErrorCode(error);
  }
  throw new Error('The request should have been denied but it succeeded.');
}

function readErrorCode(error: unknown): string {
  if (!isDirectusError(error)) {
    throw error;
  }
  const [firstError] = error.errors;
  if (firstError === undefined) {
    throw new Error(`Directus error without details (HTTP ${error.response.status}).`);
  }
  return firstError.extensions.code;
}
