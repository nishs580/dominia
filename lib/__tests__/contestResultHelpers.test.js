/**
 * lib/__tests__/contestResultHelpers.test.js
 */

const { mobileStateFromOutcome } = require('../contestResultHelpers');

describe('mobileStateFromOutcome', () => {
  test('attacker + attacker_won → attack_won', () => {
    expect(mobileStateFromOutcome('attacker_won', 'attacker')).toBe('attack_won');
  });

  test('attacker + defender_won → attack_lost', () => {
    expect(mobileStateFromOutcome('defender_won', 'attacker')).toBe('attack_lost');
  });

  test('defender + defender_won → defend_won', () => {
    expect(mobileStateFromOutcome('defender_won', 'defender')).toBe('defend_won');
  });

  test('defender + attacker_won → defend_lost', () => {
    expect(mobileStateFromOutcome('attacker_won', 'defender')).toBe('defend_lost');
  });
});
