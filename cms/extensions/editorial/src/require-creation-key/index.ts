import { defineHook } from '@directus/extensions-sdk';
import { assertCreationKeyPresent, readAssistantRoleId } from './creation-key.ts';

export default defineHook(({ filter }, { env }) => {
  filter('articles.items.create', (payload, _meta, context) =>
    assertCreationKeyPresent(payload, context.accountability, readAssistantRoleId(env)),
  );
});
