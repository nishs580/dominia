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

// ─── Figma chrome (plan U9) ──────────────────────────────────────────────

const {
  challengeHeaderModel,
  progressCaption,
  opponentBars,
  showsConnectionBanner,
} = require('../challengeScreen');

describe('challengeHeaderModel', () => {
  test('claim → lime flag, CLAIMING · IN PROGRESS, quiet CANCEL CLAIM', () => {
    const h = challengeHeaderModel('claim');
    expect(h.tone).toBe('lime');
    expect(h.icon).toBe('flag');
    expect(h.eyebrow.defaultValue).toBe('CLAIMING · IN PROGRESS');
    expect(h.cancel.defaultValue).toBe('CANCEL CLAIM');
    expect(h.cancelOutlined).toBe(false);
    expect(h.dialog.title.defaultValue).toBe('CANCEL THE CLAIM?');
    expect(h.dialog.body.defaultValue).toBe('Are you sure you want to cancel the claim? Your progress will be lost.');
    expect(h.dialog.keep.defaultValue).toBe('CONTINUE CHALLENGE');
    expect(h.cancelling.title.defaultValue).toBe('CANCELLING THE CLAIM…');
    expect(h.cancelling.body.defaultValue).toBe('Taking you back to the map.');
  });

  test('attack eyebrow names the defender, red sword, outlined CANCEL ATTACK', () => {
    const h = challengeHeaderModel('attack', { opponentName: 'Mr. ABC' });
    expect(h.tone).toBe('red');
    expect(h.icon).toBe('sword');
    expect(h.eyebrow.defaultValue).toBe('ATTACKING · DEFENDED BY {{name}}');
    expect(h.eyebrow.params).toEqual({ name: 'Mr. ABC' });
    expect(h.cancel.defaultValue).toBe('CANCEL ATTACK');
    expect(h.cancelOutlined).toBe(true);
  });

  test('defend eyebrow names the attacker, blue shield, CANCEL DEFEND', () => {
    const h = challengeHeaderModel('defend', { opponentName: 'vlad' });
    expect(h.tone).toBe('blue');
    expect(h.icon).toBe('shield');
    expect(h.eyebrow.defaultValue).toBe('DEFENDING · ATTACKED BY {{name}}');
    expect(h.eyebrow.params.name).toBe('vlad');
    expect(h.cancel.defaultValue).toBe('CANCEL DEFEND');
  });

  test('no opponent name yet → IN PROGRESS eyebrow, never an empty name', () => {
    expect(challengeHeaderModel('attack').eyebrow.defaultValue).toBe('ATTACKING · IN PROGRESS');
    expect(challengeHeaderModel('defend', { opponentName: '  ' }).eyebrow.defaultValue).toBe('DEFENDING · IN PROGRESS');
  });
});

describe('progressCaption', () => {
  test('claim reads walked / required metres', () => {
    const c = progressCaption('claim', { walkedM: 2.4, requiredM: 5 });
    expect(c.defaultValue).toBe('{{walked}} / {{required}} M · WALK ANYWHERE');
    expect(c.params).toEqual({ walked: 2, required: 5 });
  });
  test('contests read OF LOOP WALKED', () => {
    expect(progressCaption('attack').defaultValue).toBe('OF LOOP WALKED');
    expect(progressCaption('defend').defaultValue).toBe('OF LOOP WALKED');
  });
});

describe('opponentBars', () => {
  test('hidden when opponent_pct is undefined', () => {
    expect(opponentBars('attack', { myPct: 40, opponentPct: undefined })).toBeNull();
    expect(opponentBars('defend', { myPct: 40 })).toBeNull();
  });
  test('hidden on claims even with a value', () => {
    expect(opponentBars('claim', { myPct: 40, opponentPct: 20 })).toBeNull();
  });
  test('attack: YOU vs {name} · DEFENDING', () => {
    const b = opponentBars('attack', { myPct: 64, opponentPct: 41.4, opponentName: 'Mr. ABC' });
    expect(b.you).toEqual({ label: { key: 'activeClaim.figma.barYou', defaultValue: 'YOU' }, pct: 64 });
    expect(b.opponent.pct).toBe(41);
    expect(b.opponent.label.defaultValue).toBe('{{name}} · DEFENDING');
  });
  test('defend: YOU · DEFENDING vs {name} · ATTACKING, clamped', () => {
    const b = opponentBars('defend', { myPct: 140, opponentPct: 0, opponentName: 'vlad' });
    expect(b.you.label.defaultValue).toBe('YOU · DEFENDING');
    expect(b.you.pct).toBe(100);
    expect(b.opponent.pct).toBe(0);
    expect(b.opponent.label.defaultValue).toBe('{{name}} · ATTACKING');
  });
});

describe('showsConnectionBanner', () => {
  test('visible only when offline AND a challenge is active', () => {
    expect(showsConnectionBanner({ isConnected: false, challengeActive: true })).toBe(true);
    expect(showsConnectionBanner({ isConnected: true, isInternetReachable: false, challengeActive: true })).toBe(true);
    expect(showsConnectionBanner({ isConnected: false, challengeActive: false })).toBe(false);
    expect(showsConnectionBanner({ isConnected: true, isInternetReachable: true, challengeActive: true })).toBe(false);
  });
  test('unknown reachability is not offline', () => {
    expect(showsConnectionBanner({ isConnected: true, isInternetReachable: null, challengeActive: true })).toBe(false);
    expect(showsConnectionBanner({ challengeActive: true })).toBe(false);
  });
});
