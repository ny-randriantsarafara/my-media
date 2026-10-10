import { z } from 'zod';

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export type CmsConnection = { baseUrl: string; fetch: FetchFunction };

export type CmsRequest = { path: string; params?: Record<string, string>; sessionToken?: string };

export class CmsRequestError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Le CMS a répondu HTTP ${status} pour ${path}.`);
    this.name = 'CmsRequestError';
    this.status = status;
  }
}

const ACCESS_DENIED_STATUSES = [401, 403, 404];

export async function fetchPublicData<T>(connection: CmsConnection, request: CmsRequest, schema: z.ZodType<T>): Promise<T> {
  const response = await send(connection, request);
  if (!response.ok) {
    throw new CmsRequestError(request.path, response.status);
  }
  return parseData(response, schema);
}

export async function fetchSessionData<T>(connection: CmsConnection, request: CmsRequest, schema: z.ZodType<T>): Promise<T | null> {
  const response = await send(connection, request);
  if (ACCESS_DENIED_STATUSES.includes(response.status)) {
    return null;
  }
  if (!response.ok) {
    throw new CmsRequestError(request.path, response.status);
  }
  return parseData(response, schema);
}

function send(connection: CmsConnection, request: CmsRequest): Promise<Response> {
  return connection.fetch(buildUrl(connection.baseUrl, request), { headers: buildHeaders(request) });
}

function buildUrl(baseUrl: string, request: CmsRequest): string {
  const url = new URL(request.path, baseUrl).toString();
  const query = new URLSearchParams(request.params ?? {}).toString();
  if (query === '') {
    return url;
  }
  return `${url}?${query}`;
}

function buildHeaders(request: CmsRequest): Record<string, string> {
  if (request.sessionToken === undefined) {
    return { Accept: 'application/json' };
  }
  return { Accept: 'application/json', Cookie: `directus_session_token=${request.sessionToken}` };
}

async function parseData<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json();
  return z.object({ data: schema }).parse(body).data;
}
