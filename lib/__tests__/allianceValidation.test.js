/**
 * lib/__tests__/allianceValidation.test.js
 *
 * U15: single-page create validation (Case 6 errors), Join gating for a full
 * alliance, the level-3 join message, and the list's loading / empty /
 * error / no-results states.
 */

const en = require('../../locales/en.json');
const {
  validateAllianceForm,
  sanitizeShortName,
  isAllianceFull,
  joinErrorKey,
  allianceListState,
  createFieldErrorKey,
  createFieldError,
  foundErrorFields,
  foundSubmitErrorKey,
  FOUND_SUBMIT_ERROR_DEFAULTS,
  joinRequestErrorKey,
  hasFieldErrors,
} = require('../allianceValidation');

const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), en);

describe('validateAllianceForm', () => {
  const valid = { fullName: 'Jalahalli Cult', shortName: 'JNC' };

  test('a valid form passes and trims/upper-cases values', () => {
    const v = validateAllianceForm({ fullName: '  Jalahalli Cult ', shortName: 'jnc' });
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual({});
    expect(v.values).toEqual({ fullName: 'Jalahalli Cult', shortName: 'JNC' });
  });

  test('name under 3 characters errors', () => {
    expect(validateAllianceForm({ ...valid, fullName: 'JC' }).errors.fullName).toBe('name_too_short');
    expect(validateAllianceForm({ ...valid, fullName: '   ' }).errors.fullName).toBe('name_required');
  });

  test('name over 24 characters errors; exactly 3 and 24 pass', () => {
    expect(validateAllianceForm({ ...valid, fullName: 'x'.repeat(25) }).errors.fullName).toBe('name_too_long');
    expect(validateAllianceForm({ ...valid, fullName: 'x'.repeat(24) }).ok).toBe(true);
    expect(validateAllianceForm({ ...valid, fullName: 'abc' }).ok).toBe(true);
  });

  test('short name not exactly 3 letters errors', () => {
    expect(validateAllianceForm({ ...valid, shortName: '' }).errors.shortName).toBe('short_name_required');
    expect(validateAllianceForm({ ...valid, shortName: 'JC' }).errors.shortName).toBe('short_name_invalid');
    expect(validateAllianceForm({ ...valid, shortName: 'JNCX' }).errors.shortName).toBe('short_name_invalid');
    expect(validateAllianceForm({ ...valid, shortName: 'J1C' }).errors.shortName).toBe('short_name_invalid');
  });

  test('both fields can error at once', () => {
    const v = validateAllianceForm({ fullName: 'a', shortName: 'b' });
    expect(v.ok).toBe(false);
    expect(Object.keys(v.errors).sort()).toEqual(['fullName', 'shortName']);
  });

  test('Rules are optional: omitted when blank, kept (trimmed) when given', () => {
    expect(validateAllianceForm({ ...valid, rules: '   ' }).values).not.toHaveProperty('rules');
    expect(validateAllianceForm({ ...valid, rules: ' Walk daily. ' }).values.rules).toBe('Walk daily.');
  });

  test('Rules over 500 characters error; 500 pass', () => {
    expect(validateAllianceForm({ ...valid, rules: 'r'.repeat(501) }).errors.rules).toBe('text_too_long');
    expect(validateAllianceForm({ ...valid, rules: 'r'.repeat(500) }).ok).toBe(true);
  });
});

describe('sanitizeShortName', () => {
  test('keeps only letters, upper-cased, max 3', () => {
    expect(sanitizeShortName('j1n-cx')).toBe('JNC');
    expect(sanitizeShortName(null)).toBe('');
  });
});

describe('isAllianceFull', () => {
  test('a full alliance (20/20) disables Join', () => {
    expect(isAllianceFull({ member_count: 20 })).toBe(true);
    expect(isAllianceFull({ member_count: 19 })).toBe(false);
    expect(isAllianceFull({ members: new Array(20).fill({}) })).toBe(true);
    expect(isAllianceFull({})).toBe(false);
  });
});

