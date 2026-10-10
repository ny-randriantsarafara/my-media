import { createError } from '@directus/errors';

export const PublicationError = createError<{ reason: string }>(
  'PUBLICATION_FAILED',
  ({ reason }) => `La publication a échoué : ${reason}. La version publique précédente est conservée.`,
  500,
);

export const CreationKeyRequiredError = createError(
  'CREATION_KEY_REQUIRED',
  'Le compte assistant doit fournir une creation_key stable pour créer un article.',
  400,
);

export const ArticleSelectionError = createError(
  'INVALID_ARTICLE_SELECTION',
  'Sélectionnez exactement un article à publier.',
  400,
);

export const EditorialConfigurationError = createError<{ variable: string }>(
  'EDITORIAL_CONFIGURATION_MISSING',
  ({ variable }) => `Configuration incomplète : la variable ${variable} est absente.`,
  503,
);
