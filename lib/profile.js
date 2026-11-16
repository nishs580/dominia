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

// Mirrors screens/UsernameScreen.js validateUsername (and the backend's
// normalizeUsername). Returns a `username.*` i18n key or null.
function validateUsername(name) {
  const v = (name ?? '').trim();
  if (!v) return 'errorEmpty';
  if (v.length < 2) return 'errorTooShort';
  if (v.length > 20) return 'errorTooLong';
  if (!/^[a-zA-Z0-9._]+$/.test(v)) return 'errorInvalidChars';
  return null;
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
