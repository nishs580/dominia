/**
 * lib/__tests__/missions.test.js — plan U14 Missions screen decisions, the
 * lock-axis call and its error mapping.
 */

const fs = require('fs');
const path = require('path');

const BACKEND = 'https://backend.test';

jest.mock('../api', () => ({ BACKEND_URL: 'https://backend.test' }));

// challengeAxes.js is ESM; load the real catalog by stripping `export`.
jest.mock('../challengeAxes', () => {
  // eslint-disable-next-line global-require
  const fsx = require('fs');
  // eslint-disable-next-line global-require
  const px = require('path');
  let src = fsx.readFileSync(px.join(__dirname, '..', 'challengeAxes.js'), 'utf8');
  src = src.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
  src += '\nreturn { AXES, AXIS_CATALOG, TIERS, XP_PER_TIER };';
  // eslint-disable-next-line no-new-func
  return new Function(src)();
});

const M = require('../missions');

const TOKEN = 'jwt';
const getToken = jest.fn(async () => TOKEN);

function fetchReturning(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return jest.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => text }));
}

function at(y, mo, d, h, mi, s = 0) {
  return new Date(y, mo - 1, d, h, mi, s);
}

describe('mission catalog', () => {
  test('MARCH lists 5k / 10k / 15k steps with 10 / 20 / 40 Gold', () => {
    const defs = M.missionDefs('march');
    expect(defs.map((d) => d.tier)).toEqual(['easy', 'medium', 'hard']);
    expect(defs.map((d) => d.target)).toEqual([5000, 10000, 15000]);
    expect(defs.map((d) => d.gold)).toEqual([10, 20, 40]);
    expect(defs[0].earnKey).toBe('easy_step_challenge');
  });

  test('only MARCH and RANGE exist', () => {
    expect(M.MISSION_TYPES).toEqual(['march', 'range']);
    expect(M.missionDefs('drill')).toEqual([]);
  });

  test('server lock values map to mission types', () => {
    expect(M.lockedTypeFrom('steps')).toBe('march');
    expect(M.lockedTypeFrom('distance')).toBe('range');
    expect(M.lockedTypeFrom('range')).toBe('range');
    expect(M.lockedTypeFrom('calories')).toBe('other');
    expect(M.lockedTypeFrom(null)).toBeNull();
  });
});

describe('toggle before LOCK', () => {
  test('toggling MARCH/RANGE changes the listed missions', () => {
    let s = M.lockReducer(M.initialLockState, { type: 'LOADED', lockedAxis: null });
    const march = M.buildMissionRows({ type: s.type, aggregates: {}, lockedType: s.lockedType });
    s = M.lockReducer(s, { type: 'SELECT_TYPE', missionType: 'range' });
    expect(s.type).toBe('range');
    const range = M.buildMissionRows({ type: s.type, aggregates: {}, lockedType: s.lockedType });
    expect(march.map((r) => r.earnKey)).not.toEqual(range.map((r) => r.earnKey));
    expect(range.map((r) => r.target)).toEqual([2500, 4000, 8000]);
    expect(M.typeDescription('range').key).toBe('missions.descRange');
  });

  test('before LOCK no row shows CLAIM, even when reached', () => {
    const rows = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 20000 }, lockedType: null });
    expect(rows.every((r) => !r.showClaim && !r.canClaim)).toBe(true);
  });
});

