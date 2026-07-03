/**
 * lib/activity.helpers.js
 *
 * Pure helpers for S51 Activity module (sample construction, flush policy, wire body).
 * No I/O, no native imports.
 */

function formatHexAsUuid(hexString) {
  if (typeof hexString !== 'string') {
    throw new TypeError('hexString must be a string');
  }
  if (hexString.length < 32) {
    throw new Error('hexString must be at least 32 characters');
  }
  const h = hexString.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function alignToMinute(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    throw new TypeError('ms must be a finite number');
  }
  return Math.floor(ms / 60_000) * 60_000;
}

function buildSampleFromBucket(bucket, sourceId, strideM) {
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new Error('sourceId must be a non-empty string');
  }
  if (typeof strideM !== 'number' || !Number.isFinite(strideM) || strideM <= 0) {
    throw new Error('strideM must be a positive finite number');
  }

  const count = bucket?.result?.COUNT_TOTAL;
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    return null;
  }

  const windowStartMs = Date.parse(bucket.startTime);
  const windowEndMs = Date.parse(bucket.endTime);
  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
    throw new Error('bucket startTime and endTime must parse to finite ms');
  }

  const steps = count;
  return {
    sourceId,
    windowStartMs,
    windowEndMs,
    steps,
    distanceM: Math.floor(steps * strideM),
  };
}

/**
 * Merge per-minute aggregate buckets from Steps / ActiveCaloriesBurned /
 * Distance into one row per minute window. Union of windows: a cycling
 * minute has distance + kcal with zero steps and must still produce a
 * sample (Range/Drill/Tempo axes). kcal and distance arrays may be empty
 * (permission not granted) — result degrades to steps-only.
 *
 * Returns [{ windowStartMs, windowEndMs, steps, kcalRaw, sensorDistanceM }]
 * sorted by windowStartMs, containing only minutes with any activity.
 */
function mergeMetricBuckets(stepBuckets, kcalBuckets, distanceBuckets) {
  const byStart = new Map();

  function entryFor(bucket) {
    const startMs = Date.parse(bucket.startTime);
    const endMs = Date.parse(bucket.endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    let e = byStart.get(startMs);
    if (!e) {
      e = { windowStartMs: startMs, windowEndMs: endMs, steps: 0, kcalRaw: 0, sensorDistanceM: 0 };
      byStart.set(startMs, e);
    }
    return e;
  }

  for (const b of stepBuckets ?? []) {
    const count = b?.result?.COUNT_TOTAL;
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
    const e = entryFor(b);
    if (e) e.steps = count;
  }

  for (const b of kcalBuckets ?? []) {
    const kcal = b?.result?.ACTIVE_CALORIES_TOTAL?.inKilocalories;
    if (typeof kcal !== 'number' || !Number.isFinite(kcal) || kcal <= 0) continue;
    const e = entryFor(b);
    if (e) e.kcalRaw = kcal;
  }

  for (const b of distanceBuckets ?? []) {
    const m = b?.result?.DISTANCE?.inMeters;
    if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0) continue;
    const e = entryFor(b);
    if (e) e.sensorDistanceM = m;
  }

  return [...byStart.values()].sort((a, b) => a.windowStartMs - b.windowStartMs);
}

/**
 * Build a wire sample from a merged per-minute metrics row.
 * Distance: sensor metres when present, stride fallback otherwise (spec §5.3).
 * kcal: ACTIVE calories, rounded — backend requires a non-negative integer.
 * Returns null for a row with no activity.
 */
