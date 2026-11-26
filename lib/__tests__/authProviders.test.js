/**
 * lib/__tests__/authProviders.test.js
 *
 * Landing sign-in buttons (Updated UX U14): Apple shows only when
 * EXPO_PUBLIC_APPLE_SIGNIN=1, and then comes first.
 */

const { enabledProviders } = require('../authProviders');

describe('enabledProviders', () => {
  test('the env var unset gives no apple', () => {
    expect(enabledProviders({}, 'ios')).toEqual(['google', 'email']);
    expect(enabledProviders(undefined, 'ios')).toEqual(['google', 'email']);
  });

  test('values other than "1" give no apple', () => {
    for (const v of ['0', '', 'true', 'yes', '1 ']) {
      expect(enabledProviders({ EXPO_PUBLIC_APPLE_SIGNIN: v }, 'ios')).not.toContain('apple');
    }
  });

  test('the env var set to 1 gives apple first, then google, then email', () => {
    expect(enabledProviders({ EXPO_PUBLIC_APPLE_SIGNIN: '1' }, 'ios')).toEqual(['apple', 'google', 'email']);
    expect(enabledProviders({ EXPO_PUBLIC_APPLE_SIGNIN: '1' }, 'android')).toEqual(['apple', 'google', 'email']);
  });
});