describe('LOCK confirmation', () => {
  function run(confirmResult, lockResult = { ok: true, lockedType: 'march' }) {
    let state = M.initialLockState;
    const dispatch = (a) => { state = M.lockReducer(state, a); };
    const lock = jest.fn(async () => lockResult);
    const confirm = jest.fn(async () => confirmResult);
    return M.confirmAndLock({ state, confirm, lock, dispatch }).then((out) => ({ out, state, lock, confirm }));
  }

  test('cancelling leaves the toggle enabled and sends nothing', async () => {
    const { out, state, lock, confirm } = await run(false);
    expect(confirm).toHaveBeenCalledWith('march');
    expect(out.status).toBe('cancelled');
    expect(lock).not.toHaveBeenCalled();
    expect(M.isToggleEnabled(state)).toBe(true);
    expect(state.confirming).toBe(false);
  });

  test('confirming locks and disables the toggle', async () => {
    const { out, state, lock } = await run(true);
    expect(lock).toHaveBeenCalledWith('march');
    expect(out.status).toBe('locked');
    expect(state.lockedType).toBe('march');
    expect(M.isToggleEnabled(state)).toBe(false);
    expect(M.lockReducer(state, { type: 'SELECT_TYPE', missionType: 'range' }).type).toBe('march');
  });

  test('a failed lock keeps the toggle enabled with a retryable error', async () => {
    const { state } = await run(true, { ok: false, code: 'network', retryable: true, lockedType: null });
    expect(M.isToggleEnabled(state)).toBe(true);
    expect(state.error).toMatchObject({ code: 'network', retryable: true });
  });

  test('a 409 adopts the server lock', async () => {
    const { state } = await run(true, { ok: false, code: 'already_locked', retryable: false, lockedType: 'range' });
    expect(state.lockedType).toBe('range');
    expect(state.type).toBe('range');
    expect(M.isToggleEnabled(state)).toBe(false);
  });

  test('after LOCK the lock survives a reinstall: it comes from the server', () => {
    // Fresh install: initial state, then today's payload carries locked_axis.
    const s = M.lockReducer(M.initialLockState, { type: 'LOADED', lockedAxis: 'distance' });
    expect(s.lockedType).toBe('range');
    expect(s.type).toBe('range');
    expect(M.isToggleEnabled(s)).toBe(false);
  });

  test('midnight clears the lock until reload', () => {
    const s = M.lockReducer({ ...M.initialLockState, lockedType: 'march' }, { type: 'DAY_ROLLED' });
    expect(M.isToggleEnabled(s)).toBe(true);
  });
});

describe('CLAIM', () => {
  test('4,999 of 5,000 steps shows CLAIM disabled; 5,000 enables it', () => {
    const below = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 4999 }, lockedType: 'march' });
    expect(below[0]).toMatchObject({ showClaim: true, canClaim: false, current: 4999 });
    const atTarget = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 5000 }, lockedType: 'march' });
    expect(atTarget[0]).toMatchObject({ showClaim: true, canClaim: true });
    expect(atTarget[1].canClaim).toBe(false);
  });

  test('live steps ahead of the server count', () => {
    const rows = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 100 }, live: { steps: 5200 }, lockedType: 'march' });
    expect(rows[0].canClaim).toBe(true);
  });

  test('rows of the other type never show CLAIM', () => {
    const rows = M.buildMissionRows({ type: 'range', aggregates: { daily_distance_m: 9000 }, lockedType: 'march' });
    expect(rows.every((r) => !r.showClaim)).toBe(true);
  });

  test('CLAIM credits the reward returned by the server and marks the mission secured', async () => {
    const fetchImpl = fetchReturning(200, {
      already_completed: false,
      xp_awarded: 50,
      resources_awarded: { iron: 0, stone: 0, gold: 15, morale: 0 },
      player_resources: { gold: 115 },
    });
    const mission = M.missionDefs('march')[0];
    const res = await M.claimMission({ clerkGetToken: getToken, mission, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(`${BACKEND}/me/challenge-complete`, expect.objectContaining({ method: 'POST' }));
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent).toEqual({ challenge_key: 'easy_step_challenge', tier: 'easy', earn_key: 'easy_step_challenge' });
    expect(res).toMatchObject({ ok: true, gold: 15, xp: 50, playerGold: 115 });

    const { completedKeys, credited } = M.applyClaim(new Set(), mission, res);
    expect(credited).toBe(15); // server figure, not the 10 display value
    const rows = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 6000 }, completedKeys, lockedType: 'march' });
    expect(rows[0]).toMatchObject({ secured: true, canClaim: false });
  });

  test('a failed claim secures nothing', () => {
    const { completedKeys, credited } = M.applyClaim(new Set(), M.missionDefs('march')[0], { ok: false });
    expect(completedKeys.size).toBe(0);
    expect(credited).toBe(0);
  });

  test('claim error mapping', () => {
    expect(M.mapClaimError(0)).toEqual({ code: 'network', retryable: true });
    expect(M.mapClaimError(403, { error: 'daily_steps_under_threshold' })).toEqual({ code: 'not_yet', retryable: true });
    expect(M.mapClaimError(403, { error: 'weekend_no_challenges' }).code).toBe('not_today');
    expect(M.mapClaimError(409, { error: 'axis_locked' }).code).toBe('axis_locked');
    expect(M.mapClaimError(500).retryable).toBe(true);
  });
});

