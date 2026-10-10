import { describe, expect, it } from 'vitest';
import { declaredPublicationOperationFields, operationFieldsDiffer } from './publication-operation.ts';

describe('operationFieldsDiffer', () => {
  const declared = declaredPublicationOperationFields();

  it('reports no drift when stored fields match the declaration', () => {
    expect(operationFieldsDiffer({ ...declared, options: null }, declared)).toBe(false);
    expect(operationFieldsDiffer(declared, declared)).toBe(false);
  });

  it('detects drift on type, name, position or options', () => {
    expect(operationFieldsDiffer({ ...declared, type: 'log' }, declared)).toBe(true);
    expect(operationFieldsDiffer({ ...declared, name: 'Autre nom' }, declared)).toBe(true);
    expect(operationFieldsDiffer({ ...declared, position_x: 0 }, declared)).toBe(true);
    expect(operationFieldsDiffer({ ...declared, options: { foo: 'bar' } }, declared)).toBe(true);
  });
});
