// lib/claim.js
// All math + Supabase I/O for the steps-driven claim/contest loop.
// Pure functions for math. Async functions for DB I/O.

import { supabase } from './supabase';
import { pushStrideCalibration, getStrideCalibration } from './meApi';

const DEFAULT_STRIDE_M = 0.75;
const CALIBRATION_SAMPLE_CAP = 10;
const CALIBRATION_MIN_WINDOW_MS = 30 * 1000;
const CALIBRATION_MIN_ACCURACY_M = 5;
const CALIBRATION_MAX_ACCURACY_M = 20;
const VEHICLE_SPEED_KMH = 25;

// ─── Vehicle-filter robustness ─────────────────────────────────────────────
// GPS *position* noise — not real motion — is the dominant false-positive
// source. Two fixes a second apart with 20 m of jitter difference out to
// >70 km/h, which reads as "vehicle" to someone walking between buildings.
// The 25 km/h trigger sits inside consumer-GNSS urban multipath noise (5–15
// m/s transients are routine between buildings), so the threshold alone can
// never be the whole filter. Four guards, in order of authority:
//
//   1. STEP CADENCE VETO (primary). Feet on the ground is a signature a car
//      cannot produce: sustained walking cadence means walking, whatever GPS
//      claims. This is the sensor-fusion layer every mainstream activity
//      classifier (Android Activity Recognition, iOS CMMotionActivity) builds
//      on, and it is what makes a noise-floor threshold survivable.
//   2. Prefer the OS speed estimate — Doppler-derived on the GNSS chip and
//      immune to position jitter. Android reports it in m/s (negative when
//      unavailable). Only difference positions across a real time gap AND
//      usable accuracy.
//   3. Absurd readings are NOISE, not evidence — a 200 km/h reading on a
//      walk is a broken fix, and must not count toward a vehicle verdict.
//   4. Confirmation is a sustained DURATION, not a sample count: sample
//      cadence varies with GPS conditions, so counting samples silently means
//      "3 spikes, possibly a minute apart" in exactly the urban conditions
//      that produce spikes. Anything contrary — a sub-cap reading, an unknown
//      reading, or walking cadence — breaks the run outright.
const SPEED_MIN_DT_MS = 3000;        // pairs closer than this amplify jitter
const SPEED_MAX_ACCURACY_M = 25;     // both fixes must be at least this good
const SPEED_STALE_MS = 15000;        // no usable sample this long → unknown
const SPEED_IMPLAUSIBLE_KMH = 150;   // beyond this the fix is broken, not fast
const VEHICLE_SUSTAIN_MS = 20000;    // continuous over-cap time before flagging

// Cadence floor that vetoes a vehicle verdict. Deliberately far below any
// real gait — a slow amble is ~80 spm, a brisk walk 100–120 — so the veto
// fires on any genuine walking while a passenger's incidental phone jostle
// (sporadic, and nowhere near sustained) stays below it.
const WALKING_CADENCE_MIN_SPM = 40;
// Cadence needs a real observation window to mean anything; below this the
// reading is "unknown" and vetoes nothing.
const CADENCE_MIN_OBSERVATION_MS = 10000;

// ─── DB I/O ────────────────────────────────────────────────────────────────

export async function loadPlayerStride(clerkGetToken) {
  if (typeof clerkGetToken !== 'function') {
    return { strideM: DEFAULT_STRIDE_M, sessions: 0, samples: [] };
  }
  // stride_* columns are no longer readable by the anon Supabase client; the
  // authenticated backend derives the player from the token and returns them.
  const res = await getStrideCalibration({ clerkGetToken });
  if (!res.ok) {
    console.warn('[claim] loadPlayerStride failed:', res.status, res.error);
    return { strideM: DEFAULT_STRIDE_M, sessions: 0, samples: [] };
  }
  return {
    strideM: res.data?.strideM ?? DEFAULT_STRIDE_M,
    sessions: res.data?.sessions ?? 0,
    samples: Array.isArray(res.data?.samples) ? res.data.samples : [],
  };
}

