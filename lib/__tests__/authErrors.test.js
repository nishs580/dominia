/**
 * lib/__tests__/authErrors.test.js
 *
 * Clerk error -> auth field + i18n key (plan U3, sign-in failure boards).
 */

const { mapAuthError, emptyAuthErrors } = require('../authErrors');

const clerk = (...entries) => ({ errors: entries });

describe('mapAuthError', () => {
  test('wrong password goes on the password field', () => {
    expect(mapAuthError(clerk({ code: 'form_password_incorrect', message: 'Password is incorrect.' }))).toEqual({
      field: 'password',
      key: 'signIn.errors.wrongPassword',
      defaultValue: 'Incorrect password. Try again.',
    });
  });

  test('unknown email goes on the email field', () => {
    expect(mapAuthError(clerk({ code: 'form_identifier_not_found' }))).toEqual({
      field: 'email',
      key: 'signIn.errors.noAccount',
      defaultValue: 'No account found with this email.',
    });
  });

  test('wrong code goes on the code field', () => {
    const r = mapAuthError(clerk({ code: 'form_code_incorrect' }));
    expect(r.field).toBe('code');
    expect(r.key).toBe('reset.errors.wrongCode');
  });

  test('an unknown Clerk code is a generic form-level error', () => {
    expect(mapAuthError(clerk({ code: 'something_new', message: 'Raw Clerk text' }))).toEqual({
      field: 'form',
      key: 'auth.errors.generic',
      defaultValue: 'Something went wrong. Try again.',
    });
  });

  test('a non-Clerk error with only a message is generic', () => {
    expect(mapAuthError(new Error('boom')).key).toBe('auth.errors.generic');
    expect(mapAuthError(undefined).field).toBe('form');
    expect(mapAuthError({ errors: 'nope' }).key).toBe('auth.errors.generic');
  });

  test('network failures get the network line', () => {
    const r = mapAuthError(new TypeError('Network request failed'));
    expect(r).toEqual({
      field: 'form',
      key: 'auth.errors.network',
      defaultValue: 'No connection. Check your network and try again.',
    });
  });

  test('several entries: the first with a known code wins', () => {
    const r = mapAuthError(
      clerk({ code: 'mystery' }, { code: 'form_identifier_not_found' }, { code: 'form_password_incorrect' }),
    );
    expect(r.field).toBe('email');
  });

  test('param-dependent codes route by paramName and fall through otherwise', () => {
    expect(mapAuthError(clerk({ code: 'form_param_format_invalid', meta: { paramName: 'email_address' } })).field).toBe(
      'email',
    );
    expect(mapAuthError(clerk({ code: 'form_param_nil', meta: { paramName: 'password' } })).field).toBe('password');
    expect(mapAuthError(clerk({ code: 'form_param_format_invalid', meta: { paramName: 'other' } })).key).toBe(
      'auth.errors.generic',
    );
  });

  test('a caller fallback replaces the generic line, not known codes', () => {
    const fallback = { key: 'signIn.googleFailed', defaultValue: 'Google sign-in failed. Try again.' };
    expect(mapAuthError(new Error('x'), { fallback })).toEqual({ field: 'form', ...fallback });
    expect(mapAuthError(clerk({ code: 'form_password_incorrect' }), { fallback }).field).toBe('password');
    expect(mapAuthError(new Error('Network request failed'), { fallback }).key).toBe('auth.errors.network');
  });

  test('returns a fresh object each call', () => {
    const a = mapAuthError(clerk({ code: 'form_password_incorrect' }));
    a.field = 'mutated';
    expect(mapAuthError(clerk({ code: 'form_password_incorrect' })).field).toBe('password');
  });
});

test('emptyAuthErrors has every field blank', () => {
  expect(emptyAuthErrors()).toEqual({ email: '', password: '', code: '', form: '' });
});