function buildSampleFromMetrics(row, sourceId, strideM) {
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new Error('sourceId must be a non-empty string');
  }
  if (typeof strideM !== 'number' || !Number.isFinite(strideM) || strideM <= 0) {
    throw new Error('strideM must be a positive finite number');
  }

  const steps = Number.isFinite(row?.steps) && row.steps > 0 ? Math.floor(row.steps) : 0;
  const kcal = Number.isFinite(row?.kcalRaw) && row.kcalRaw > 0 ? Math.round(row.kcalRaw) : 0;
  const sensorM =
    Number.isFinite(row?.sensorDistanceM) && row.sensorDistanceM > 0
      ? Math.round(row.sensorDistanceM)
      : 0;

  if (steps <= 0 && kcal <= 0 && sensorM <= 0) return null;

  const distanceM = sensorM > 0 ? sensorM : Math.floor(steps * strideM);

  const sample = {
    sourceId,
    windowStartMs: row.windowStartMs,
    windowEndMs: row.windowEndMs,
    steps,
    distanceM,
  };
  if (kcal > 0) sample.kcal = kcal;
  return sample;
}

function evictOldestIfOverCap(samples, cap) {
  if (!Array.isArray(samples)) {
    throw new TypeError('samples must be an array');
  }
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0) {
    throw new TypeError('cap must be a non-negative finite number');
  }
  if (samples.length <= cap) {
    return { kept: samples, dropped: 0 };
  }
  const dropped = samples.length - cap;
  return { kept: samples.slice(samples.length - cap), dropped };
}

function shouldFlush(state, trigger) {
  if (state.flushInProgress === true) {
    return { shouldFlush: false, reason: 'in-progress' };
  }
  if (state.bufferSize === 0) {
    return { shouldFlush: false, reason: 'empty' };
  }
  if (!state.isConnected) {
    return { shouldFlush: false, reason: 'offline' };
  }
  if (trigger === 'foreground') {
    if (state.lastFlushAt == null) {
      return { shouldFlush: true, reason: 'foreground-first' };
    }
    if (state.now - state.lastFlushAt >= 300_000) {
      return { shouldFlush: true, reason: 'foreground-inactive' };
    }
    return { shouldFlush: false, reason: 'foreground-too-recent' };
  }
  return { shouldFlush: true, reason: trigger };
}

function buildPostBody(samples) {
  if (!Array.isArray(samples)) {
    throw new TypeError('samples must be an array');
  }
  const capped = samples.slice(0, 100);
  const wireSamples = capped.map((s) => {
    const out = {
      sourceId: s.sourceId,
      windowStart: new Date(s.windowStartMs).toISOString(),
      windowEnd: new Date(s.windowEndMs).toISOString(),
      steps: s.steps,
    };
    if (s.distanceM != null) {
      out.distanceM = s.distanceM;
    }
    if (s.kcal != null && s.kcal > 0) {
      out.kcal = s.kcal;
    }
    return out;
  });
  return { samples: wireSamples };
}

function mergeRehydratedState(stored, currentPlayerId) {
  if (typeof currentPlayerId !== 'string' || currentPlayerId.length === 0) {
    throw new Error('currentPlayerId must be a non-empty string');
  }

  const empty = {
    samples: [],
    lastFlushedWindowEndMs: null,
    lastFlushAt: null,
    lastFlushFailed: false,
    playerId: currentPlayerId,
  };

  if (stored == null || typeof stored !== 'object') {
    return empty;
  }
  if (stored.playerId !== currentPlayerId) {
    return empty;
  }

  return {
    samples: Array.isArray(stored.samples) ? stored.samples : [],
    lastFlushedWindowEndMs: Number.isFinite(stored.lastFlushedWindowEndMs)
      ? stored.lastFlushedWindowEndMs
      : null,
    lastFlushAt: Number.isFinite(stored.lastFlushAt) ? stored.lastFlushAt : null,
    lastFlushFailed: stored.lastFlushFailed === true,
    playerId: currentPlayerId,
  };
}

module.exports = {
  formatHexAsUuid,
  alignToMinute,
  buildSampleFromBucket,
  mergeMetricBuckets,
  buildSampleFromMetrics,
  evictOldestIfOverCap,
  shouldFlush,
  buildPostBody,
  mergeRehydratedState,
};
