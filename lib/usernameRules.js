// Commander-name rules (Updated UX A4/A4b/A4c). Pure, so the jest suite can
// pin them. New names are letters and digits only — "Names can't contain
// symbols" — which is stricter than the backend's legacy shape; existing names
// are never re-validated against it.

'use strict';

const USERNAME_MIN = 2;
const USERNAME_MAX = 20;

/**
 * @param {string} name
 * @returns {'ok'|'empty'|'tooShort'|'tooLong'|'symbol'}
 */
function usernameProblem(name) {
  const v = String(name ?? '').trim();
  if (!v) return 'empty';
  if (!/^[a-zA-Z0-9]+$/.test(v)) return 'symbol';
  if (v.length < USERNAME_MIN) return 'tooShort';
  if (v.length > USERNAME_MAX) return 'tooLong';
  return 'ok';
}

/**
 * Whether to show the problem live. A symbol shows as soon as it is typed
 * (Figma A4c); length problems wait until the field has been touched, and an
 * empty field never shows an error.
 */
function visibleProblem(name, { touched = false } = {}) {
  const p = usernameProblem(name);
  if (p === 'ok' || p === 'empty') return null;
  if (p === 'symbol') return p;
  return touched ? p : null;
}

module.exports = { USERNAME_MIN, USERNAME_MAX, usernameProblem, visibleProblem };
