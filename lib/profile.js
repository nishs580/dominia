/**
 * lib/profile.js
 *
 * Pure helpers for the Figma Profile (screens/ProfileAccordionScreen.js) and
 * Edit Profile (screens/EditProfileScreen.js). React-free and CommonJS so jest
 * loads them under node.
 */

'use strict';

// Accordion sections, in Figma order. All start closed (plan U16).
const PROFILE_SECTIONS = Object.freeze([
  'territories',
  'activity',
  'resources',
  'settings',
  'statistics',
]);

function initialSections() {
  const out = {};
  for (const key of PROFILE_SECTIONS) out[key] = false;
  return out;
}

// Flips one section; every other section keeps its state, so any number can
// be open at once.
function toggleSection(state, key) {
  return { ...state, [key]: !state[key] };
}

// Same rules as the onboarding picker (lib/usernameRules): a rename is a new
// name, so letters and digits only. Returns a `username.*` i18n key or null.
const USERNAME_PROBLEM_KEYS = {
  empty: 'errorEmpty',
  tooShort: 'errorTooShort',
  tooLong: 'errorTooLong',
  symbol: 'errorInvalidChars',
};
function validateUsername(name) {
  const p = require('./usernameRules').usernameProblem(name);
  return p === 'ok' ? null : USERNAME_PROBLEM_KEYS[p];
}

// Maps a failed PATCH /me { username } to the same `username.*` key the
// onboarding picker shows: 409 is "taken", 400 a bad shape, anything else
// generic.
function usernameSaveErrorKey(status) {
  if (status === 409) return 'errorTaken';
  if (status === 400) return 'errorInvalidChars';
  return 'errorGeneric';
}

// Reads a non-negative integer off the first key present, or null. Used for
// fields the backend has not shipped yet (e.g. total Gold used) so the UI can
// show an em dash until it does.
function optionalCount(obj, keys) {
  if (!obj) return null;
  for (const key of keys) {
    const v = obj[key];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

module.exports = {
  PROFILE_SECTIONS,
  initialSections,
  toggleSection,
  validateUsername,
  usernameSaveErrorKey,
  optionalCount,
};
