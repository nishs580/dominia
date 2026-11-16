/**
 * lib/__tests__/challengeScreen.test.js — plan U13 headers, results, CONTINUE.
 */

const {
  challengeKind,
  showsChallengeMap,
  challengeHeaderCopy,
  challengeResult,
  continueToMap,
  securedClaimToMap,
} = require('../challengeScreen');

const GEO = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };

describe('challengeKind', () => {
  test('route params → kind', () => {
    expect(challengeKind({ mode: 'claim' })).toBe('claim');
    expect(challengeKind({})).toBe('claim');
    expect(challengeKind({ mode: 'contest', role: 'attacker' })).toBe('attack');
    expect(challengeKind({ mode: 'contest', role: 'defender' })).toBe('defend');
    expect(challengeKind({ mode: 'defend' })).toBe('defend');
  });
});

describe('challengeHeaderCopy', () => {
  test('defend → DEFENDING and CANCEL DEFENSE', () => {
    const c = challengeHeaderCopy(challengeKind({ mode: 'defend' }));
    expect(c.header.defaultValue).toBe('DEFENDING');
    expect(c.cancel.defaultValue.toUpperCase()).toBe('CANCEL DEFENSE');
  });

  test('attack → ATTACKING and CANCEL ATTACK', () => {
    const c = challengeHeaderCopy('attack');
    expect(c.header.defaultValue).toBe('ATTACKING');
    expect(c.cancel.defaultValue.toUpperCase()).toBe('CANCEL ATTACK');
  });

  test('claim → CLAIMING and CANCEL CLAIM (existing keys)', () => {
    const c = challengeHeaderCopy('claim');
    expect(c.header).toEqual({ key: 'activeClaim.claiming', defaultValue: 'CLAIMING' });
    expect(c.cancel.key).toBe('activeClaim.cancelClaim');
  });
});

describe('showsChallengeMap', () => {
  const flags = (on) => (name) => on.includes(name);
  test('flags on (today) keep the ring', () => {
    const all = flags(['claim_celebration', 'contest_result_screen']);
    expect(showsChallengeMap('claim', all)).toBe(false);
    expect(showsChallengeMap('attack', all)).toBe(false);
    expect(showsChallengeMap('defend', all)).toBe(false);
  });
  test('claims follow claim_celebration, contests follow contest_result_screen', () => {
    expect(showsChallengeMap('claim', flags(['contest_result_screen']))).toBe(true);
    expect(showsChallengeMap('defend', flags(['contest_result_screen']))).toBe(false);
    expect(showsChallengeMap('defend', flags(['claim_celebration']))).toBe(true);
    expect(showsChallengeMap('attack', flags([]))).toBe(true);
  });
});

describe('challengeResult', () => {
  test('successful defence → VICTORY, territory is saved', () => {
    const r = challengeResult({ outcome: 'defender_won', role: 'defender', territoryName: 'Kolomna', opponentName: 'vlad' });
    expect(r.variant).toBe('victory');
    expect(r.label.defaultValue).toBe('VICTORY');
    expect(r.title.defaultValue).toMatch(/territory is saved/);
    expect(r.body.params.territory).toBe('Kolomna');
  });

  test('failed defence → DEFEAT naming the new owner', () => {
    const r = challengeResult({ outcome: 'attacker_won', role: 'defender', territoryName: 'Kolomna', opponentName: 'vlad' });
    expect(r.variant).toBe('defeat');
    expect(r.label.defaultValue).toBe('DEFEAT');
    expect(r.body.defaultValue).toBe('{{territory}} now belongs to {{owner}}');
    expect(r.body.params).toEqual({ territory: 'Kolomna', owner: 'vlad' });
  });

  test('attacker outcomes map to victory / defeat', () => {
    expect(challengeResult({ outcome: 'attacker_won', role: 'attacker' }).variant).toBe('victory');
    expect(challengeResult({ outcome: 'defender_won', role: 'attacker' }).variant).toBe('defeat');
  });
});

describe('continueToMap', () => {
  test('CONTINUE on either overlay returns to the map', () => {
    for (const state of ['defend_won', 'defend_lost', 'attack_won', 'attack_lost']) {
      const [name, params] = continueToMap({ state, geojson: GEO });
      expect(name).toBe('MainTabs');
      expect(params.screen).toBe('Map');
    }
  });

  test('celebration modes match ContestResultScreen', () => {
    expect(continueToMap({ state: 'attack_won', geojson: GEO })[1].params.celebration.mode).toBe('captured');
    expect(continueToMap({ state: 'defend_won', geojson: GEO })[1].params.celebration.mode).toBe('held');
    expect(continueToMap({ state: 'defend_lost', geojson: GEO })[1].params.celebration.mode).toBe('lost');
    expect(continueToMap({ state: 'attack_lost', geojson: GEO })[1].params).toBeUndefined();
    expect(continueToMap({ state: 'defend_won', geojson: null })[1].params).toBeUndefined();
  });

  test('secured claim celebrates only a fresh completion', () => {
    expect(securedClaimToMap({ envelope: { already_completed: false }, geojson: GEO })[1].params.celebration.mode).toBe('captured');
    expect(securedClaimToMap({ envelope: { already_completed: true }, geojson: GEO })[1].params).toBeUndefined();
  });
});