describe('joinErrorKey', () => {
  test('join below level 3 maps to the existing level message', () => {
    const key = joinErrorKey({ code: 'level_too_low' });
    expect(key).toBe('alliance.errLevelTooLowJoin');
    expect(lookup(key)).toMatch(/Level 3/);
  });

  test('every mapped key exists in en.json, unknown codes fall back', () => {
    const codes = ['already_in_alliance', 'not_same_city', 'level_too_low', 'alliance_full',
      'alliance_disbanded', 'alliance_not_found', 'player_not_found', 'weird', undefined];
    for (const code of codes) {
      expect(typeof lookup(joinErrorKey({ code }))).toBe('string');
    }
    expect(joinErrorKey(null)).toBe('alliance.errCouldNotJoin');
  });
});

describe('allianceListState', () => {
  test('city with no alliances shows the empty state (with Create)', () => {
    expect(allianceListState({ loading: false, error: false, alliances: [], query: '' })).toBe('empty');
  });

  test('a failed list request shows retry', () => {
    expect(allianceListState({ loading: false, error: true, alliances: [], query: '' })).toBe('error');
  });

  test('a search with no matches shows its own no-results state', () => {
    expect(allianceListState({ loading: false, error: false, alliances: [], query: 'Glory' })).toBe('no_results');
  });

  test('loading with nothing to show, and rows to render', () => {
    expect(allianceListState({ loading: true, alliances: [] })).toBe('loading');
    expect(allianceListState({ loading: true, alliances: [{ id: 'a' }] })).toBe('list');
    expect(allianceListState({ loading: false, alliances: [{ id: 'a' }], query: 'Glory' })).toBe('list');
  });
});

describe('U9: create form inline errors (Dominia-Temp cases 5–6)', () => {
  test('an empty name maps to the "has to be entered" error', () => {
    const v = validateAllianceForm({ fullName: '   ', shortName: 'JIC' });
    expect(createFieldError(v.errors.fullName)).toEqual({
      key: 'allianceFigma.errAllianceNameRequired',
      defaultValue: 'Alliance name has to be entered',
    });
  });

  test('two characters is too short, 25 too long (both the 3–24 message)', () => {
    const short = validateAllianceForm({ fullName: 'JC', shortName: 'JIC' }).errors.fullName;
    const long = validateAllianceForm({ fullName: 'x'.repeat(25), shortName: 'JIC' }).errors.fullName;
    expect(short).toBe('name_too_short');
    expect(long).toBe('name_too_long');
    expect(createFieldError(short).defaultValue).toBe('Alliance name must be 3–24 characters');
    expect(createFieldErrorKey(long)).toBe(createFieldErrorKey(short));
  });

  test('"snw" upper-cases to "SNW" and is valid; "SN1" is invalid', () => {
    const ok = validateAllianceForm({ fullName: 'Snow Wolves', shortName: 'snw' });
    expect(ok.ok).toBe(true);
    expect(ok.values.shortName).toBe('SNW');
    expect(sanitizeShortName('snw')).toBe('SNW');
    expect(validateAllianceForm({ fullName: 'Snow Wolves', shortName: 'SN1' }).errors.shortName).toBe('short_name_invalid');
  });

  test('server full_name_taken maps to the full-name field error', () => {
    for (const body of [{ code: 'full_name_taken' }, { error: 'full_name_taken' }]) {
      const fields = foundErrorFields(body);
      expect(fields).toEqual({ fullName: 'full_name_taken' });
      expect(createFieldError(fields.fullName)).toEqual({
        key: 'allianceFigma.errAllianceNameTaken',
        defaultValue: 'Alliance name is already taken. Please choose a different name.',
      });
    }
  });

  test('server short_name_taken maps to the short-name field error', () => {
    const fields = foundErrorFields({ code: 'short_name_taken' });
    expect(fields).toEqual({ shortName: 'short_name_taken' });
    expect(createFieldError(fields.shortName)).toEqual({
      key: 'allianceFigma.errAllianceShortNameTaken',
      defaultValue: 'Alliance short name is already taken. Please choose a different name.',
    });
  });

  test('other server field errors route to their field; the rest are not field errors', () => {
    expect(foundErrorFields({ code: 'invalid_full_name' })).toEqual({ fullName: 'name_invalid' });
    expect(foundErrorFields({ code: 'invalid_short_name' })).toEqual({ shortName: 'short_name_invalid' });
    expect(foundErrorFields({ code: 'level_too_low' })).toBeNull();
    expect(foundErrorFields('network_error')).toBeNull();
  });

  test('backend { error } bodies: invalid_rules / invalid_description go to the rules field', () => {
    expect(foundErrorFields({ error: 'invalid_rules' })).toEqual({ rules: 'text_too_long' });
    expect(foundErrorFields({ error: 'invalid_description' })).toEqual({ rules: 'text_too_long' });
    expect(foundErrorFields({ error: 'short_name_taken' })).toEqual({ shortName: 'short_name_taken' });
    expect(foundErrorFields({ error: 'invalid_name' })).toEqual({ fullName: 'name_invalid' });
    expect(lookup(createFieldErrorKey('text_too_long'))).toBe('Rules must be 500 characters or fewer');
  });

  test('message_filtered is a submit error with its own copy', () => {
    expect(foundErrorFields({ error: 'message_filtered' })).toBeNull();
    expect(foundSubmitErrorKey({ error: 'message_filtered' })).toBe('allianceFigma.errFiltered');
    expect(foundSubmitErrorKey({ code: 'message_filtered' })).toBe('allianceFigma.errFiltered');
    expect(foundSubmitErrorKey({ error: 'level_too_low' })).toBeNull();
    expect(typeof lookup('allianceFigma.errFiltered')).toBe('string');
  });

  test('no_home_city (found without HQ, founder has no home city) is a form-level error', () => {
    expect(foundSubmitErrorKey({ error: 'no_home_city' })).toBe('allianceFigma.errNoHomeCity');
    expect(foundErrorFields({ error: 'no_home_city' })).toBeNull();
    expect(lookup('allianceFigma.errNoHomeCity')).toBe(FOUND_SUBMIT_ERROR_DEFAULTS['allianceFigma.errNoHomeCity']);
  });
});

