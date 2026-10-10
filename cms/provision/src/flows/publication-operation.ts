export const PUBLICATION_OPERATION_KEY = 'publish';

export type OperationOptions = Record<string, string | number | boolean | null>;

export type PublicationOperationFields = {
  type: string;
  name: string;
  position_x: number;
  position_y: number;
  options: OperationOptions | null;
};

export function declaredPublicationOperationFields(): PublicationOperationFields {
  return {
    type: 'publish-article',
    name: 'Publier l’article',
    position_x: 19,
    position_y: 1,
    options: {},
  };
}

function optionsJson(options: OperationOptions | null): string {
  return JSON.stringify(options ?? {});
}

export function operationFieldsDiffer(current: PublicationOperationFields, declared: PublicationOperationFields): boolean {
  if (current.type !== declared.type) {
    return true;
  }
  if (current.name !== declared.name) {
    return true;
  }
  if (current.position_x !== declared.position_x) {
    return true;
  }
  if (current.position_y !== declared.position_y) {
    return true;
  }
  return optionsJson(current.options) !== optionsJson(declared.options);
}
