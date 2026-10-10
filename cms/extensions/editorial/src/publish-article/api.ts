import { randomUUID } from 'node:crypto';
import { ForbiddenError } from '@directus/errors';
import { defineOperationApi } from '@directus/extensions-sdk';
import { createFileSystemMediaStore } from './public-media-store.ts';
import { publishArticle } from './publish.ts';
import { readPublicMediaDirectory, readSelectedArticleId } from './trigger.ts';

export default defineOperationApi<Record<string, never>>({
  id: 'publish-article',
  handler: async (_options, context) => {
    if (context.accountability === null) {
      throw new ForbiddenError();
    }
    return publishArticle({
      articleId: readSelectedArticleId(context.data),
      accountability: context.accountability,
      services: context.services,
      database: context.database,
      logger: context.logger,
      schema: await context.getSchema(),
      mediaStore: createFileSystemMediaStore(readPublicMediaDirectory(context.env)),
      now: () => new Date(),
      createPublicFileName: () => `${randomUUID()}.webp`,
    });
  },
});
