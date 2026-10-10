import type { Accountability } from '@directus/types';
import { describe, expect, it } from 'vitest';
import { CreationKeyRequiredError, EditorialConfigurationError } from '../errors.ts';
import { assertCreationKeyPresent, readAssistantRoleId } from './creation-key.ts';

const ASSISTANT_ROLE_ID = '6f1d1f4e-2b7a-4c55-9f58-4c1b3e8a9d21';
const EDITOR_ROLE_ID = '2b0c4c3e-7a8f-4d7e-9a51-3f6f0b9c1e42';

function accountabilityFor(role: string): Accountability {
  return { role, roles: [role], user: 'user-id', admin: false, app: false, ip: null };
}

describe('assertCreationKeyPresent', () => {
  it('lets the assistant create an article with a creation key', () => {
    const payload = { title: 'Titre', creation_key: '2026-10-10-budget' };

    expect(assertCreationKeyPresent(payload, accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID)).toBe(payload);
  });

  it('rejects an assistant article without a creation key', () => {
    expect(() => assertCreationKeyPresent({ title: 'Titre' }, accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID)).toThrow(
      CreationKeyRequiredError,
    );
  });

  it('rejects a blank creation key', () => {
    expect(() =>
      assertCreationKeyPresent({ title: 'Titre', creation_key: '   ' }, accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID),
    ).toThrow(CreationKeyRequiredError);
  });

  it('rejects a payload that is not an object', () => {
    expect(() => assertCreationKeyPresent('texte', accountabilityFor(ASSISTANT_ROLE_ID), ASSISTANT_ROLE_ID)).toThrow(
      CreationKeyRequiredError,
    );
  });

  it('does not constrain the editorial team or system tasks', () => {
    const payload = { title: 'Titre' };

    expect(assertCreationKeyPresent(payload, accountabilityFor(EDITOR_ROLE_ID), ASSISTANT_ROLE_ID)).toBe(payload);
    expect(assertCreationKeyPresent(payload, null, ASSISTANT_ROLE_ID)).toBe(payload);
  });
});

describe('readAssistantRoleId', () => {
  it('reads AI_ROLE_ID', () => {
    expect(readAssistantRoleId({ AI_ROLE_ID: ASSISTANT_ROLE_ID })).toBe(ASSISTANT_ROLE_ID);
  });

  it('fails closed when AI_ROLE_ID is missing', () => {
    expect(() => readAssistantRoleId({})).toThrow(EditorialConfigurationError);
  });
});