describe('joinRequestErrorKey', () => {
  test('reads the backend { error } body, then code', () => {
    expect(joinRequestErrorKey({ error: 'alliance_full' })).toBe('alliance.errAllianceFull');
    expect(joinRequestErrorKey({ code: 'alliance_full' })).toBe('alliance.errAllianceFull');
    expect(joinRequestErrorKey({ error: 'join_request_not_pending' })).toBe('allianceFigma.errRequestNotPending');
    expect(joinRequestErrorKey({ error: 'insufficient_permission' })).toBe('allianceFigma.errRequestAction');
    expect(joinRequestErrorKey('network_error')).toBe('allianceFigma.errRequestAction');
  });

  test('every key it returns exists in en', () => {
    for (const key of ['alliance.errAllianceFull', 'allianceFigma.errRequestNotPending', 'allianceFigma.errRequestAction']) {
      expect(typeof lookup(key)).toBe('string');
    }
  });

  test('every client and server field code has a key with English default copy', () => {
    for (const code of ['name_required', 'name_too_short', 'name_too_long', 'name_invalid',
      'full_name_taken', 'short_name_required', 'short_name_invalid', 'short_name_taken', 'text_too_long']) {
      const err = createFieldError(code);
      expect(err.key).toBe(createFieldErrorKey(code));
      expect(typeof err.defaultValue).toBe('string');
      expect(err.defaultValue.length).toBeGreaterThan(0);
    }
    expect(createFieldErrorKey('nope')).toBeNull();
    expect(createFieldError('nope')).toBeNull();
  });

  test('the CTA dims while any field error shows', () => {
    expect(hasFieldErrors({ fullName: 'name_required' })).toBe(true);
    expect(hasFieldErrors({ fullName: undefined, shortName: undefined })).toBe(false);
    expect(hasFieldErrors(null)).toBe(false);
  });
});
