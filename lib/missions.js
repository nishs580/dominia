// lib/missions.js
// Figma Missions tab (plan U14): pure decisions plus the two calls the screen
// makes beyond GET /me/challenges/today.
//
//   - Mission types MARCH (steps) and RANGE (distance) map onto the existing
//     daily-challenge axes, so completion reuses POST /me/challenge-complete
//     and the server's locked_axis.
//   - LOCK calls POST /me/challenges/lock-axis { axis: 'march'|'range' }.
//   - A mission reached before local midnight but not yet claimed is carried
//     over for one day and claimed with `for_date` (see claimMission).
//
// Copy is returned as { key, defaultValue, params } so the screen calls
// t(key, { defaultValue, ...params }).
//
// CJS, no React: jest-testable via plain require().

'use strict';

const { BACKEND_URL } = require('./api');
const { AXIS_CATALOG, TIERS, XP_PER_TIER } = require('./challengeAxes');
const F = require('./formulas');

const MISSION_TYPES = Object.freeze(['march', 'range']);
const TYPE_TO_AXIS = Object.freeze({ march: 'steps', range: 'distance' });
const AXIS_TO_TYPE = Object.freeze({ steps: 'march', distance: 'range' });

// Shown when the economy parameter has no mission table yet.
const FALLBACK_GOLD = Object.freeze({ easy: 10, medium: 20, hard: 40 });

const MINUTE_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;

/** FeatureExplainer once-per-player name for the "Missions type" card. */
const MISSIONS_EXPLAINER = 'explainer:missionsType';

/** AsyncStorage key for the carry-over snapshot, per player. */
function carryStorageKey(userId) {
  return `dominia:missions:carry:${userId ?? 'anon'}`;
}

// ─── Types and axes ───────────────────────────────────────────────────────

/**
 * Server lock (either the axis name the today route returns or the mission
 * type the lock route may return) → 'march' | 'range' | 'other' | null.
 * 'other' is a lock on an axis Missions does not show (calories/tempo, set
 * from the legacy Activity screen): locked, but neither type is selectable.
 */
function lockedTypeFrom(locked) {
  if (locked == null || locked === '') return null;
  if (MISSION_TYPES.includes(locked)) return locked;
  return AXIS_TO_TYPE[locked] ?? 'other';
}

function goldRewardFor(tier) {
  let table = null;
  try {
    table = F.MISSION_GOLD_REWARD;
  } catch (_) {
    table = null;
  }
  const v = Number(table?.[tier]);
  return Number.isFinite(v) ? v : FALLBACK_GOLD[tier];
}

/** The three missions of a type, easy → hard. */
function missionDefs(type) {
  const axis = TYPE_TO_AXIS[type];
  if (!axis) return [];
  const cat = AXIS_CATALOG[axis];
  return TIERS.map((tier) => {
    const def = cat.tiers[tier];
    return {
      type,
      axis,
      tier,
      target: def.target,
      earnKey: def.earnKey,
      challengeKey: def.earnKey, // challenge_key === earn_key (ActivityScreen)
      xp: XP_PER_TIER[tier],
      gold: goldRewardFor(tier),
    };
  });
}

/** Progress in the type's unit: steps, or metres for RANGE. */
function currentFor(type, aggregates, live = {}) {
  if (type === 'march') {
    return Math.max(Number(aggregates?.daily_steps) || 0, Number(live.steps) || 0);
  }
  if (type === 'range') {
    return Math.max(Number(aggregates?.daily_distance_m) || 0, Number(live.distanceM) || 0);
  }
  return 0;
}

/** Description line under the toggle. */
function typeDescription(type) {
  if (type === 'range') {
    return {
      key: 'missions.descRange',
      defaultValue: 'RANGE: Daily distance challenges with increasing targets and rewards based on difficulty.',
    };
  }
  return {
    key: 'missions.descMarch',
    defaultValue: 'MARCH: Daily step-count challenges with increasing targets and rewards based on difficulty.',
  };
}

/**
 * Rows for the listed type.
 *
 * Before LOCK nothing is claimable; the screen shows LOCK instead of CLAIM.
 * After LOCK, the locked type's rows show CLAIM, enabled once current reaches
 * target and the mission is not yet secured.
 */
