/**
 * lib/__tests__/allianceRoles.test.js
 *
 * U12: stored alliance roles map to the Figma display labels
 * (Captain / Commander / Lieutenant / Troop). Stored values are unchanged.
 */

const en = require('../../locales/en.json');
const ru = require('../../locales/ru.json');
const { displayRole, roleLabelKey, roleLabel, isAllianceLeader } = require('../allianceRoles');

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);

describe('displayRole', () => {
  test('founder gives Captain', () => expect(displayRole('founder')).toBe('captain'));
  test('marshal gives Commander', () => expect(displayRole('marshal')).toBe('commander'));
  test('officer gives Lieutenant', () => expect(displayRole('officer')).toBe('lieutenant'));
  test('member gives Troop', () => expect(displayRole('member')).toBe('troop'));
  test('the lower stored ranks give Troop', () => {
    for (const r of ['sergeant', 'soldier', 'recruit']) expect(displayRole(r)).toBe('troop');
  });
  test('an unknown, empty or missing role gives Troop', () => {
    for (const r of ['warlord', '', null, undefined, 42]) expect(displayRole(r)).toBe('troop');
  });
  test('upper-case stored strings map the same way', () => {
    expect(displayRole('FOUNDER')).toBe('captain');
    expect(displayRole('MARSHAL')).toBe('commander');
    expect(displayRole('OFFICER')).toBe('lieutenant');
    expect(displayRole('MEMBER')).toBe('troop');
  });
});

describe('roleLabelKey / roleLabel', () => {
  test('keys exist in both locales', () => {
    for (const r of ['founder', 'marshal', 'officer', 'member']) {
      const key = roleLabelKey(r);
      expect(typeof lookup(en, key)).toBe('string');
      expect(typeof lookup(ru, key)).toBe('string');
    }
  });
  test('English labels match Figma', () => {
    expect(lookup(en, roleLabelKey('founder'))).toBe('CAPTAIN');
    expect(lookup(en, roleLabelKey('marshal'))).toBe('COMMANDER');
    expect(lookup(en, roleLabelKey('officer'))).toBe('LIEUTENANT');
    expect(lookup(en, roleLabelKey('recruit'))).toBe('TROOP');
  });
  test('fallback labels', () => {
    expect(roleLabel('founder')).toBe('CAPTAIN');
    expect(roleLabel(null)).toBe('TROOP');
  });
});

describe('isAllianceLeader', () => {
  test('Captain and Commander lead; Lieutenant and Troop do not', () => {
    expect(isAllianceLeader('founder')).toBe(true);
    expect(isAllianceLeader('marshal')).toBe(true);
    expect(isAllianceLeader('officer')).toBe(false);
    expect(isAllianceLeader('soldier')).toBe(false);
    expect(isAllianceLeader(undefined)).toBe(false);
  });
});