export async function pushCalibrationSample(clerkGetToken, gpsDistM, stepsInWindow) {
  if (!Number.isFinite(gpsDistM) || !Number.isFinite(stepsInWindow) || stepsInWindow <= 0) {
    return null;
  }
  // The server appends the sample, applies the human-stride bounds, recomputes
  // the rolling-mean stride and persists it (POST /me/stride-calibration).
  const res = await pushStrideCalibration({ clerkGetToken, gpsDistM, stepsInWindow });
  if (!res.ok) {
    console.warn('[claim] pushCalibrationSample failed:', res.status, res.error);
    return null;
  }
  if (!res.data.accepted) {
    // Out-of-range sample — stride left unchanged.
    return null;
  }
  return {
    strideM: res.data.strideM,
    sessions: res.data.sessions,
    samples: res.data.samples,
  };
}

// ─── PURE MATH ─────────────────────────────────────────────────────────────

export function stepsToMetres(stepDelta, strideM) {
  if (!Number.isFinite(stepDelta) || !Number.isFinite(strideM) || stepDelta < 0) return 0;
  return stepDelta * strideM;
}

export function haversineMetres(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeSpeedKmh(prevFix, currentFix) {
  if (!prevFix || !currentFix) return 0;
  const distM = haversineMetres(
    prevFix.latitude, prevFix.longitude,
    currentFix.latitude, currentFix.longitude
  );
  const dtMs = currentFix.timestamp - prevFix.timestamp;
  if (dtMs <= 0) return 0;
  const mps = distM / (dtMs / 1000);
  return mps * 3.6;
}

export function isVehicleSpeed(kmh) {
  return Number.isFinite(kmh) && kmh > VEHICLE_SPEED_KMH;
}

/**
 * Best available speed reading for a fix, or null when none is trustworthy.
 *
 * null means "unknown", NOT "stationary" — callers must not treat it as 0 and
 * must never keep a vehicle flag raised on it.
 */
export function speedSampleKmh(prevFix, currentFix) {
  if (!currentFix) return null;

  // A weak fix is untrustworthy for BOTH speed sources, not just positional
  // differencing. On a cold or obstructed fix the OS/Doppler estimate can
  // itself report a spurious high speed — this is what flagged a stationary
  // indoor tester as "vehicle". Gate every source on accuracy up front so a
  // weak fix reads as unknown (null), which is exactly what "vehicle filter
  // on hold during weak GPS" is meant to mean. Without this the OS-speed path
  // below bypassed the accuracy check entirely.
  if ((currentFix.accuracy ?? Infinity) > SPEED_MAX_ACCURACY_M) return null;

  // 1. OS/Doppler estimate when the platform provides one.
  const os = currentFix.speed;
  if (Number.isFinite(os) && os >= 0) return plausibleOrNull(os * 3.6);

  // 2. Positional differencing — only when the pair can actually support it.
  if (!prevFix) return null;
  const dtMs = currentFix.timestamp - prevFix.timestamp;
  if (!Number.isFinite(dtMs) || dtMs < SPEED_MIN_DT_MS) return null;
  if ((prevFix.accuracy ?? Infinity) > SPEED_MAX_ACCURACY_M) return null;

  return plausibleOrNull(computeSpeedKmh(prevFix, currentFix));
}

/**
 * A reading no human journey produces is a broken fix, not a fast one. Return
 * it as unknown so it clears the filter instead of incriminating the player —
 * treating garbage as evidence is how a walker ends up flagged for driving.
 */
function plausibleOrNull(kmh) {
  return kmh > SPEED_IMPLAUSIBLE_KMH ? null : kmh;
}

/**
 * Vehicle verdict. Pure — prev is { overCapSince, inVehicle }, and the verdict
 * is a function of how LONG the evidence has held, not how many samples
 * happened to arrive.
 *
 * `context.cadenceSpm` is the trailing step cadence (null when there is not
 * yet enough observation to mean anything). It outranks GPS entirely: a
 * sustained gait is direct evidence of feet on the ground, whereas the speed
 * reading it would be overruling is an inference from the noisiest sensor on
 * the device.
 *
 * Everything that is not positive, sustained over-cap evidence resets the run,
 * so the flag can only be reached by 20 uninterrupted seconds of a fast GPS
 * reading with no walking cadence underneath it.
 */
export function nextVehicleState(prev, speedKmh, context = {}) {
  const base = prev ?? { overCapSince: null, inVehicle: false };
  const nowMs = Number.isFinite(context.nowMs) ? context.nowMs : Date.now();
  const cadenceSpm = context.cadenceSpm;
  const clear = { overCapSince: null, inVehicle: false };

  // 1. Cadence veto — walking beats any speed reading, including an
  //    already-raised flag. This is the guard that lets the trigger sit at a
  //    threshold GPS noise can reach without punishing real walkers.
  if (Number.isFinite(cadenceSpm) && cadenceSpm >= WALKING_CADENCE_MIN_SPM) {
    return clear;
  }

  // 2. Unknown/stale must never hold the flag on: a single spurious spike
  //    followed by GPS going quiet would otherwise wedge the walk permanently.
  if (speedKmh == null) return clear;

  // 3. Anything at or below the cap is affirmative evidence of not-a-vehicle.
  if (!isVehicleSpeed(speedKmh)) return clear;

  const overCapSince = base.overCapSince ?? nowMs;
  return {
    overCapSince,
    inVehicle: nowMs - overCapSince >= VEHICLE_SUSTAIN_MS,
  };
}

/**
 * Trailing step cadence in steps/min, or null when the window is too short to
 * read. `history` is oldest-first [{ at, steps }] of cumulative session steps.
 */
export function cadenceSpmFrom(history, currentSteps, nowMs) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const oldest = history[0];
  if (!oldest || !Number.isFinite(oldest.at) || !Number.isFinite(oldest.steps)) {
    return null;
  }
  const elapsedMs = nowMs - oldest.at;
  if (elapsedMs < CADENCE_MIN_OBSERVATION_MS) return null;
  return paceSpm(Math.max(0, currentSteps - oldest.steps), elapsedMs);
}