function buildMissionRows({
  type,
  aggregates,
  live,
  completedKeys,
  lockedType,
  claimingKeys,
} = {}) {
  const done = completedKeys instanceof Set ? completedKeys : new Set(completedKeys ?? []);
  const claiming = claimingKeys instanceof Set ? claimingKeys : new Set(claimingKeys ?? []);
  const current = currentFor(type, aggregates, live);
  const lockedHere = lockedType != null && lockedType === type;
  return missionDefs(type).map((def) => {
    const secured = done.has(def.challengeKey);
    const reached = current >= def.target;
    const shown = Math.min(current, def.target);
    return {
      ...def,
      current: shown,
      fraction: def.target > 0 ? shown / def.target : 0,
      reached,
      secured,
      claiming: claiming.has(def.challengeKey),
      showClaim: lockedHere,
      canClaim: lockedHere && reached && !secured && !claiming.has(def.challengeKey),
    };
  });
}

// ─── Figma presentation (E1–E5) ───────────────────────────────────────────

/** "3240" → "3,240". Whole numbers, comma groups (Figma mono figures). */
function formatCount(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * "3,240 / 5,000" for MARCH. RANGE needs the player's units, so the screen
 * passes `formatDistance(metres)`; without it RANGE falls back to metres.
 */
function progressLabel(row, formatDistance) {
  if (row?.type === 'range') {
    const fmt = typeof formatDistance === 'function' ? formatDistance : (m) => `${formatCount(m)} m`;
    return `${fmt(row.current)} / ${fmt(row.target)}`;
  }
  return `${formatCount(row?.current)} / ${formatCount(row?.target)}`;
}

/** Row heading: "5,000 STEPS" (MARCH) or the distance target (RANGE). */
function rowTitle(row, formatDistance) {
  if (row?.type === 'range') {
    const d = typeof formatDistance === 'function' ? formatDistance(row.target) : `${formatCount(row.target)} m`;
    return { key: 'missions.rowTitleRange', defaultValue: '{{distance}}', params: { distance: d } };
  }
  return { key: 'missions.rowTitleMarch', defaultValue: '{{n}} STEPS', params: { n: formatCount(row?.target) } };
}

/**
 * What a row shows on its right:
 *   'secured'      SECURED chip (claimed today)
 *   'claim'        CLAIM button; enabled + lime border when `claimable`
 *   'in_progress'  IN PROGRESS chip (type not locked yet, target not reached)
 *   'complete'     COMPLETE chip (reached, but the type is not locked yet)
 */
function rowStatus(row) {
  if (row?.secured) return 'secured';
  if (row?.showClaim) return 'claim';
  return row?.reached ? 'complete' : 'in_progress';
}

const CHIP_COPY = Object.freeze({
  secured: { key: 'missions.chipSecured', defaultValue: 'SECURED' },
  in_progress: { key: 'missions.chipInProgress', defaultValue: 'IN PROGRESS' },
  complete: { key: 'missions.chipComplete', defaultValue: 'COMPLETE' },
});

/** Display model for one row: formatted figures, chip and claimable flag. */
function missionRowView(row, formatDistance) {
  const status = rowStatus(row);
  return {
    status,
    title: rowTitle(row, formatDistance),
    progress: progressLabel(row, formatDistance),
    chip: CHIP_COPY[status] ?? null,
    // A claimable card gets the lime border and the lime CLAIM (Figma E4).
    claimable: status === 'claim' && !!row.canClaim,
  };
}

/** Rows whose reward can be claimed right now. */
function rewardsReadyCount(rows) {
  return (rows ?? []).filter((r) => rowStatus(r) === 'claim' && r.canClaim).length;
}

/** "2 REWARDS READY" / "1 REWARD READY". */
function rewardsReadyCopy(count) {
  return {
    key: 'missions.rewardsReady',
    defaultValue: count === 1 ? '{{count}} REWARD READY' : '{{count}} REWARDS READY',
    params: { count },
  };
}

/**
 * Section label above the rows: "DAILY · MARCH", or lime
 * "DAILY · MARCH · 2 REWARDS READY" once something can be claimed.
 */
function sectionLabel(type, rows) {
  const ready = rewardsReadyCount(rows);
  return {
    base: { key: 'missions.sectionDaily', defaultValue: 'DAILY · {{type}}', params: { type: String(type ?? '').toUpperCase() } },
    ready: ready > 0 ? rewardsReadyCopy(ready) : null,
    readyCount: ready,
    lime: ready > 0,
  };
}

/** Toggle subtitle under MARCH / RANGE. */
function typeSubtitle(type) {
  return type === 'range'
    ? { key: 'missions.subRange', defaultValue: 'Count distance' }
    : { key: 'missions.subMarch', defaultValue: 'Count steps' };
}

const TYPE_NAME = Object.freeze({
  march: { key: 'missions.nameMarch', defaultValue: 'March' },
  range: { key: 'missions.nameRange', defaultValue: 'Range' },
});

/** "LOCK MARCH FOR TODAY". */
function lockButtonCopy(type) {
  return {
    key: 'missions.lockForToday',
    defaultValue: 'LOCK {{type}} FOR TODAY',
    params: { type: String(type ?? '').toUpperCase() },
  };
}

/**
 * Locked state for the toggle (Figma E3): which tab carries the lock icon,
 * whether the LOCK button shows, and the banner copy. A lock on an axis
 * Missions does not list ('other') has no tab icon and keeps its own note.
 */
function lockedView(state) {
  const lockedType = state?.lockedType ?? null;
  const mission = lockedType && lockedType !== 'other' ? lockedType : null;
  return {
    locked: !!lockedType,
    lockIconOn: mission,
    showLockButton: !lockedType,
    banner: mission
      ? { key: 'missions.lockedBanner', defaultValue: '{{type}} is locked until missions refresh.', nameKey: TYPE_NAME[mission] }
      : null,
  };
}

/** Fill {{x}} placeholders in a copy's defaultValue (tests, fallbacks). */
function fillCopy(copy, extra) {
  const params = { ...(copy?.params ?? {}), ...(extra ?? {}) };
  return String(copy?.defaultValue ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''));
}

