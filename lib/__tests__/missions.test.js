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
    expect(c.defaultValue).toBe('<1 min');
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

test('missions.js stays CommonJS and React-free', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'missions.js'), 'utf8');
  expect(src).not.toMatch(/^import /m);
  expect(src).not.toMatch(/require\('react/);
});
