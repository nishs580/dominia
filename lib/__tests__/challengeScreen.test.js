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

// ─── Dominia-Temp challenge flow (plan 2026-11-28 U7) ────────────────────

const {
  challengeHeaderModel,
  progressCaption,
  opponentProgress,
  formatClock,
  readyScreenModel,
  perimeterTrace,
  showsConnectionBanner,
} = require('../challengeScreen');

describe('challengeHeaderModel (Dominia-Temp in progress)', () => {
  test('claim, attack and defend eyebrows and cancel labels', () => {
    const cases = [
      ['claim', 'CLAIMING', 'CANCEL CLAIM'],
      ['attack', 'ATTACKING', 'CANCEL ATTACK'],
      ['defend', 'DEFENDING', 'CANCEL DEFEND'],
    ];
    for (const [kind, eyebrow, cancel] of cases) {
      const h = challengeHeaderModel(kind);
      expect(h.eyebrow.defaultValue).toBe(eyebrow);
      expect(h.cancel.defaultValue).toBe(cancel);
      expect(h.dialog.confirm.defaultValue).toBe(cancel);
      expect(h.chip.defaultValue).toBe('IN PROGRESS');
    }
  });

  test('claim confirm panel, status lines and instruction', () => {
    const h = challengeHeaderModel('claim');
    expect(h.dialog.prompt.defaultValue).toBe('Are you sure that you want to cancel the claim?');
    expect(h.dialog.keep.defaultValue).toBe('CONTINUE CHALLENGE');
    expect(h.cancelling.defaultValue).toBe('Cancelling the Claim…');
    expect(h.securing.defaultValue).toBe('Securing the Claim…');
    expect(h.fillHint.defaultValue).toBe('Walk anywhere, The territory fills as your distance adds up');
  });

  test('unknown kind falls back to claim', () => {
    expect(challengeHeaderModel('nope').eyebrow.defaultValue).toBe('CLAIMING');
  });
});

describe('progressCaption', () => {
  test('reads walked / required metres', () => {
    const c = progressCaption('claim', { walkedM: 2.4, requiredM: 5 });
    expect(c.defaultValue).toBe('{{walked}} / {{required}}m');
    expect(c.params).toEqual({ walked: 2, required: 5 });
    expect(progressCaption('attack', { walkedM: 9, requiredM: 5 }).params.walked).toBe(5);
  });
  test('hidden while the requirement is unknown', () => {
    expect(progressCaption('defend', { walkedM: 3, requiredM: 0 })).toBeNull();
  });
});

describe('opponentProgress', () => {
  test('hidden with no opponent progress', () => {
    expect(opponentProgress('attack', undefined)).toBeNull();
    expect(opponentProgress('defend', 0)).toBeNull();
    expect(opponentProgress('defend', NaN)).toBeNull();
  });
  test('hidden on claims even with a value', () => {
    expect(opponentProgress('claim', 20)).toBeNull();
  });
  test('percent → fraction, clamped', () => {
    expect(opponentProgress('attack', 25)).toBe(0.25);
    expect(opponentProgress('defend', 140)).toBe(1);
  });
});

describe('formatClock', () => {
  test('TIME LEFT reads "09 : 32"', () => {
    expect(formatClock((9 * 60 + 32) * 1000)).toBe('09 : 32');
    expect(formatClock(0)).toBe('00 : 00');
    expect(formatClock(3725000)).toBe('1 : 02 : 05');
    expect(formatClock(-5)).toBe('00 : 00');
  });
});

