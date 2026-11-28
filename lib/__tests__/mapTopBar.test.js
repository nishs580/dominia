/**
 * lib/__tests__/mapTopBar.test.js — map header initials and level pill (U5).
 */

const { mapInitials, levelValue, showLevelPill, formatGold } = require('../mapTopBar');

describe('mapInitials', () => {
  test('single word takes the first two letters', () => {
    expect(mapInitials('moksh')).toBe('MO');
  });
  test('two words take each first letter', () => {
    expect(mapInitials('Kaus Adhikari')).toBe('KA');
  });
  test('empty, whitespace or missing name is "?"', () => {
    expect(mapInitials('')).toBe('?');
    expect(mapInitials('   ')).toBe('?');
    expect(mapInitials(null)).toBe('?');
    expect(mapInitials(undefined)).toBe('?');
  });
  test('one-letter name stays one letter', () => {
    expect(mapInitials('k')).toBe('K');
  });
  test('username separators count as word breaks', () => {
    expect(mapInitials('kaus_adhikari')).toBe('KA');
  });
});

describe('level pill', () => {
  test('null or non-numeric level hides the pill', () => {
    expect(showLevelPill(null)).toBe(false);
    expect(showLevelPill(undefined)).toBe(false);
    expect(showLevelPill('abc')).toBe(false);
    expect(showLevelPill('')).toBe(false);
    expect(showLevelPill(NaN)).toBe(false);
    expect(showLevelPill(true)).toBe(false);
  });
  test('numeric level shows the pill', () => {
    expect(showLevelPill(86)).toBe(true);
    expect(showLevelPill('12')).toBe(true);
    expect(showLevelPill(0)).toBe(true);
    expect(levelValue('12')).toBe(12);
  });
});

describe('formatGold', () => {
  test('thousands separators, null while loading', () => {
    expect(formatGold(1240)).toBe('1,240');
    expect(formatGold(5)).toBe('5');
    expect(formatGold(null)).toBe(null);
  });
});
