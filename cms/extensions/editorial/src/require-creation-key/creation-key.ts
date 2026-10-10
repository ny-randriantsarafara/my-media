import type { Accountability } from '@directus/types';
import { CreationKeyRequiredError, EditorialConfigurationError } from '../errors.ts';
import { isRecord } from '../guards.ts';

export function readAssistantRoleId(environment: Record<string, unknown>): string {
  const roleId = environment['AI_ROLE_ID'];
  if (typeof roleId !== 'string' || roleId === '') {
    throw new EditorialConfigurationError({ variable: 'AI_ROLE_ID' });
  }
  return roleId;
}

export function assertCreationKeyPresent<T>(payload: T, accountability: Accountability | null, assistantRoleId: string): T {
  if (accountability?.role !== assistantRoleId) {
    return payload;
  }
  if (!isRecord(payload)) {
    throw new CreationKeyRequiredError();
  }
  const creationKey = payload['creation_key'];
  if (typeof creationKey !== 'string' || creationKey.trim() === '') {
    throw new CreationKeyRequiredError();
  }
  return payload;
}
