export function rolePolicyIdsMatchExpected(policyIds: readonly string[], expectedPolicyId: string): boolean {
  if (policyIds.length !== 1) {
    return false;
  }
  const policyId = policyIds.at(0);
  if (policyId === undefined) {
    return false;
  }
  return policyId === expectedPolicyId;
}
