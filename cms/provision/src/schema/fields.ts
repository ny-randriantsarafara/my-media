import type { DirectusField, NestedPartial } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';

export type FieldDefinition = NestedPartial<DirectusField<EditorialSchema>> & { field: string };

export type FieldLabel = {
  label: string;
  note?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  width?: 'half' | 'full';
};

export type Choice = { text: string; value: string };

function fieldMeta(options: FieldLabel) {
  return {
    translations: [{ language: 'fr-FR', translation: options.label }],
    note: options.note ?? null,
    required: options.required ?? false,
    readonly: options.readonly ?? false,
    hidden: options.hidden ?? false,
    width: options.width ?? 'full',
  };
}

function columnSchema(options: FieldLabel) {
  const required = options.required ?? false;
  return {
    is_nullable: !required,
    is_unique: options.unique ?? false,
  };
}

export function uuidPrimaryKey(): FieldDefinition {
  return {
    field: 'id',
    type: 'uuid',
    meta: { special: ['uuid'], interface: 'input', readonly: true, hidden: true },
    schema: { is_primary_key: true, is_nullable: false },
  };
}

export function integerPrimaryKey(): FieldDefinition {
  return {
    field: 'id',
    type: 'integer',
    meta: { interface: 'input', readonly: true, hidden: true },
    schema: { is_primary_key: true, has_auto_increment: true, is_nullable: false },
  };
}

export function stringField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'string',
    meta: { ...fieldMeta(options), interface: 'input' },
    schema: columnSchema(options),
  };
}

export function urlField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'text',
    meta: { ...fieldMeta(options), interface: 'input', options: { placeholder: 'https://' } },
    schema: columnSchema(options),
  };
}

export function textField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'text',
    meta: { ...fieldMeta(options), interface: 'input-multiline' },
    schema: columnSchema(options),
  };
}

export function markdownField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'text',
    meta: { ...fieldMeta(options), interface: 'input-rich-text-md' },
    schema: columnSchema(options),
  };
}

export function dateField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'date',
    meta: { ...fieldMeta(options), interface: 'datetime' },
    schema: columnSchema(options),
  };
}

export function timestampField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'timestamp',
    meta: { ...fieldMeta(options), interface: 'datetime', display: 'datetime' },
    schema: columnSchema(options),
  };
}

export function integerField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'integer',
    meta: { ...fieldMeta(options), interface: 'input' },
    schema: columnSchema(options),
  };
}

export function booleanField(field: string, options: FieldLabel, defaultValue: boolean): FieldDefinition {
  return {
    field,
    type: 'boolean',
    meta: { ...fieldMeta(options), interface: 'boolean', special: ['cast-boolean'] },
    schema: { ...columnSchema(options), default_value: defaultValue },
  };
}

export function choiceField(field: string, options: FieldLabel, choices: Choice[], defaultValue: string): FieldDefinition {
  return {
    field,
    type: 'string',
    meta: {
      ...fieldMeta(options),
      interface: 'select-dropdown',
      options: { choices },
      display: 'labels',
      display_options: { choices },
    },
    schema: { ...columnSchema(options), default_value: defaultValue },
  };
}

export function sortField(): FieldDefinition {
  return {
    field: 'sort',
    type: 'integer',
    meta: { interface: 'input', hidden: true },
    schema: { is_nullable: true },
  };
}

export function manyToOneField(field: string, options: FieldLabel, template: string): FieldDefinition {
  return {
    field,
    type: 'uuid',
    meta: {
      ...fieldMeta(options),
      special: ['m2o'],
      interface: 'select-dropdown-m2o',
      options: { template },
      display: 'related-values',
      display_options: { template },
    },
    schema: columnSchema(options),
  };
}

export function imageField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'uuid',
    meta: { ...fieldMeta(options), special: ['file'], interface: 'file-image', display: 'image' },
    schema: columnSchema(options),
  };
}

export function documentField(field: string, options: FieldLabel): FieldDefinition {
  return {
    field,
    type: 'uuid',
    meta: { ...fieldMeta(options), special: ['file'], interface: 'file', display: 'file' },
    schema: columnSchema(options),
  };
}

export function oneToManyField(field: string, options: FieldLabel, template: string): FieldDefinition {
  return {
    field,
    type: 'alias',
    meta: {
      ...fieldMeta(options),
      special: ['o2m'],
      interface: 'list-o2m',
      options: { template, enableSelect: false },
      display: 'related-values',
      display_options: { template },
    },
    schema: null,
  };
}

export function dateCreatedField(): FieldDefinition {
  return {
    field: 'date_created',
    type: 'timestamp',
    meta: { ...fieldMeta({ label: 'Créé le', readonly: true, width: 'half' }), special: ['date-created'], interface: 'datetime', display: 'datetime' },
    schema: { is_nullable: true },
  };
}

export function dateUpdatedField(): FieldDefinition {
  return {
    field: 'date_updated',
    type: 'timestamp',
    meta: { ...fieldMeta({ label: 'Modifié le', readonly: true, width: 'half' }), special: ['date-updated'], interface: 'datetime', display: 'datetime' },
    schema: { is_nullable: true },
  };
}

export function userCreatedField(): FieldDefinition {
  return {
    field: 'user_created',
    type: 'uuid',
    meta: { ...fieldMeta({ label: 'Créé par', readonly: true, width: 'half' }), special: ['user-created'], interface: 'select-dropdown-m2o', options: { template: '{{first_name}}' }, display: 'user' },
    schema: { is_nullable: true },
  };
}

export function userUpdatedField(): FieldDefinition {
  return {
    field: 'user_updated',
    type: 'uuid',
    meta: { ...fieldMeta({ label: 'Modifié par', readonly: true, width: 'half' }), special: ['user-updated'], interface: 'select-dropdown-m2o', options: { template: '{{first_name}}' }, display: 'user' },
    schema: { is_nullable: true },
  };
}
