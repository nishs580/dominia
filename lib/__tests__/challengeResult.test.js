/**
 * lib/__tests__/challengeResult.test.js — plan U9 result moments.
 */

const { challengeResultModel, formatWalked, formatElapsed } = require('../challengeResult');

const values = (r) => r.stats.map((s) => s.value);
const labels = (r) => r.stats.map((s) => s.label.defaultValue);

describe('challengeResultModel', () => {
  test('won attack → TAKEN in green with a +tier Gold reward', () => {
    const r = challengeResultModel({
      kind: 'attack',
      outcome: 'attacker_won',
      territoryName: 'Domlur',
      opponentName: 'Mr. ABC',
      walkedM: 2400,
      elapsedMs: (8 * 60 + 41) * 1000,
      unit: 'km',
      goldAwarded: 10,
    });
    expect(r.state).toBe('attack_won');
    expect(r.moment.defaultValue).toBe('TAKEN');
    expect(r.color).toBe('green');
    expect(r.eyebrow.defaultValue).toBe('{{territory}} · ATTACK WON');
    expect(r.eyebrow.params.territory).toBe('Domlur');
    expect(r.body.defaultValue).toBe('You out-walked {{opponent}}. {{territory}} is yours now.');
    expect(labels(r)).toEqual(['WALKED', 'TIME', 'REWARD']);
    expect(values(r)).toEqual(['2.4 km', '08:41', '+10']);
    expect(r.stats[2].color).toBe('lime');
    expect(r.backToMap.defaultValue).toBe('BACK TO MAP');
  });

  test('failed attack (Case 8) → LOST in red, opponent 100%, −Gold', () => {
    const r = challengeResultModel({
      kind: 'attack',
      outcome: 'defender_won',
      territoryName: 'Domlur',
      opponentName: 'Mr. ABC',
      myPct: 58,
      goldLost: 8,
    });
    expect(r.state).toBe('attack_lost');
    expect(r.moment.defaultValue).toBe('LOST');
    expect(r.color).toBe('red');
    expect(r.eyebrow.defaultValue).toBe('ATTACK FAILED · {{territory}}');
    expect(labels(r)).toEqual(['YOU', '{{name}}', 'GOLD']);
    expect(r.stats[1].label.params).toEqual({ name: 'Mr. ABC' });
    expect(values(r)).toEqual(['58%', '100%', '−8']);
    expect(r.stats[1].color).toBe('red');
  });

  test('defence held → HELD in green with you 100% and the reward', () => {
    const r = challengeResultModel({
      kind: 'defend',
      outcome: 'defender_won',
      territoryName: 'Indiranagar',
      opponentName: 'Mr. ABC',
      opponentPct: 71,
      goldAwarded: 5,
    });
    expect(r.state).toBe('defend_won');
    expect(r.moment.defaultValue).toBe('HELD');
    expect(r.color).toBe('green');
    expect(r.eyebrow.defaultValue).toBe('DEFEND WON · {{territory}}');
    expect(values(r)).toEqual(['100%', '71%', '+5']);
  });

  test('defence lost → LOST in red', () => {
    const r = challengeResultModel({
      kind: 'defend',
      outcome: 'attacker_won',
      territoryName: 'Indiranagar',
      opponentName: 'Mr. ABC',
      myPct: 58,
      goldLost: 5,
    });
    expect(r.state).toBe('defend_lost');
    expect(r.moment.defaultValue).toBe('LOST');
    expect(r.color).toBe('red');
    expect(r.eyebrow.defaultValue).toBe('DEFEND LOST · {{territory}}');
    expect(r.body.params.opponent).toBe('Mr. ABC');
    expect(values(r)).toEqual(['58%', '100%', '−5']);
  });

  test('free first claim → TAKEN with the reward shown as FREE', () => {
    const r = challengeResultModel({
      kind: 'claim',
      territoryName: 'Cubbon Park',
      walkedM: 5,
      elapsedMs: 61000,
      unit: 'km',
      freeClaim: true,
      goldAwarded: 0,
    });
    expect(r.state).toBe('claim_won');
    expect(r.moment.defaultValue).toBe('TAKEN');
    expect(r.color).toBe('green');
    expect(r.stats[0].value).toBe('5 m');
    expect(r.stats[1].value).toBe('01:01');
    expect(r.stats[2].value).toBeNull();
    expect(r.stats[2].valueCopy.defaultValue).toBe('FREE');
  });

  test('paid claim shows the Gold awarded', () => {
    const r = challengeResultModel({ kind: 'claim', goldAwarded: 12 });
    expect(r.stats[2].value).toBe('+12');
    expect(r.stats[2].valueCopy).toBeNull();
  });

  test('never VICTORY or DEFEAT', () => {
    const cases = [['attack', 'attacker_won'], ['attack', 'defender_won'], ['defend', 'attacker_won'], ['defend', 'defender_won'], ['claim']];
    for (const [kind, outcome] of cases) {
      expect(['TAKEN', 'HELD', 'LOST']).toContain(challengeResultModel({ kind, outcome }).moment.defaultValue);
    }
  });

  test('missing Gold numbers read as a dash, never a fake amount', () => {
    const r = challengeResultModel({ kind: 'attack', outcome: 'defender_won' });
    expect(values(r)).toEqual(['—', '100%', '—']);
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
