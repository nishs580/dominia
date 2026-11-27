/**
 * lib/allianceValidation.js
 *
 * Pure helpers for the Figma alliance screens (alliance_hq_create off):
 * single-page create validation, join eligibility and join-error mapping.
 * No React, no network — safe under jest's node environment.
 */

'use strict';

const ALLIANCE_NAME_MIN = 3;
const ALLIANCE_NAME_MAX = 24;
const ALLIANCE_SHORT_NAME_LENGTH = 3;
const ALLIANCE_TEXT_MAX = 500; // description and rules (U7 contract)
const ALLIANCE_MAX_MEMBERS = 20; // backend MAX_ALLIANCE_MEMBERS

/** Upper-cases and strips everything but A–Z, capped at 3 — the short-name input filter. */
function sanitizeShortName(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, ALLIANCE_SHORT_NAME_LENGTH);
}

/**
 * Validate the single-page create form.
 *
 * @returns {{ ok: boolean,
 *   errors: { fullName?: string, shortName?: string, rules?: string, description?: string },
 *   values: { fullName: string, shortName: string, rules?: string, description?: string } }}
 *
 * Error codes:
 *   fullName:  'name_required' | 'name_too_short' | 'name_too_long'
 *   shortName: 'short_name_required' | 'short_name_invalid' (not exactly 3 letters)
 *   rules / description: 'text_too_long'
 * Empty rules/description are omitted from `values` (both are optional).
 */
function validateAllianceForm({ fullName, shortName, rules, description } = {}) {
  const errors = {};
  const name = String(fullName ?? '').trim();
  const short = String(shortName ?? '').trim().toUpperCase();
  const rulesTrim = String(rules ?? '').trim();
  const descTrim = String(description ?? '').trim();

  if (!name) errors.fullName = 'name_required';
  else if (name.length < ALLIANCE_NAME_MIN) errors.fullName = 'name_too_short';
  else if (name.length > ALLIANCE_NAME_MAX) errors.fullName = 'name_too_long';

  if (!short) errors.shortName = 'short_name_required';
  else if (!/^[A-Z]{3}$/.test(short)) errors.shortName = 'short_name_invalid';

  if (rulesTrim.length > ALLIANCE_TEXT_MAX) errors.rules = 'text_too_long';
  if (descTrim.length > ALLIANCE_TEXT_MAX) errors.description = 'text_too_long';

  const values = { fullName: name, shortName: short };
  if (rulesTrim) values.rules = rulesTrim;
  if (descTrim) values.description = descTrim;

  return { ok: Object.keys(errors).length === 0, errors, values };
}

/** True when the alliance has reached the member cap (Join is disabled). */
function isAllianceFull(alliance) {
  const n = Number(alliance?.member_count ?? alliance?.memberCount ?? alliance?.members?.length);
  return Number.isFinite(n) && n >= ALLIANCE_MAX_MEMBERS;
}

/**
 * i18n key for a failed join, shared by the legacy confirm view and the
 * Figma detail pop-up so both read the same messages.
 */
function joinErrorKey(error) {
  const code = error?.code ?? null;
  switch (code) {
    case 'already_in_alliance': return 'alliance.errAlreadyInAlliance';
    case 'not_same_city': return 'alliance.errNotSameCity';
    case 'level_too_low': return 'alliance.errLevelTooLowJoin';
    case 'alliance_full': return 'alliance.errAllianceFull';
    case 'alliance_disbanded': return 'alliance.errAllianceDisbanded';
    case 'alliance_not_found': return 'alliance.errAllianceNotFound';
    case 'player_not_found': return 'alliance.errAccount';
    default: return 'alliance.errCouldNotJoin';
  }
}

/**
 * Which body the Figma alliance list shows.
 *   'loading'    — first load (or a search) in flight with nothing to show
 *   'error'      — the request failed; show Retry
 *   'empty'      — no query and the city has no alliances; show Create
 *   'no_results' — a query matched nothing
 *   'list'       — rows to render
 */
function allianceListState({ loading, error, alliances, query } = {}) {
  const hasRows = Array.isArray(alliances) && alliances.length > 0;
  if (error) return 'error';
  if (loading && !hasRows) return 'loading';
  if (hasRows) return 'list';
  return String(query ?? '').trim() ? 'no_results' : 'empty';
}

/**
 * i18n key for an inline create-form field error (Dominia-Temp cases 5–6).
 * Covers both the client codes from validateAllianceForm and the server codes
 * that foundErrorFields routes to a field. Unknown codes return null.
 * CREATE_FIELD_ERROR_DEFAULTS holds the English copy (the i18n defaultValue).
 */
