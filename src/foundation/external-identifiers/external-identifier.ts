export type SourceNamespace = string & {
  readonly __sourceNamespaceBrand: unique symbol;
};

export type ExternalIdentifierValue = string & {
  readonly __externalIdentifierBrand: unique symbol;
};

export type ExternalIdentifierRef = Readonly<{
  readonly sourceNamespace: SourceNamespace;
  readonly externalId: ExternalIdentifierValue;
}>;

export function createSourceNamespace(value: unknown): SourceNamespace {
  if (!isValidOpaqueString(value)) {
    throw new Error('Source namespace must be a non-empty string without surrounding whitespace.');
  }

  return value as SourceNamespace;
}

export function createExternalIdentifierValue(value: unknown): ExternalIdentifierValue {
  if (!isValidOpaqueString(value)) {
    throw new Error('External identifier must be a non-empty string without surrounding whitespace.');
  }

  return value as ExternalIdentifierValue;
}

export function createExternalIdentifierRef(
  sourceNamespace: unknown,
  externalId: unknown
): ExternalIdentifierRef {
  return Object.freeze({
    sourceNamespace: createSourceNamespace(sourceNamespace),
    externalId: createExternalIdentifierValue(externalId)
  });
}

export function isSourceNamespace(value: unknown): value is SourceNamespace {
  return isValidOpaqueString(value);
}

export function isExternalIdentifierValue(value: unknown): value is ExternalIdentifierValue {
  return isValidOpaqueString(value);
}

export function isExternalIdentifierRef(value: unknown): value is ExternalIdentifierRef {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const ownKeys = Object.keys(candidate);
  return ownKeys.length === 2
    && ownKeys.includes('sourceNamespace')
    && ownKeys.includes('externalId')
    && isSourceNamespace(candidate.sourceNamespace)
    && isExternalIdentifierValue(candidate.externalId);
}

function isValidOpaqueString(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim().length > 0
    && value === value.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
