/**
 * lib/__tests__/challengeResult.test.js — plan 2026-11-28 U7 result overlay
 * (VICTORY / DEFEAT, superseding TAKEN / HELD / LOST).
 */

const {
  challengeResultModel,
  emphasisSegments,
  formatWalked,
  formatElapsed,
} = require('../challengeResult');

describe('challengeResultModel', () => {
  test('defend won → VICTORY, "Defend won, territory is saved"', () => {
    const r = challengeResultModel({
      kind: 'defend',
      outcome: 'defender_won',
      territoryName: 'Indiranagar',
      opponentName: 'Mr. ABC',
    });
    expect(r.state).toBe('defend_won');
    expect(r.variant).toBe('victory');
    expect(r.word.defaultValue).toBe('VICTORY');
    expect(r.color).toBe('lime');
    expect(r.art).toBe('glow');
    expect(r.icon).toBe('shieldCheck');
    expect(r.title.defaultValue).toBe('Defend won, territory is saved');
    expect(r.body.defaultValue).toBe('{{territory}} territory stays with you');
    expect(r.body.params.territory).toBe('Indiranagar');
  });

  test('defend lost → DEFEAT naming the new owner', () => {
    const r = challengeResultModel({
      kind: 'defend',
      outcome: 'attacker_won',
      territoryName: 'Indiranagar',
      opponentName: 'Mr. ABC',
    });
    expect(r.state).toBe('defend_lost');
    expect(r.word.defaultValue).toBe('DEFEAT');
    expect(r.color).toBe('red');
    expect(r.art).toBe('cracked');
    expect(r.icon).toBe('shieldBroken');
    expect(r.title.defaultValue).toBe('Defend lost, better luck next time!');
    expect(r.body.defaultValue).toBe('{{territory}} now belongs to {{owner}}');
    expect(r.body.params).toEqual({ territory: 'Indiranagar', owner: 'Mr. ABC' });
    expect(r.emphasis).toEqual(['Indiranagar', 'Mr. ABC']);
  });

  test('claim won → VICTORY, territory claimed', () => {
    const r = challengeResultModel({ kind: 'claim', territoryName: 'Cubbon Park' });
    expect(r.state).toBe('claim_won');
    expect(r.word.defaultValue).toBe('VICTORY');
    expect(r.title.defaultValue).toBe('Territory claimed');
    expect(r.body.defaultValue).toBe('{{territory}} is yours now');
    expect(r.emphasis).toEqual(['Cubbon Park']);
  });

  test('attack won / lost', () => {
    const won = challengeResultModel({ kind: 'attack', outcome: 'attacker_won', territoryName: 'Domlur', opponentName: 'vlad' });
    expect(won.word.defaultValue).toBe('VICTORY');
    expect(won.title.defaultValue).toBe('Attack won, territory is yours');
    const lost = challengeResultModel({ kind: 'attack', outcome: 'defender_won', territoryName: 'Domlur', opponentName: 'vlad' });
    expect(lost.word.defaultValue).toBe('DEFEAT');
    expect(lost.body.defaultValue).toBe('{{territory}} stays with {{owner}}');
    expect(lost.body.params.owner).toBe('vlad');
  });

  test('only ever VICTORY or DEFEAT', () => {
    const cases = [['attack', 'attacker_won'], ['attack', 'defender_won'], ['defend', 'attacker_won'], ['defend', 'defender_won'], ['claim']];
    for (const [kind, outcome] of cases) {
      expect(['VICTORY', 'DEFEAT']).toContain(challengeResultModel({ kind, outcome }).word.defaultValue);
    }
  });

  test('tap to continue', () => {
    expect(challengeResultModel({ kind: 'claim' }).continue.defaultValue).toBe('TAP TO CONTINUE');
  });
});

describe('emphasisSegments', () => {
  test('bolds the territory and the owner', () => {
    expect(emphasisSegments('Cubbon Park now belongs to Mr.ABC', ['Cubbon Park', 'Mr.ABC'])).toEqual([
      { text: 'Cubbon Park', bold: true },
      { text: ' now belongs to ', bold: false },
      { text: 'Mr.ABC', bold: true },
    ]);
  });
  test('longer names win overlaps; absent names are ignored', () => {
    expect(emphasisSegments('Cubbon Park stays with Park', ['Park', 'Cubbon Park'])).toEqual([
      { text: 'Cubbon Park', bold: true },
      { text: ' stays with ', bold: false },
      { text: 'Park', bold: true },
    ]);
    expect(emphasisSegments('Нет совпадений', ['Kolomna'])).toEqual([{ text: 'Нет совпадений', bold: false }]);
    expect(emphasisSegments('', [])).toEqual([]);
  });
});

describe('formatters', () => {
  test('formatWalked', () => {
    expect(formatWalked(450, 'km')).toBe('450 m');
    expect(formatWalked(2400, 'km')).toBe('2.4 km');
    expect(formatWalked(1609.344, 'mi')).toBe('1.0 mi');
    expect(formatWalked(undefined, 'km')).toBe('—');
  });
  test('formatElapsed', () => {
    expect(formatElapsed(521000)).toBe('08:41');
    expect(formatElapsed(3661000)).toBe('1:01:01');
    expect(formatElapsed(null)).toBe('—');
  });
});