describe('midnight carry-over', () => {
  test('mission completed at 23:50 and claimed at 00:05 still credits its reward', async () => {
    const late = at(2026, 11, 16, 23, 50);
    const dayKey = M.localDayKey(late);
    const rows = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 5100 }, lockedType: 'march' });
    const snap = M.nextSnapshot(null, M.snapshotClaimables({ dayKey, rows }), dayKey);
    expect(snap.missions.map((m) => m.tier)).toEqual(['easy']);

    const after = at(2026, 11, 17, 0, 5);
    expect(M.dayRolled(dayKey, after)).toBe(true);
    const todayKey = M.localDayKey(after);
    // New day: progress reset, but yesterday's snapshot is kept.
    const todayRows = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 0 }, lockedType: null });
    const kept = M.nextSnapshot(snap, M.snapshotClaimables({ dayKey: todayKey, rows: todayRows }), todayKey);
    const carried = M.carriedOverMissions(kept, todayKey);
    expect(carried).toHaveLength(1);
    expect(carried[0]).toMatchObject({ canClaim: true, forDate: '2026-11-16', challengeKey: 'easy_step_challenge' });

    const fetchImpl = fetchReturning(200, { xp_awarded: 50, resources_awarded: { gold: 10 } });
    const res = await M.claimMission({ clerkGetToken: getToken, mission: carried[0], forDate: carried[0].forDate, fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).for_date).toBe('2026-11-16');
    expect(M.applyClaim(new Set(), carried[0], res).credited).toBe(10);
    expect(M.removeCarried(kept, carried[0].challengeKey, carried[0].forDate)).toBeNull();
  });

  test('carry-over lasts one day only and skips secured missions', () => {
    const rows = M.buildMissionRows({
      type: 'march',
      aggregates: { daily_steps: 11000 },
      completedKeys: new Set(['easy_step_challenge']),
      lockedType: 'march',
    });
    const snap = M.nextSnapshot(null, M.snapshotClaimables({ dayKey: '2026-11-16', rows }), '2026-11-16');
    expect(snap.missions.map((m) => m.tier)).toEqual(['medium']);
    expect(M.carriedOverMissions(snap, '2026-11-18')).toEqual([]);
    expect(M.nextSnapshot(snap, null, '2026-11-18')).toBeNull();
  });

  test('a mission reached today does not overwrite yesterday\'s unclaimed one', () => {
    const reached = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 5000 }, lockedType: 'march' });
    const y = M.nextSnapshot(null, M.snapshotClaimables({ dayKey: '2026-11-16', rows: reached }), '2026-11-16');
    const both = M.nextSnapshot(y, M.snapshotClaimables({ dayKey: '2026-11-17', rows: reached }), '2026-11-17');
    expect(both.missions.map((m) => m.dayKey)).toEqual(['2026-11-16', '2026-11-17']);
    expect(M.carriedOverMissions(both, '2026-11-17')).toHaveLength(1);
    // Claiming today's mission clears only today's entry.
    const secured = M.buildMissionRows({
      type: 'march', aggregates: { daily_steps: 5000 }, completedKeys: ['easy_step_challenge'], lockedType: 'march',
    });
    const after = M.nextSnapshot(both, M.snapshotClaimables({ dayKey: '2026-11-17', rows: secured }), '2026-11-17');
    expect(after.missions.map((m) => m.dayKey)).toEqual(['2026-11-16']);
  });

  test('previousDayKey crosses month and year ends', () => {
    expect(M.previousDayKey('2026-12-01')).toBe('2026-11-30');
    expect(M.previousDayKey('2027-01-01')).toBe('2026-12-31');
  });
});