/**
 * Alliance mission card (Figma E1) over GET /alliances/:id/weekly-task.
 * Gold-only: the shared reward is the task's Gold payout.
 */
function allianceCardModel(data) {
  const task = data?.task;
  if (!task || data?.state !== 'active') return { state: 'pending' };
  const target = Number(task.target) || 0;
  const progress = Number(task.total_progress) || 0;
  return {
    state: 'active',
    taskType: task.task_type,
    unit: task.unit,
    progress,
    target,
    fraction: target > 0 ? Math.max(0, Math.min(1, progress / target)) : 0,
    sharedGold: Number(task.personal_payout?.gold) || 0,
  };
}

// ─── Lock state ───────────────────────────────────────────────────────────

const initialLockState = Object.freeze({
  type: 'march',
  lockedType: null,
  confirming: false,
  locking: false,
  error: null,
});

/**
 * Screen state for the toggle and LOCK.
 *   LOADED { lockedAxis }      server truth from /me/challenges/today
 *   SELECT_TYPE { type }       ignored once locked or while locking
 *   LOCK_REQUESTED             confirmation shown
 *   LOCK_CANCELLED             confirmation dismissed, nothing sent
 *   LOCK_STARTED / LOCK_SUCCEEDED { lockedType } / LOCK_FAILED { error }
 *   DAY_ROLLED                 midnight: the server lock is gone until reload
 */
function lockReducer(state, action) {
  switch (action?.type) {
    case 'LOADED': {
      const lockedType = lockedTypeFrom(action.lockedAxis);
      return {
        ...state,
        lockedType,
        type: lockedType && lockedType !== 'other' ? lockedType : state.type,
      };
    }
    case 'SELECT_TYPE':
      if (!isToggleEnabled(state) || !MISSION_TYPES.includes(action.missionType)) return state;
      return { ...state, type: action.missionType, error: null };
    case 'LOCK_REQUESTED':
      if (!isToggleEnabled(state)) return state;
      return { ...state, confirming: true, error: null };
    case 'LOCK_CANCELLED':
      return { ...state, confirming: false };
    case 'LOCK_STARTED':
      return { ...state, confirming: false, locking: true, error: null };
    case 'LOCK_SUCCEEDED': {
      const lockedType = lockedTypeFrom(action.lockedType) ?? state.type;
      return {
        ...state,
        locking: false,
        lockedType,
        type: lockedType !== 'other' ? lockedType : state.type,
        error: null,
      };
    }
    case 'LOCK_FAILED': {
      // A 409 tells us the server already holds a lock: adopt it.
      const serverLocked = lockedTypeFrom(action.error?.lockedType);
      return {
        ...state,
        locking: false,
        error: action.error ?? { code: 'server', retryable: true },
        lockedType: serverLocked ?? state.lockedType,
        type: serverLocked && serverLocked !== 'other' ? serverLocked : state.type,
      };
    }
    case 'DAY_ROLLED':
      return { ...state, lockedType: null, confirming: false, error: null };
    default:
      return state;
  }
}

