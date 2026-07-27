// lib/claimWalkSamples.js
// Live minute-bucket producer for claim walks.
//
// Health Connect only receives steps when the recording app (Google Fit et al)
// decides to flush, which can lag minutes behind the walk — far too late for
// the server-side walk verification that gates claim completion. During an
// active claim walk this module turns live pedometer step deltas into the same
// minute-aligned activity samples the global producer (lib/activity.js) builds
// from Health Connect, and posts them through the same endpoint.
//
// Idempotence: source_id is SHA256(playerId|windowStartMs|windowEndMs) — the
// exact derivation lib/activity.js uses — so when Health Connect later syncs
// the same minutes, the server's (player_id, source_id) unique key drops them
// as duplicates. Whoever posts a minute first wins; nothing double-counts.
//
// The one rule that keeps that true: ONLY closed, minute-aligned windows are
// ever posted. A partial window would carry a different source_id than the
// Health Connect bucket for the same minute and both would be credited.

import * as Crypto from 'expo-crypto';
import { postActivitySteps } from './activityApi';
import { formatHexAsUuid, alignToMinute } from './activity.helpers';

const FLUSH_INTERVAL_MS = 30_000;
const BUFFER_CAP = 200;

const INITIAL_STATE = {
  active: false,
  playerId: null,
  clerkGetToken: null,
  getStrideM: null,
  currentBucket: null, // { startMs, steps } — the minute in progress
  closed: [], // [{ startMs, endMs, steps }] — full minutes awaiting post
  gaitByMinute: new Map(), // minuteStartMs -> rolled-up motion evidence
  flushInProgress: false,
  periodicTimer: null,
};

let _state = { ...INITIAL_STATE };

function _resetState() {
  if (_state.periodicTimer != null) {
    clearInterval(_state.periodicTimer);
  }
  _state = { ...INITIAL_STATE, closed: [], gaitByMinute: new Map(), periodicTimer: null };
}

/**
 * Record one accelerometer-window verdict against the minute it fell in.
 *
 * Kept in its own map rather than on the bucket because motion evidence and
 * steps arrive on different clocks — a window can be evaluated in a minute
 * where no step has landed yet, and that evidence still matters.
 */
export function noteGaitWindow({ verdict, features }, atMs = Date.now()) {
  if (!_state.active) return;
  const minuteStart = alignToMinute(atMs);
  const roll = _state.gaitByMinute.get(minuteStart) ?? { windows: 0, bad: 0, worst: null };
  roll.windows += 1;
  if (verdict === 'implausible') {
    roll.bad += 1;
    // Keep the most incriminating window's numbers: that is what the server
    // needs to re-derive the verdict under its own thresholds.
    if (roll.worst === null) roll.worst = features ?? null;
  } else if (roll.worst === null && roll.windows === 1) {
    roll.worst = features ?? null;
  }
  _state.gaitByMinute.set(minuteStart, roll);

  // Bound the map: anything older than a few minutes has either been flushed
  // or is never going to be.
  const cutoff = minuteStart - 5 * 60_000;
  for (const key of _state.gaitByMinute.keys()) {
    if (key < cutoff) _state.gaitByMinute.delete(key);
  }
}

/** Wire form of a minute's motion evidence, or undefined when none exists. */
function _gaitPayload(minuteStartMs) {
  const roll = _state.gaitByMinute.get(minuteStartMs);
  if (!roll || roll.windows === 0) return undefined;
  const f = roll.worst;
  const round = (n, dp) => (Number.isFinite(n) ? Number(n.toFixed(dp)) : null);
  return {
    windows: roll.windows,
    bad: roll.bad,
    freqHz: round(f?.dominantFreqHz, 2),
    periodicity: round(f?.periodicity, 2),
    vRms: round(f?.verticalRms, 3),
    hRms: round(f?.horizontalRms, 3),
    pkpk: round(f?.peakToPeakG, 2),
    tumbleDeg: round(f?.tumbleDeg, 1),
  };
}

export function start({ playerId, clerkGetToken, getStrideM }) {
  if (_state.active) return;
  _state = {
    ...INITIAL_STATE,
    active: true,
    playerId,
    clerkGetToken,
    getStrideM,
    closed: [],
  };
  _state.periodicTimer = setInterval(() => {
    flushNow().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

/** Discards the in-progress minute. Callers that care about it (the success
 *  screen) flushNow() first — closed minutes go out, the partial one never
 *  does (see the header on why partials must not be posted). */
export function stop() {
  if (!_state.active && _state.periodicTimer == null) return;
  _resetState();
}

export function addSteps(deltaSteps, atMs = Date.now()) {
  if (!_state.active) return;
  if (!Number.isFinite(deltaSteps) || deltaSteps <= 0) return;

  const minuteStart = alignToMinute(atMs);
  if (_state.currentBucket && _state.currentBucket.startMs !== minuteStart) {
    _closeCurrentBucket();
    // A minute just completed — ship it immediately instead of waiting out
    // the periodic timer. Claim-completion latency rides on how fast the
    // server sees the walk's final minutes.
    flushNow(atMs).catch(() => {});
  }
  if (!_state.currentBucket) {
    _state.currentBucket = { startMs: minuteStart, steps: 0 };
  }
  _state.currentBucket.steps += Math.floor(deltaSteps);
}

function _closeCurrentBucket() {
  const bucket = _state.currentBucket;
  _state.currentBucket = null;
  if (!bucket || bucket.steps <= 0) return;
  _state.closed.push({
    startMs: bucket.startMs,
    endMs: bucket.startMs + 60_000,
    steps: bucket.steps,
  });
  if (_state.closed.length > BUFFER_CAP) {
    _state.closed = _state.closed.slice(_state.closed.length - BUFFER_CAP);
  }
}

/** Close the in-progress bucket if its minute has fully elapsed. */
function _rollIfElapsed(nowMs) {
  const bucket = _state.currentBucket;
  if (bucket && nowMs >= bucket.startMs + 60_000) {
    _closeCurrentBucket();
  }
}

export async function flushNow(nowMs = Date.now()) {
  if (!_state.active) return;
  _rollIfElapsed(nowMs);
  if (_state.flushInProgress || _state.closed.length === 0) return;

  _state.flushInProgress = true;
  const snapshot = _state.closed.slice(0);
  try {
    const strideM =
      typeof _state.getStrideM === 'function' ? _state.getStrideM() : 0.75;
    const samples = await Promise.all(
      snapshot.map(async (bucket) => {
        const sample = {
          sourceId: formatHexAsUuid(
            await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              `${_state.playerId}|${bucket.startMs}|${bucket.endMs}`,
            ),
          ),
          windowStartMs: bucket.startMs,
          windowEndMs: bucket.endMs,
          steps: bucket.steps,
          distanceM: Math.floor(bucket.steps * strideM),
        };
        const gait = _gaitPayload(bucket.startMs);
        if (gait) sample.gait = gait;
        return sample;
      }),
    );

    const result = await postActivitySteps({
      clerkGetToken: _state.clerkGetToken,
      samples,
    });

    // Retryable failures keep the buffer for the next tick; anything else
    // (accepted, duplicate, or permanently rejected) is settled.
    if (result.ok || !result.retryable) {
      const sent = new Set(snapshot.map((b) => b.startMs));
      _state.closed = _state.closed.filter((b) => !sent.has(b.startMs));
      for (const startMs of sent) _state.gaitByMinute.delete(startMs);
    }
  } finally {
    _state.flushInProgress = false;
  }
}

export function getBufferedMinutes() {
  return _state.closed.length + (_state.currentBucket ? 1 : 0);
}