export function isQualifyingCalibrationWindow({ accuracyM, speedKmh, windowMs }) {
  if (!Number.isFinite(accuracyM) || !Number.isFinite(speedKmh) || !Number.isFinite(windowMs)) {
    return { qualifies: false, rejectReason: null };
  }
  if (accuracyM < CALIBRATION_MIN_ACCURACY_M) {
    return { qualifies: false, rejectReason: 'accuracy_low' };
  }
  if (accuracyM > CALIBRATION_MAX_ACCURACY_M) {
    return { qualifies: false, rejectReason: 'accuracy_high' };
  }
  if (speedKmh >= VEHICLE_SPEED_KMH) {
    return { qualifies: false, rejectReason: 'speed_high' };
  }
  if (windowMs <= CALIBRATION_MIN_WINDOW_MS) {
    return { qualifies: false, rejectReason: 'window_short' };
  }
  return { qualifies: true, rejectReason: null };
}

export function paceSpm(stepDelta, elapsedMs) {
  if (!Number.isFinite(stepDelta) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.round((stepDelta / elapsedMs) * 60000);
}

// ─── EXPORTED CONSTANTS (for tests + UI) ───────────────────────────────────

export const CLAIM_CONSTANTS = {
  DEFAULT_STRIDE_M,
  CALIBRATION_SAMPLE_CAP,
  CALIBRATION_MIN_WINDOW_MS,
  CALIBRATION_MIN_ACCURACY_M,
  CALIBRATION_MAX_ACCURACY_M,
  VEHICLE_SPEED_KMH,
  SPEED_MIN_DT_MS,
  SPEED_MAX_ACCURACY_M,
  SPEED_STALE_MS,
  SPEED_IMPLAUSIBLE_KMH,
  VEHICLE_SUSTAIN_MS,
  WALKING_CADENCE_MIN_SPM,
  CADENCE_MIN_OBSERVATION_MS,
};