function isToggleEnabled(state) {
  return !state.lockedType && !state.locking;
}

/**
 * LOCK flow: ask, then call. `confirm(type)` resolves true to proceed;
 * `lock(type)` is lockMissionType bound to a token getter. Cancelling sends
 * nothing.
 */
async function confirmAndLock({ state, confirm, lock, dispatch }) {
  if (!isToggleEnabled(state)) return { status: 'ignored' };
  const type = state.type;
  dispatch({ type: 'LOCK_REQUESTED' });
  let ok = false;
  try {
    ok = !!(await confirm(type));
  } catch (_) {
    ok = false;
  }
  if (!ok) {
    dispatch({ type: 'LOCK_CANCELLED' });
    return { status: 'cancelled' };
  }
  dispatch({ type: 'LOCK_STARTED' });
  const res = await lock(type);
  if (res?.ok) {
    dispatch({ type: 'LOCK_SUCCEEDED', lockedType: res.lockedType ?? type });
    return { status: 'locked', lockedType: res.lockedType ?? type };
  }
  dispatch({ type: 'LOCK_FAILED', error: res });
  return { status: 'failed', error: res };
}

/**
 * Figma LOCK: no confirmation step (E1 has none), the button locks the
 * selected type straight away.
 */
async function lockNow({ state, lock, dispatch }) {
  if (!isToggleEnabled(state)) return { status: 'ignored' };
  const type = state.type;
  dispatch({ type: 'LOCK_STARTED' });
  const res = await lock(type);
  if (res?.ok) {
    dispatch({ type: 'LOCK_SUCCEEDED', lockedType: res.lockedType ?? type });
    return { status: 'locked', lockedType: res.lockedType ?? type };
  }
  dispatch({ type: 'LOCK_FAILED', error: res });
  return { status: 'failed', error: res };
}

// ─── Network ──────────────────────────────────────────────────────────────

async function readBody(res) {
  let text = '';
  try {
    text = await res.text();
  } catch (_) {
    return {};
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return { error: text };
  }
}

