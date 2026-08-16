import { redactSensitiveData } from '../../../../src/foundation/runtime/redaction';

describe('redaction of sensitive data', () => {
  test('recursively redacts sensitive keys', () => {
    const input = {
      Authorization: 'Bearer abc',
      authorization: 'Bearer def',
      password: 'secret',
      token: 'abc',
      access_token: 'aaa',
      refresh_token: 'bbb',
      api_key: 'ccc',
      service_role: 'ddd',
      nested: { secret: 'hidden', safe: 'value' },
      list: [{ password: 'x' }, { ok: true }],
      safe: 'keep'
    };

    const redacted = redactSensitiveData(input);

    expect(redacted).toEqual({
      Authorization: '[REDACTED]',
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      token: '[REDACTED]',
      access_token: '[REDACTED]',
      refresh_token: '[REDACTED]',
      api_key: '[REDACTED]',
      service_role: '[REDACTED]',
      nested: { secret: '[REDACTED]', safe: 'value' },
      list: [{ password: '[REDACTED]' }, { ok: true }],
      safe: 'keep'
    });
    expect(input).toEqual({
      Authorization: 'Bearer abc',
      authorization: 'Bearer def',
      password: 'secret',
      token: 'abc',
      access_token: 'aaa',
      refresh_token: 'bbb',
      api_key: 'ccc',
      service_role: 'ddd',
      nested: { secret: 'hidden', safe: 'value' },
      list: [{ password: 'x' }, { ok: true }],
      safe: 'keep'
    });
  });

  test('leaves non-sensitive values unchanged', () => {
    expect(redactSensitiveData({ organizationId: '123', locationId: '456' })).toEqual({
      organizationId: '123',
      locationId: '456'
    });
  });
});
