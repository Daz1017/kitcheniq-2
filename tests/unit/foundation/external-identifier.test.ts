import {
  createExternalIdentifierRef,
  createExternalIdentifierValue,
  createSourceNamespace,
  isExternalIdentifierRef,
  isExternalIdentifierValue,
  isSourceNamespace
} from '../../../src/foundation/external-identifiers';

describe('Foundation external identifier reference', () => {
  test('accepts open source namespace values', () => {
    for (const value of ['legacy_kitcheniq', 'vendor_erp', 'pos_system']) {
      expect(isSourceNamespace(value)).toBe(true);
      expect(createSourceNamespace(value)).toBe(value);
    }
  });

  test('rejects invalid source namespaces without normalizing', () => {
    for (const value of ['', ' ', ' legacy_kitcheniq', 'legacy_kitcheniq ']) {
      expect(isSourceNamespace(value)).toBe(false);
      expect(() => createSourceNamespace(value)).toThrow();
    }

    for (const value of [null, undefined, 123, {}]) {
      expect(isSourceNamespace(value)).toBe(false);
      expect(() => createSourceNamespace(value)).toThrow();
    }
  });

  test('accepts and preserves opaque external identifier strings', () => {
    for (const value of ['000123', 'ABC-001', '123', 'item/42', 'aBcDeF']) {
      expect(isExternalIdentifierValue(value)).toBe(true);
      expect(createExternalIdentifierValue(value)).toBe(value);
    }
  });

  test('rejects numeric input and invalid external identifier values', () => {
    for (const value of [123, 9007199254740993, '', ' ', ' 123', '123 ']) {
      expect(isExternalIdentifierValue(value)).toBe(false);
      expect(() => createExternalIdentifierValue(value)).toThrow();
    }
  });

  test('creates the exact two-field reference structure', () => {
    const reference = createExternalIdentifierRef('legacy_kitcheniq', '000123');

    expect(reference).toEqual({
      sourceNamespace: 'legacy_kitcheniq',
      externalId: '000123'
    });
    expect(Object.keys(reference)).toEqual(['sourceNamespace', 'externalId']);
    expect(isExternalIdentifierRef(reference)).toBe(true);
  });

  test('rejects references with extra mapping or metadata fields', () => {
    const extraFields = [
      'kitchenIqId',
      'mappedId',
      'organizationId',
      'entityType',
      'metadata'
    ];

    for (const field of extraFields) {
      const reference = {
        sourceNamespace: 'legacy_kitcheniq',
        externalId: '000123',
        [field]: 'not-authorized'
      };
      expect(isExternalIdentifierRef(reference)).toBe(false);
    }
  });

  test('rejects non-plain reference values', () => {
    class ExternalReference {
      sourceNamespace = 'legacy_kitcheniq';
      externalId = '000123';
    }

    expect(isExternalIdentifierRef(null)).toBe(false);
    expect(isExternalIdentifierRef([])).toBe(false);
    expect(isExternalIdentifierRef(new Date())).toBe(false);
    expect(isExternalIdentifierRef(new ExternalReference())).toBe(false);
  });

  test('preserves exact values through JSON round-trip and case differences', () => {
    const reference = createExternalIdentifierRef('legacy_kitcheniq', '000123');
    const parsed: unknown = JSON.parse(JSON.stringify(reference));

    expect(isExternalIdentifierRef(parsed)).toBe(true);
    expect(parsed).toEqual(reference);
    expect((parsed as { externalId: string }).externalId).toBe('000123');

    const lower = createExternalIdentifierValue('abc');
    const upper = createExternalIdentifierValue('ABC');
    expect(lower).not.toBe(upper);
    expect(lower).toBe('abc');
    expect(upper).toBe('ABC');
  });
});