async function postJson({ clerkGetToken, path, body, fetchImpl }) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  let token = null;
  try {
    token = await clerkGetToken();
  } catch (_) {
    token = null;
  }
  if (!token) return { status: 401, body: { error: 'no_token' } };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const res = await doFetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const parsed = await readBody(res);
    return { status: res.ok ? 200 : res.status || 500, ok: !!res.ok, body: parsed };
  } catch (err) {
    console.log('[missions] network error', path, err?.message ?? err);
    return { status: 0, body: { error: 'network_error' } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Lock-axis failure → { code, retryable, lockedType }.
 *   0           network     retry
 *   401         auth        retry (token refresh)
 *   404         unavailable retry (route not deployed yet)
 *   409         already_locked, carries the server's lock; no retry
 *   403 weekend not_today
 *   400 / 403   rejected
 *   5xx, other  server      retry
 */
function mapLockError(status, body = {}) {
  if (status === 0) return { code: 'network', retryable: true, lockedType: null };
  if (status === 401) return { code: 'auth', retryable: true, lockedType: null };
  if (status === 404) return { code: 'unavailable', retryable: true, lockedType: null };
  if (status === 409) {
    return {
      code: 'already_locked',
      retryable: false,
      lockedType: lockedTypeFrom(body.locked_axis ?? null),
    };
  }
  if (status === 403 && body.error === 'weekend_no_challenges') {
    return { code: 'not_today', retryable: false, lockedType: null };
  }
  if (status === 400 || status === 403) return { code: 'rejected', retryable: false, lockedType: null };
  return { code: 'server', retryable: true, lockedType: null };
}

/** POST /me/challenges/lock-axis. Never throws. */
async function lockMissionType({ clerkGetToken, type, fetchImpl }) {
  if (!MISSION_TYPES.includes(type)) {
    return { ok: false, status: 400, code: 'rejected', retryable: false, lockedType: null };
  }
  const r = await postJson({
    clerkGetToken,
    path: '/me/challenges/lock-axis',
    body: { axis: type },
    fetchImpl,
  });
  if (r.status === 200) {
    return { ok: true, lockedType: lockedTypeFrom(r.body?.locked_axis) ?? type };
  }
  return { ok: false, status: r.status, ...mapLockError(r.status, r.body) };
}

/** Claim failure → { code, retryable }. */
function mapClaimError(status, body = {}) {
  if (status === 0) return { code: 'network', retryable: true };
  if (status === 401) return { code: 'auth', retryable: true };
  if (status === 403 && body.error === 'weekend_no_challenges') return { code: 'not_today', retryable: false };
  // Server aggregate still under target (flush lag): try again shortly.
  if (status === 403) return { code: 'not_yet', retryable: true };
  if (status === 409) return { code: 'axis_locked', retryable: false };
  if (status === 400 || status === 404) return { code: 'rejected', retryable: false };
  return { code: 'server', retryable: true };
}

/**
 * CLAIM: POST /me/challenge-complete. A carried-over mission adds `for_date`
 * (its local day). The reward credited is whatever the server returns.
 * Never throws.
 */
async function claimMission({ clerkGetToken, mission, forDate, fetchImpl }) {
  const body = {
    challenge_key: mission.challengeKey,
    tier: mission.tier,
    earn_key: mission.earnKey,
  };
  if (forDate) body.for_date = forDate;
  const r = await postJson({ clerkGetToken, path: '/me/challenge-complete', body, fetchImpl });
  if (r.status === 200) {
    const d = r.body ?? {};
    return {
      ok: true,
      gold: Number(d.resources_awarded?.gold) || 0,
      xp: Number(d.xp_awarded) || 0,
      alreadyCompleted: d.already_completed === true,
      playerGold: d.player_resources?.gold ?? null,
      data: d,
    };
  }
  return { ok: false, status: r.status, ...mapClaimError(r.status, r.body) };
}

/** Error copy for a lock or claim failure. */
function errorCopy(kind, code) {
  const defaults = {
    network: 'No connection. Check your signal and try again.',
    auth: 'Your session expired. Try again.',
    unavailable: 'Locking is not available yet. Try again later.',
    already_locked: 'A mission type is already locked for today.',
    not_today: 'No missions today.',
    rejected: 'That request was not accepted.',
    not_yet: 'Progress is still syncing. Try again in a minute.',
    axis_locked: 'Today is locked to another mission type.',
    server: 'Something went wrong. Try again.',
  };
  const c = Object.prototype.hasOwnProperty.call(defaults, code) ? code : 'server';
  return { key: `missions.${kind}Error.${c}`, defaultValue: defaults[c] };
}

/**
 * After a successful claim: the mission is secured and the credited Gold is
 * the server's figure, not the display table.
 */
function applyClaim(completedKeys, mission, result) {
  if (!result?.ok) return { completedKeys, credited: 0 };
  const next = new Set(completedKeys ?? []);
  next.add(mission.challengeKey);
  return { completedKeys: next, credited: result.gold };
}

// ─── Day boundary, carry-over and countdown ───────────────────────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' in device-local time. */
function localDayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function previousDayKey(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1, 12);
  return localDayKey(prev);
}

/**
 * Missions reached but not claimed on `dayKey` (the day the data was loaded
 * on), saved while the day runs so they stay claimable after the midnight
 * refresh. Always returns { dayKey, missions }.
 */
function snapshotClaimables({ dayKey, rows }) {
  const missions = (rows ?? [])
    .filter((r) => r.showClaim && r.reached && !r.secured)
    .map((r) => ({
      dayKey,
      type: r.type,
      tier: r.tier,
      target: r.target,
      earnKey: r.earnKey,
      challengeKey: r.challengeKey,
      gold: r.gold,
    }));
  return { dayKey, missions };
}

/**
 * Stored carry-over after a fresh day snapshot: entries for the snapshot's
 * day are replaced by it, entries from today or yesterday are kept, older
 * ones drop (one-day grace). Null when nothing is left.
 */
function nextSnapshot(stored, daySnapshot, todayKey) {
  const keepFrom = previousDayKey(todayKey);
  const kept = (stored?.missions ?? []).filter(
    (m) => m.dayKey >= keepFrom && m.dayKey !== daySnapshot?.dayKey,
  );
  const fresh = (daySnapshot?.missions ?? []).filter((m) => m.dayKey >= keepFrom);
  const missions = [...kept, ...fresh];
  return missions.length ? { missions } : null;
}

/** Yesterday's carried missions, each claimed with forDate = its day. */
function carriedOverMissions(snapshot, todayKey) {
  const yesterday = previousDayKey(todayKey);
  return (snapshot?.missions ?? [])
    .filter((m) => m.dayKey === yesterday)
    .map((m) => ({
      ...m,
      forDate: m.dayKey,
      reached: true,
      secured: false,
      showClaim: true,
      canClaim: true,
      current: m.target,
      fraction: 1,
    }));
}

/** Stored carry-over after the mission of `dayKey` was claimed. */
function removeCarried(snapshot, challengeKey, dayKey) {
  const missions = (snapshot?.missions ?? []).filter(
    (m) => !(m.challengeKey === challengeKey && m.dayKey === dayKey),
  );
  return missions.length ? { missions } : null;
}

function msUntilLocalMidnight(now) {
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, midnight.getTime() - d.getTime());
}

