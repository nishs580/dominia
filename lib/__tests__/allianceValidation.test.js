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
