import { describe, expect, it } from 'vitest';
import { rolePolicyIdsMatchExpected } from './role-policies.ts';

describe('rolePolicyIdsMatchExpected', () => {
  it('accepts a single expected policy id', () => {
    expect(rolePolicyIdsMatchExpected(['policy-a'], 'policy-a')).toBe(true);
  });

  it('rejects missing, extra or swapped policy ids', () => {
    expect(rolePolicyIdsMatchExpected([], 'policy-a')).toBe(false);
    expect(rolePolicyIdsMatchExpected(['policy-b'], 'policy-a')).toBe(false);
    expect(rolePolicyIdsMatchExpected(['policy-a', 'policy-b'], 'policy-a')).toBe(false);
  });
});
