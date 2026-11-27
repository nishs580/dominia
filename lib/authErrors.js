/**
 * lib/authErrors.js
 *
 * Routes a Clerk (or network) error to the auth field it belongs on and an
 * i18n key (plan U3, Figma "Sign in failures" boards). Screens render
 * `t(key, { defaultValue })` under that field, or for field 'form' as one
 * line above the primary button.
 *
 * Clerk throws `{ errors: [{ code, message, meta: { paramName } }] }`. The
 * first entry with a known code wins; unknown codes fall back to a generic
 * form-level line (or the caller's `fallback`), never Clerk's raw message, so
 * copy stays translated and on-brand.
 *
 * Pure CommonJS so the plain node jest suite can load it.
 */

'use strict';

const GENERIC = { field: 'form', key: 'auth.errors.generic', defaultValue: 'Something went wrong. Try again.' };
const NETWORK = {
  field: 'form',
  key: 'auth.errors.network',
  defaultValue: 'No connection. Check your network and try again.',
};

// code -> { field, key, defaultValue }. A function entry receives the Clerk
// error entry and may return null to fall through to the next entry.
const BY_CODE = {
  form_password_incorrect: {
    field: 'password',
    key: 'signIn.errors.wrongPassword',
    defaultValue: 'Incorrect password. Try again.',
  },
  form_identifier_not_found: {
    field: 'email',
    key: 'signIn.errors.noAccount',
    defaultValue: 'No account found with this email.',
  },
  form_identifier_exists: {
    field: 'email',
    key: 'signIn.errors.emailTaken',
    defaultValue: 'An account with this email already exists.',
  },
  form_password_pwned: {
    field: 'password',
    key: 'signIn.errors.passwordPwned',
    defaultValue: 'This password has appeared in a data breach. Choose another.',
  },
  form_password_length_too_short: {
    field: 'password',
    key: 'signIn.errors.passwordTooShort',
    defaultValue: 'Password must be at least 8 characters.',
  },
  form_password_validation_failed: {
    field: 'password',
    key: 'signIn.errors.wrongPassword',
    defaultValue: 'Incorrect password. Try again.',
  },
  form_code_incorrect: {
    field: 'code',
    key: 'reset.errors.wrongCode',
    defaultValue: 'Incorrect code. Check your email and try again.',
  },
  verification_failed: {
    field: 'code',
    key: 'reset.errors.wrongCode',
    defaultValue: 'Incorrect code. Check your email and try again.',
  },
  verification_expired: {
    field: 'code',
    key: 'reset.errors.codeExpired',
    defaultValue: 'That code has expired. Send a new one.',
  },
  form_param_format_invalid: (entry) =>
    isEmailParam(entry)
      ? { field: 'email', key: 'signIn.errors.invalidEmail', defaultValue: 'Enter a valid email address.' }
      : null,
  form_param_nil: (entry) => {
    if (isEmailParam(entry)) {
      return { field: 'email', key: 'signIn.errors.emailRequired', defaultValue: 'Enter your email.' };
    }
    if (paramName(entry) === 'password') {
      return { field: 'password', key: 'signIn.errors.passwordRequired', defaultValue: 'Enter your password.' };
    }
    if (paramName(entry) === 'code') {
      return { field: 'code', key: 'reset.errors.codeRequired', defaultValue: 'Enter the code from your email.' };
    }
    return null;
  },
  too_many_requests: {
    field: 'form',
    key: 'auth.errors.tooManyAttempts',
    defaultValue: 'Too many attempts. Wait a moment and try again.',
  },
};

function paramName(entry) {
  const meta = entry && entry.meta;
  return (meta && (meta.paramName || meta.param_name)) || '';
}

function isEmailParam(entry) {
  const p = paramName(entry);
  return p === 'identifier' || p === 'email_address' || p === 'emailAddress';
}

const NETWORK_RE = /network request failed|network error|failed to fetch|timed? ?out|offline|internet connection/i;

function isNetworkError(err) {
  if (!err) return false;
  if (err.isNetworkError === true) return true;
  const msg = typeof err.message === 'string' ? err.message : '';
  return NETWORK_RE.test(msg);
}

/**
 * @param {unknown} err — what a Clerk call threw
 * @param {{ fallback?: { key: string, defaultValue: string } }} [opts] — the
 *   form-level line to use instead of the generic one for unknown errors
 * @returns {{ field: 'email'|'password'|'code'|'form', key: string, defaultValue: string }}
 */
function mapAuthError(err, opts) {
  const entries = err && Array.isArray(err.errors) ? err.errors : [];
  for (const entry of entries) {
    const rule = entry && BY_CODE[entry.code];
    if (!rule) continue;
    const mapped = typeof rule === 'function' ? rule(entry) : rule;
    if (mapped) return { ...mapped };
  }
  if (entries.length === 0 && isNetworkError(err)) return { ...NETWORK };
  const fallback = opts && opts.fallback;
  if (fallback && fallback.key) {
    return { field: 'form', key: fallback.key, defaultValue: fallback.defaultValue || GENERIC.defaultValue };
  }
  return { ...GENERIC };
}

/** Empty per-field error state for the auth forms. */
function emptyAuthErrors() {
  return { email: '', password: '', code: '', form: '' };
}

module.exports = { mapAuthError, emptyAuthErrors, AUTH_ERROR_CODES: Object.keys(BY_CODE) };
