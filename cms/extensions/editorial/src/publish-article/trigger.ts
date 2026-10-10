import { ArticleSelectionError, EditorialConfigurationError } from '../errors.ts';
import { isRecord } from '../guards.ts';

export function readSelectedArticleId(flowData: Record<string, unknown>): string {
  const trigger = flowData['$trigger'];
  if (!isRecord(trigger)) {
    throw new ArticleSelectionError();
  }
  const body = trigger['body'];
  if (!isRecord(body)) {
    throw new ArticleSelectionError();
  }
  const keys = body['keys'];
  if (!Array.isArray(keys)) {
    throw new ArticleSelectionError();
  }
  const selectedKeys: unknown[] = keys;
  const [articleId] = selectedKeys;
  if (selectedKeys.length !== 1 || typeof articleId !== 'string' || articleId === '') {
    throw new ArticleSelectionError();
  }
  return articleId;
}

export function readPublicMediaDirectory(environment: Record<string, unknown>): string {
  const directory = environment['PUBLIC_MEDIA_PATH'];
  if (typeof directory !== 'string' || directory === '') {
    throw new EditorialConfigurationError({ variable: 'PUBLIC_MEDIA_PATH' });
  }
  return directory;
}
