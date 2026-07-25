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
  flushInProgress: false,
  periodicTimer: null,
};

let _state = { ...INITIAL_STATE };

function _resetState() {
  if (_state.periodicTimer != null) {
    clearInterval(_state.periodicTimer);
  }
  _state = { ...INITIAL_STATE, closed: [], periodicTimer: null };
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
      snapshot.map(async (bucket) => ({
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
      })),
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
    }
  } finally {
    _state.flushInProgress = false;
  }
}

export function getBufferedMinutes() {
  return _state.closed.length + (_state.currentBucket ? 1 : 0);
}
