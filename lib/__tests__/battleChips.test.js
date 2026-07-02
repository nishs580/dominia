const { CHIP_DECAY_MS, battleChipFor } = require('../battleChips');

const NOW = Date.parse('2026-07-02T12:00:00Z');

function at(minutesAgo) {
  return new Date(NOW - minutesAgo * 60000).toISOString();
}

describe('battleChipFor', () => {
  test('active contest wins over any recent outcome', () => {
    expect(
      battleChipFor({ contested: true, lastBattleOutcome: 'fell', lastBattleAt: at(10), now: NOW }),
    ).toEqual({ key: 'contested' });
  });

  test('attacker_won within 24h → fell with age in minutes', () => {
    expect(
      battleChipFor({ contested: false, lastBattleOutcome: 'fell', lastBattleAt: at(12), now: NOW }),
    ).toEqual({ key: 'fell', minutes: 12 });
  });

  test('defender_won within 24h → held', () => {
    expect(
      battleChipFor({ contested: false, lastBattleOutcome: 'held', lastBattleAt: at(120), now: NOW }),
    ).toEqual({ key: 'held', minutes: 120 });
  });

  test('decays after 24h', () => {
    expect(
      battleChipFor({
        contested: false,
        lastBattleOutcome: 'fell',
        lastBattleAt: new Date(NOW - CHIP_DECAY_MS - 1).toISOString(),
        now: NOW,
      }),
    ).toBeNull();
  });

  test('sub-minute age clamps to 1 minute', () => {
    expect(
      battleChipFor({ contested: false, lastBattleOutcome: 'fell', lastBattleAt: at(0), now: NOW }),
    ).toEqual({ key: 'fell', minutes: 1 });
  });

  test('slight future timestamp (clock skew) still shows', () => {
    expect(
      battleChipFor({
        contested: false,
        lastBattleOutcome: 'held',
        lastBattleAt: new Date(NOW + 30000).toISOString(),
        now: NOW,
      }),
    ).toEqual({ key: 'held', minutes: 1 });
  });

  test('quiet territory → null', () => {
    expect(
      battleChipFor({ contested: false, lastBattleOutcome: null, lastBattleAt: null, now: NOW }),
    ).toBeNull();
  });

  test('garbage input → null, never throws', () => {
    expect(
      battleChipFor({ contested: false, lastBattleOutcome: 'fell', lastBattleAt: 'not-a-date', now: NOW }),
    ).toBeNull();
    expect(
      battleChipFor({ contested: false, lastBattleOutcome: 'draw', lastBattleAt: at(5), now: NOW }),
    ).toBeNull();
  });
});