describe('refresh countdown', () => {
  test('3h 40 min before midnight', () => {
    const c = M.refreshCountdown(at(2026, 11, 16, 20, 20));
    expect(c.params).toEqual({ hours: 3, minutes: 40 });
    expect(c.underMinute).toBe(false);
  });

  test('at 23:59:30 shows under one minute, then refreshes', () => {
    const now = at(2026, 11, 16, 23, 59, 30);
    const c = M.refreshCountdown(now);
    expect(c.underMinute).toBe(true);
    expect(c.defaultValue).toBe('<1m');
    const delay = M.nextCountdownDelay(now);
    expect(delay).toBeGreaterThan(30000);
    expect(delay).toBeLessThan(31000);
    const next = new Date(now.getTime() + delay);
    expect(M.dayRolled(M.localDayKey(now), next)).toBe(true);
    expect(M.refreshCountdown(next).underMinute).toBe(false);
  });

  test('re-renders at most once a minute and announces at most once a minute', () => {
    const now = at(2026, 11, 16, 12, 0, 10);
    expect(M.nextCountdownDelay(now)).toBeLessThanOrEqual(60050);
    expect(M.shouldAnnounce(null, 1000)).toBe(true);
    expect(M.shouldAnnounce(1000, 60999)).toBe(false);
    expect(M.shouldAnnounce(1000, 61000)).toBe(true);
  });
});

describe('alliance section', () => {
  test('no alliance shows the join-or-create prompt', () => {
    expect(M.allianceSection({ loaded: true, allianceId: null })).toBe('join_prompt');
    expect(M.allianceSection({ loaded: true, allianceId: 'a1' })).toBe('card');
    expect(M.allianceSection({ loaded: false })).toBe('loading');
    expect(M.allianceSection({ loaded: true, error: 'x' })).toBe('error');
  });
});