describe('readyScreenModel', () => {
  test('a 59 second countdown formats as "59" with SECONDS TO START', () => {
    const r = readyScreenModel({ secondsLeft: 59, perimeterM: 5, walkWindowMinutes: 10, goldPaid: 10 });
    expect(r.countdown).toBe('59');
    expect(r.countdownLabel.defaultValue).toBe('SECONDS TO START');
  });

  test('title, body and stake come from the data', () => {
    const r = readyScreenModel({ secondsLeft: 12.2, perimeterM: 5.4, walkWindowMinutes: 10, goldPaid: 10 });
    expect(r.countdown).toBe('13');
    expect(r.title.defaultValue).toBe('WALK {{metres}}M TO CLAIM IT.');
    expect(r.title.params).toEqual({ metres: 5 });
    expect(r.body.defaultValue).toBe('Start when you are ready to move. You get {{minutes}} minutes to cover it, walk anywhere');
    expect(r.body.params).toEqual({ minutes: 10 });
    expect(r.stake.defaultValue).toBe('{{gold}} Gold is used once you start');
    expect(r.stake.params).toEqual({ gold: 10 });
    expect(r.start.defaultValue).toBe('START WALK');
    expect(r.notYet.defaultValue).toBe('NOT YET');
    expect(r.startDisabled).toBe(false);
    expect(r.hint).toBeNull();
  });

  test('free claims carry no stake; no window drops the minutes', () => {
    const r = readyScreenModel({ secondsLeft: 0, perimeterM: 5, goldPaid: 10, freeClaim: true });
    expect(r.stake).toBeNull();
    expect(r.countdown).toBe('0');
    expect(r.body.defaultValue).toBe('Start when you are ready to move. Walk anywhere');
  });

  test('insufficient Gold disables START with a hint', () => {
    const r = readyScreenModel({ secondsLeft: 30, perimeterM: 5, goldPaid: 10, armError: 'insufficient_gold' });
    expect(r.startDisabled).toBe(true);
    expect(r.hint.defaultValue).toBe('Not enough gold');
  });

  test('any other activate error keeps START live with a retry hint', () => {
    const r = readyScreenModel({ secondsLeft: 30, perimeterM: 5, armError: 'network_error' });
    expect(r.startDisabled).toBe(false);
    expect(r.hint.key).toBe('activeClaim.arm.error');
  });
});

describe('perimeterTrace', () => {
  // Unit square, counter-clockwise, perimeter 4 (at the equator).
  const SQ = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };

  test('nothing drawn at 0', () => {
    const r = perimeterTrace(SQ, 0);
    expect(r.line).toBeNull();
    expect(r.head).toEqual([0, 0]);
  });

  test('half way round ends at the opposite corner', () => {
    const r = perimeterTrace(SQ, 0.5);
    expect(r.line.coordinates).toEqual([[0, 0], [1, 0], [1, 1]]);
    expect(r.head).toEqual([1, 1]);
  });

  test('mid-segment head is interpolated', () => {
    const r = perimeterTrace(SQ, 0.125);
    expect(r.head[0]).toBeCloseTo(0.5);
    expect(r.head[1]).toBeCloseTo(0);
  });

  test('full trace closes the ring; fraction clamps', () => {
    const r = perimeterTrace(SQ, 2);
    expect(r.line.coordinates[r.line.coordinates.length - 1]).toEqual([0, 0]);
  });

  test('inward offset sign follows ring orientation', () => {
    expect(perimeterTrace(SQ, 0.5).inward).toBe(-1);
    const cw = { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] };
    expect(perimeterTrace(cw, 0.5).inward).toBe(1);
  });

  test('unclosed rings and multipolygons work; bad input is empty', () => {
    const open = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] };
    expect(perimeterTrace(open, 1).line.coordinates).toHaveLength(5);
    const multi = { type: 'MultiPolygon', coordinates: [SQ.coordinates] };
    expect(perimeterTrace(multi, 0.5).head).toEqual([1, 1]);
    expect(perimeterTrace(null, 0.5)).toEqual({ line: null, head: null, inward: -1 });
    expect(perimeterTrace({ type: 'Point', coordinates: [0, 0] }, 0.5).line).toBeNull();
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

// ─── Contest walk start guard ────────────────────────────────────────────

const { startsContestWalk } = require('../challengeScreen');

describe('startsContestWalk', () => {
  const base = { mode: 'contest', contestId: 'c1', playerId: 'p1' };

  test('attacker needs a positive requirement', () => {
    expect(startsContestWalk({ ...base, role: 'attacker', requiredWalkM: 500 })).toBe(true);
    expect(startsContestWalk({ ...base, role: 'attacker', requiredWalkM: 0 })).toBe(false);
  });

  test('a direct defend before the attacker walks (requiredWalkM 0) still starts the walk', () => {
    expect(startsContestWalk({ ...base, role: 'defender', requiredWalkM: 0 })).toBe(true);
    expect(startsContestWalk({ ...base, role: 'defender', requiredWalkM: undefined })).toBe(true);
  });

  test('never outside contest mode or without ids', () => {
    expect(startsContestWalk({ ...base, mode: 'claim', role: 'defender', requiredWalkM: 10 })).toBe(false);
    expect(startsContestWalk({ ...base, contestId: null, role: 'defender' })).toBe(false);
    expect(startsContestWalk({ ...base, playerId: undefined, role: 'defender' })).toBe(false);
  });
});
