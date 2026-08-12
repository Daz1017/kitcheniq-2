import { generateUUID } from '../../../src/foundation/identifiers';
import { createExternalIdentifierRef } from '../../../src/foundation/external-identifiers';
import {
  createExternalIdentifierMapping,
  isExternalIdentifierMapping
} from '../../../src/foundation/external-identifier-mapping';

describe('Foundation external identifier mapping reference', () => {
  test('creates a valid mapping with the exact canonical structure', () => {
    const externalRef = createExternalIdentifierRef('legacy_kitcheniq', '000123');
    const kitchenIqId = generateUUID();
    const mapping = createExternalIdentifierMapping(externalRef, kitchenIqId);

    expect(mapping).toEqual({ externalRef, kitchenIqId });
    expect(Object.keys(mapping)).toEqual(['externalRef', 'kitchenIqId']);
    expect(Object.keys(mapping.externalRef)).toEqual(['sourceNamespace', 'externalId']);
    expect(isExternalIdentifierMapping(mapping)).toBe(true);
  });

  test('reuses F-15 validation for invalid external references', () => {
    const kitchenIqId = generateUUID();
    const invalidReferences: unknown[] = [
      { externalId: '000123' },
      { sourceNamespace: ' ', externalId: '000123' },
      { sourceNamespace: 'legacy_kitcheniq', externalId: 123 },
      { sourceNamespace: 'legacy_kitcheniq', externalId: '000123', metadata: 'x' }
    ];

    for (const externalRef of invalidReferences) {
      expect(() => createExternalIdentifierMapping(externalRef as never, kitchenIqId)).toThrow();
      expect(isExternalIdentifierMapping({ externalRef, kitchenIqId })).toBe(false);
    }
  });

  test('reuses F-02 UUIDv4 validation for KitchenIQ IDs', () => {
    const externalRef = createExternalIdentifierRef('legacy_kitcheniq', '000123');
    const malformed = 'not-a-uuid';
    const nonV4 = `${generateUUID().slice(0, 14)}1${generateUUID().slice(15)}`;

    expect(() => createExternalIdentifierMapping(externalRef, malformed)).toThrow();
    expect(() => createExternalIdentifierMapping(externalRef, nonV4)).toThrow();
    expect(isExternalIdentifierMapping({ externalRef, kitchenIqId: malformed })).toBe(false);
    expect(isExternalIdentifierMapping({ externalRef, kitchenIqId: nonV4 })).toBe(false);
  });

  test('preserves external reference values through JSON round-trip', () => {
    const mapping = createExternalIdentifierMapping(
      createExternalIdentifierRef('legacy_kitcheniq', 'ABC/item-000123'),
      generateUUID()
    );
    const parsed: unknown = JSON.parse(JSON.stringify(mapping));

    expect(isExternalIdentifierMapping(parsed)).toBe(true);
    expect(parsed).toEqual(mapping);
    expect((parsed as { externalRef: { externalId: string } }).externalRef.externalId)
      .toBe('ABC/item-000123');
  });

  test('rejects extra fields and non-plain values', () => {
    const externalRef = createExternalIdentifierRef('legacy_kitcheniq', '000123');
    const kitchenIqId = generateUUID();
    const extraFields = ['entityType', 'module', 'mappedAt', 'metadata', 'organizationId'];

    for (const field of extraFields) {
      expect(isExternalIdentifierMapping({ externalRef, kitchenIqId, [field]: 'x' })).toBe(false);
    }

    class Mapping {
      externalRef = { sourceNamespace: 'legacy_kitcheniq', externalId: '000123' };
      kitchenIqId = generateUUID();
    }

    expect(isExternalIdentifierMapping(null)).toBe(false);
    expect(isExternalIdentifierMapping([])).toBe(false);
    expect(isExternalIdentifierMapping(new Date())).toBe(false);
    expect(isExternalIdentifierMapping(new Mapping())).toBe(false);
  });
});
