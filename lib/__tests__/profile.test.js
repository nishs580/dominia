const fs = require('fs');
const path = require('path');
const P = require('../profile');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('accordion sections', () => {
  test('all five sections start closed', () => {
    expect(P.initialSections()).toEqual({
      territories: false,
      activity: false,
      resources: false,
      settings: false,
      statistics: false,
    });
  });

  test('opening one section leaves the others as they were', () => {
    let s = P.initialSections();
    s = P.toggleSection(s, 'settings');
    s = P.toggleSection(s, 'activity');
    expect(s).toEqual({ ...P.initialSections(), settings: true, activity: true });
    const before = { ...s };
    s = P.toggleSection(s, 'resources');
    for (const k of P.PROFILE_SECTIONS) {
      if (k !== 'resources') expect(s[k]).toBe(before[k]);
    }
    expect(P.toggleSection(s, 'settings').settings).toBe(false);
  });
});

describe('username', () => {
  test('validation matches the onboarding picker', () => {
    expect(P.validateUsername('')).toBe('errorEmpty');
    expect(P.validateUsername(' a ')).toBe('errorTooShort');
    expect(P.validateUsername('a'.repeat(21))).toBe('errorTooLong');
    expect(P.validateUsername('bad name')).toBe('errorInvalidChars');
    // New names are letters and digits only (Updated UX A4c).
    expect(P.validateUsername('good.name_1')).toBe('errorInvalidChars');
    expect(P.validateUsername('goodname1')).toBeNull();
  });

  test('UsernameScreen uses the shared rules module', () => {
    const src = read('screens/UsernameScreen.js');
    expect(src).toMatch(/require\('\.\.\/lib\/usernameRules'\)|from '\.\.\/lib\/usernameRules'/);
  });

  test('name change rejected as taken shows the existing availability error', () => {
    expect(P.usernameSaveErrorKey(409)).toBe('errorTaken');
    expect(P.usernameSaveErrorKey(400)).toBe('errorInvalidChars');
    expect(P.usernameSaveErrorKey(0)).toBe('errorGeneric');
    expect(P.usernameSaveErrorKey(500)).toBe('errorGeneric');
    // EditProfileScreen renders these under the onboarding `username.*` keys.
    expect(read('screens/EditProfileScreen.js')).toMatch(/t\(`username\.\$\{/);
  });
});

describe('optionalCount', () => {
  test('reads the first usable key, else null', () => {
    expect(P.optionalCount(null, ['a'])).toBeNull();
    expect(P.optionalCount({}, ['a'])).toBeNull();
    expect(P.optionalCount({ a: null, b: '1200' }, ['a', 'b'])).toBe(1200);
    expect(P.optionalCount({ a: -1 }, ['a'])).toBeNull();
    expect(P.optionalCount({ a: 0 }, ['a'])).toBe(0);
  });
});

describe('Profile route', () => {
  test('App.js mounts the accordion with power_rank off and ProfileScreen with it on', () => {
    const app = read('App.js');
    expect(app).toMatch(/useFlag\('power_rank'\)/);
    expect(app).toMatch(/powerRank \? <ProfileScreen \{\.\.\.props\} \/> : <ProfileAccordionScreen \{\.\.\.props\} \/>/);
    expect(app).toMatch(/<Stack\.Screen name="EditProfile" component=\{EditProfileScreen\} \/>/);
  });
});