describe('lockMissionType', () => {
  test('posts the type and returns the server lock', async () => {
    const fetchImpl = fetchReturning(200, { locked_axis: 'steps' });
    const res = await M.lockMissionType({ clerkGetToken: getToken, type: 'march', fetchImpl });
    expect(res).toEqual({ ok: true, lockedType: 'march' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BACKEND}/me/challenges/lock-axis`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body)).toEqual({ axis: 'march' });
  });

  test('no token → auth, nothing sent', async () => {
    const fetchImpl = jest.fn();
    const res = await M.lockMissionType({ clerkGetToken: async () => null, type: 'march', fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: false, code: 'auth', retryable: true });
  });

  test('unknown type is rejected locally', async () => {
    const fetchImpl = jest.fn();
    const res = await M.lockMissionType({ clerkGetToken: getToken, type: 'drill', fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.code).toBe('rejected');
  });

  test('network failure → retryable network error', async () => {
    const fetchImpl = jest.fn(async () => { throw new Error('offline'); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = await M.lockMissionType({ clerkGetToken: getToken, type: 'range', fetchImpl });
    expect(res).toMatchObject({ ok: false, status: 0, code: 'network', retryable: true });
  });

  test.each([
    [409, { error: 'axis_locked', locked_axis: 'distance' }, { code: 'already_locked', retryable: false, lockedType: 'range' }],
    [409, { error: 'already_locked' }, { code: 'already_locked', retryable: false, lockedType: null }],
    [401, {}, { code: 'auth', retryable: true }],
    [404, 'Not Found', { code: 'unavailable', retryable: true }],
    [403, { error: 'weekend_no_challenges' }, { code: 'not_today', retryable: false }],
    [400, { error: 'invalid_body' }, { code: 'rejected', retryable: false }],
    [500, { error: 'server_error' }, { code: 'server', retryable: true }],
    [503, '', { code: 'server', retryable: true }],
  ])('HTTP %i maps to its error', async (status, body, expected) => {
    const res = await M.lockMissionType({ clerkGetToken: getToken, type: 'march', fetchImpl: fetchReturning(status, body) });
    expect(res).toMatchObject({ ok: false, status, ...expected });
  });

  test('every error code has copy', () => {
    for (const code of ['network', 'auth', 'unavailable', 'already_locked', 'not_today', 'rejected', 'server']) {
      expect(M.errorCopy('lock', code).key).toBe(`missions.lockError.${code}`);
    }
    expect(M.errorCopy('claim', 'bogus').key).toBe('missions.claimError.server');
  });
});

describe('mission rows (boards 30–32)', () => {
  test('progress label "4200 / 5000 steps" and the task line', () => {
    const rows = M.buildMissionRows({ type: 'march', aggregates: { daily_steps: 4200 }, lockedType: 'march' });
    const v = M.missionRowView(rows[0]);
    expect(M.fillCopy(v.progress)).toBe('4200 / 5000 steps');
    expect(v.progress.key).toBe('missions.progressSteps');
    expect(M.fillCopy(v.task)).toBe('Complete a total of 5k steps');
    expect(v.fraction).toBeCloseTo(0.84);
    expect(M.fillCopy(M.missionRowView(rows[1]).progress)).toBe('4200 / 10000 steps');
    expect(M.fillCopy(M.missionRowView(rows[2]).task)).toBe('Complete a total of 15k steps');
  });

  test('nothing walked yet: "0 / 5000 steps", empty bar', () => {
    const rows = M.buildMissionRows({ type: 'march', aggregates: {}, lockedType: null });
    const v = M.missionRowView(rows[0]);
    expect(M.fillCopy(v.progress)).toBe('0 / 5000 steps');
    expect(v).toMatchObject({ fraction: 0, claimable: false, secured: false });
  });

  test('RANGE uses the given distance formatter', () => {
    const rows = M.buildMissionRows({ type: 'range', aggregates: { daily_distance_m: 1200 }, lockedType: null });
    const fmt = (m) => `${(m / 1000).toFixed(1)} km`;
    const v = M.missionRowView(rows[0], fmt);
    expect(M.fillCopy(v.progress)).toBe('1.2 km / 2.5 km');
    expect(M.fillCopy(v.task)).toBe('Cover a total of 2.5 km');
  });

  test('a secured row is not claimable', () => {
    const rows = M.buildMissionRows({
      type: 'march', aggregates: { daily_steps: 5000 }, lockedType: 'march', completedKeys: ['easy_step_challenge'],
    });
    expect(M.missionRowView(rows[0])).toMatchObject({ secured: true, claimable: false });
  });

  test('formatCount groups thousands and floors', () => {
    expect(M.formatCount(3240.9)).toBe('3,240');
    expect(M.formatCount(1234567)).toBe('1,234,567');
    expect(M.formatCount(null)).toBe('0');
  });
});

describe('LOCK / CLAIM button (boards 30–32)', () => {
  const rowsAt = (steps, lockedType, extra = {}) => M.buildMissionRows({
    type: 'march', aggregates: { daily_steps: steps }, lockedType, ...extra,
  });

  test('unlocked → LOCK (ghost, enabled)', () => {
    const b = M.missionButton({ lockState: M.initialLockState, rows: rowsAt(20000, null) });
    expect(b).toMatchObject({ kind: 'lock', variant: 'ghost', enabled: true, busy: false });
  });

  test('locking in flight → LOCK busy', () => {
    const b = M.missionButton({ lockState: { ...M.initialLockState, locking: true }, rows: rowsAt(0, null) });
    expect(b).toMatchObject({ kind: 'lock', enabled: false, busy: true });
  });

  test('locked and nothing complete → CLAIM disabled', () => {
    const lockState = M.lockReducer(M.initialLockState, { type: 'LOADED', lockedAxis: 'steps' });
    const b = M.missionButton({ lockState, rows: rowsAt(4200, 'march') });
    expect(b).toMatchObject({ kind: 'claim', variant: 'ghost', enabled: false, readyCount: 0 });
  });

  test('locked with any tier complete → CLAIM enabled (primary)', () => {
    const lockState = M.lockReducer(M.initialLockState, { type: 'LOADED', lockedAxis: 'steps' });
    const rows = rowsAt(12000, 'march');
    const b = M.missionButton({ lockState, rows });
    expect(b).toMatchObject({ kind: 'claim', variant: 'primary', enabled: true, readyCount: 2 });
    expect(M.claimableRows(rows).map((r) => r.tier)).toEqual(['easy', 'medium']);
  });

  test('all reached tiers secured → CLAIM disabled again', () => {
    const lockState = { ...M.initialLockState, lockedType: 'march' };
    const rows = rowsAt(5000, 'march', { completedKeys: ['easy_step_challenge'] });
    expect(M.missionButton({ lockState, rows })).toMatchObject({ kind: 'claim', enabled: false });
  });

  test('a claim in flight → CLAIM busy, not pressable', () => {
    const lockState = { ...M.initialLockState, lockedType: 'march' };
    const rows = rowsAt(12000, 'march', { claimingKeys: ['easy_step_challenge'] });
    expect(M.missionButton({ lockState, rows })).toMatchObject({ kind: 'claim', variant: 'primary', enabled: false, busy: true });
  });

  test('locked to another axis → no button', () => {
    const lockState = M.lockReducer(M.initialLockState, { type: 'LOADED', lockedAxis: 'calories' });
    expect(M.missionButton({ lockState, rows: [] }).kind).toBe('none');
  });

  test('LOCK sends straight away, with no confirmation step', async () => {
    let state = M.initialLockState;
    const dispatch = (a) => { state = M.lockReducer(state, a); };
    const lock = jest.fn(async () => ({ ok: true, lockedType: 'march' }));
    const out = await M.lockNow({ state, lock, dispatch });
    expect(lock).toHaveBeenCalledWith('march');
    expect(out.status).toBe('locked');
    expect(state).toMatchObject({ lockedType: 'march', confirming: false, locking: false });
    // Already locked: ignored.
    expect((await M.lockNow({ state, lock, dispatch })).status).toBe('ignored');
    expect(lock).toHaveBeenCalledTimes(1);
  });

  test('a failed LOCK leaves the toggle enabled with the error', async () => {
    let state = M.initialLockState;
    const dispatch = (a) => { state = M.lockReducer(state, a); };
    await M.lockNow({ state, lock: async () => ({ ok: false, code: 'network', retryable: true, lockedType: null }), dispatch });
    expect(M.isToggleEnabled(state)).toBe(true);
    expect(state.error).toMatchObject({ code: 'network' });
  });
});

describe('alliance mission card', () => {
  test('active task: two-tone split, teammates = total − yours', () => {
    const m = M.allianceCardModel({
      state: 'active',
      task: {
        task_type: 'long_march', unit: 'm', target: 100000, half_target: 50000, total_progress: 12000, days_left: 4,
        personal_payout: { gold: 200, xp: 0 },
      },
      personal: { contribution: 3000 },
    });
    expect(m).toMatchObject({
      state: 'active', taskType: 'long_march', progress: 12000, target: 100000,
      yours: 3000, teammates: 9000, halfTarget: 50000, daysLeft: 4, sharedGold: 200,
    });
    expect(m.teammatesFraction).toBeCloseTo(0.09);
    expect(m.yoursFraction).toBeCloseTo(0.03);
    expect(M.fillCopy(m.metric)).toBe('DISTANCE TRAVELED');
  });

  test('no personal row: the whole total is teammates', () => {
    const m = M.allianceCardModel({
      state: 'active', task: { unit: 'steps', target: 1000, total_progress: 400 }, personal: null,
    });
    expect(m).toMatchObject({ yours: 0, teammates: 400, halfTarget: 500 });
    expect(m.metric.key).toBe('missions.allianceMetric.steps');
  });

  test('fractions never overflow the bar', () => {
    const m = M.allianceCardModel({
      state: 'active', task: { unit: 'm', target: 100, total_progress: 150 }, personal: { contribution: 500 },
    });
    expect(m.yours).toBe(150);
    expect(m.teammatesFraction + m.yoursFraction).toBeLessThanOrEqual(1);
  });

  test('no active task is pending', () => {
    expect(M.allianceCardModel({ state: 'picking', task: null })).toEqual({ state: 'pending' });
    expect(M.allianceCardModel(null)).toEqual({ state: 'pending' });
  });
});

test('missions.js stays CommonJS and React-free', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'missions.js'), 'utf8');
  expect(src).not.toMatch(/^import /m);
  expect(src).not.toMatch(/require\('react/);
});
