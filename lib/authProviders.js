/**
 * lib/authProviders.js
 *
 * Which sign-in buttons the Figma landing shows, top to bottom (Updated UX
 * A2: Apple, Google, Email). Apple stays hidden until the owner configures
 * Sign in with Apple in Clerk and sets EXPO_PUBLIC_APPLE_SIGNIN=1.
 *
 * Pass the env value through a direct `process.env.EXPO_PUBLIC_APPLE_SIGNIN`
 * member access at the call site: Metro only inlines EXPO_PUBLIC_* that way.
 *
 * Pure CommonJS so the plain node jest suite can load it.
 */

'use strict';

/**
 * @param {Record<string, string|undefined>} env
 * @param {string} [platform] Platform.OS. Clerk's oauth_apple runs on both
 *   platforms (a web flow on Android), so it does not gate the button today.
 * @returns {Array<'apple'|'google'|'email'>}
 */
// eslint-disable-next-line no-unused-vars
function enabledProviders(env, platform) {
  const apple = Boolean(env) && env.EXPO_PUBLIC_APPLE_SIGNIN === '1';
  return apple ? ['apple', 'google', 'email'] : ['google', 'email'];
}

module.exports = { enabledProviders };