const CREATE_FIELD_ERROR_DEFAULTS = Object.freeze({
  'allianceFigma.errAllianceNameRequired': 'Alliance name has to be entered',
  'allianceFigma.errName': 'Alliance name must be 3–24 characters',
  'allianceFigma.errAllianceNameTaken': 'Alliance name is already taken. Please choose a different name.',
  'allianceFigma.errShortName': 'Short name must be exactly 3 letters',
  'allianceFigma.errAllianceShortNameTaken': 'Alliance short name is already taken. Please choose a different name.',
  'allianceFigma.errRulesLength': 'Rules must be 500 characters or fewer',
});

function createFieldErrorKey(code) {
  switch (code) {
    case 'name_required': return 'allianceFigma.errAllianceNameRequired';
    case 'name_too_short':
    case 'name_too_long':
    case 'name_invalid': return 'allianceFigma.errName';
    case 'full_name_taken': return 'allianceFigma.errAllianceNameTaken';
    case 'short_name_required':
    case 'short_name_invalid': return 'allianceFigma.errShortName';
    case 'short_name_taken': return 'allianceFigma.errAllianceShortNameTaken';
    case 'text_too_long': return 'allianceFigma.errRulesLength';
    default: return null;
  }
}

/** { key, defaultValue } for a field error code, or null for unknown codes. */
function createFieldError(code) {
  const key = createFieldErrorKey(code);
  return key ? { key, defaultValue: CREATE_FIELD_ERROR_DEFAULTS[key] } : null;
}

/**
 * Route a POST /alliances/found error to an inline field error so the form
 * can show it under the field with a red border (Figma F7). Returns null for
 * errors that are not about one field; the caller shows those under the CTA.
 */
function foundErrorCode(error) {
  return error?.code ?? error?.error ?? null;
}

function foundErrorFields(error) {
  const code = foundErrorCode(error);
  switch (code) {
    case 'full_name_taken': return { fullName: 'full_name_taken' };
    case 'short_name_taken': return { shortName: 'short_name_taken' };
    case 'invalid_short_name': return { shortName: 'short_name_invalid' };
    case 'invalid_full_name':
    case 'invalid_name': return { fullName: 'name_invalid' };
    // The Figma form has one free-text field (Rules); a description error
    // can only come from it too.
    case 'invalid_rules':
    case 'invalid_description': return { rules: 'text_too_long' };
    default: return null;
  }
}

/**
 * i18n key for a POST /alliances/found error that is not about one field
 * (shown under the CTA), or null to fall back to the screen's own mapping.
 * The backend sends { error: '<code>' }.
 */
const FOUND_SUBMIT_ERROR_DEFAULTS = Object.freeze({
  'allianceFigma.errNoHomeCity': 'Set your home city before founding an alliance.',
});

function foundSubmitErrorKey(error) {
  switch (foundErrorCode(error)) {
    case 'message_filtered': return 'allianceFigma.errFiltered';
    // Founding without an HQ needs the founder's home city (400 no_home_city).
    case 'no_home_city': return 'allianceFigma.errNoHomeCity';
    default: return null;
  }
}

/**
 * i18n key for a failed join-request accept/decline. The backend sends
 * { error: '<code>' }; `code` is read too for older shapes.
 */
function joinRequestErrorKey(error) {
  const code = error?.error ?? error?.code ?? null;
  switch (code) {
    case 'alliance_full': return 'alliance.errAllianceFull';
    case 'join_request_not_pending': return 'allianceFigma.errRequestNotPending';
    default: return 'allianceFigma.errRequestAction';
  }
}

/** True while any field error is showing; the Figma CTA is dimmed then. */
function hasFieldErrors(errors) {
  return Object.values(errors ?? {}).some(Boolean);
}

module.exports = {
  ALLIANCE_NAME_MIN, ALLIANCE_NAME_MAX, ALLIANCE_SHORT_NAME_LENGTH,
  ALLIANCE_TEXT_MAX, ALLIANCE_MAX_MEMBERS,
  sanitizeShortName, validateAllianceForm, isAllianceFull, joinErrorKey,
  allianceListState, createFieldErrorKey, createFieldError, CREATE_FIELD_ERROR_DEFAULTS, foundErrorFields, foundSubmitErrorKey,
  FOUND_SUBMIT_ERROR_DEFAULTS,
  joinRequestErrorKey, hasFieldErrors,
};