/** "3h 40m", "40m" or "<1m" as copy (shown upper-case: REFRESHES IN 3H 40M). */
function refreshCountdown(now) {
  const ms = msUntilLocalMidnight(now);
  if (ms < MINUTE_MS) {
    return { ms, underMinute: true, key: 'missions.refreshUnderMinute', defaultValue: '<1m', params: {} };
  }
  const totalMin = Math.floor(ms / MINUTE_MS);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) {
    return { ms, underMinute: false, key: 'missions.refreshMinutes', defaultValue: '{{minutes}}m', params: { minutes } };
  }
  return {
    ms,
    underMinute: false,
    key: 'missions.refreshHoursMinutes',
    defaultValue: '{{hours}}h {{minutes}}m',
    params: { hours, minutes },
  };
}

/**
 * Delay to the next re-render: just past the next whole-minute change, or
 * just past midnight inside the last minute. The text changes at most once a
 * minute, so its live-region announcement does too.
 */
function nextCountdownDelay(now) {
  const ms = msUntilLocalMidnight(now);
  if (ms < MINUTE_MS) return ms + 50;
  const rem = ms % MINUTE_MS;
  return (rem === 0 ? MINUTE_MS : rem) + 50;
}

/** True once the local day has moved past `dayKey`. */
function dayRolled(dayKey, now) {
  return localDayKey(now) !== dayKey;
}

/** At most one spoken announcement per minute. */
function shouldAnnounce(lastAnnouncedAt, now) {
  if (lastAnnouncedAt == null) return true;
  return Number(now) - Number(lastAnnouncedAt) >= MINUTE_MS;
}

// ─── Alliance section ─────────────────────────────────────────────────────

/** 'loading' | 'error' | 'card' | 'join_prompt'. */
function allianceSection({ loaded, error, allianceId } = {}) {
  if (!loaded) return 'loading';
  if (error) return 'error';
  return allianceId ? 'card' : 'join_prompt';
}

module.exports = {
  MISSION_TYPES,
  TYPE_TO_AXIS,
  MISSIONS_EXPLAINER,
  carryStorageKey,
  lockedTypeFrom,
  goldRewardFor,
  missionDefs,
  currentFor,
  typeDescription,
  buildMissionRows,
  formatCount,
  progressLabel,
  rowTitle,
  rowStatus,
  missionRowView,
  rewardsReadyCount,
  rewardsReadyCopy,
  sectionLabel,
  typeSubtitle,
  TYPE_NAME,
  lockButtonCopy,
  lockedView,
  fillCopy,
  allianceCardModel,
  initialLockState,
  lockReducer,
  isToggleEnabled,
  confirmAndLock,
  lockNow,
  mapLockError,
  lockMissionType,
  mapClaimError,
  claimMission,
  errorCopy,
  applyClaim,
  localDayKey,
  previousDayKey,
  snapshotClaimables,
  carriedOverMissions,
  removeCarried,
  nextSnapshot,
  msUntilLocalMidnight,
  refreshCountdown,
  nextCountdownDelay,
  dayRolled,
  shouldAnnounce,
  allianceSection,
};
