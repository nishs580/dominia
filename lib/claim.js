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
// Three guards, in order of preference:
//   1. Prefer the OS speed estimate — Doppler-derived on the GNSS chip and
//      immune to position jitter. Android reports it in m/s (negative when
//      unavailable).
//   2. Only difference positions across a real time gap AND usable accuracy.
//   3. Require sustained samples, and never let a stale reading hold the flag.
const SPEED_MIN_DT_MS = 3000;        // pairs closer than this amplify jitter
const SPEED_MAX_ACCURACY_M = 25;     // both fixes must be at least this good
const SPEED_STALE_MS = 15000;        // no usable sample this long → unknown
const VEHICLE_CONSECUTIVE_HITS = 3;  // sustained samples before flagging

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

  // 1. OS/Doppler estimate when the platform provides one.
  const os = currentFix.speed;
  if (Number.isFinite(os) && os >= 0) return os * 3.6;

  // 2. Positional differencing — only when the pair can actually support it.
  if (!prevFix) return null;
  const dtMs = currentFix.timestamp - prevFix.timestamp;
  if (!Number.isFinite(dtMs) || dtMs < SPEED_MIN_DT_MS) return null;
  if ((prevFix.accuracy ?? Infinity) > SPEED_MAX_ACCURACY_M) return null;
  if ((currentFix.accuracy ?? Infinity) > SPEED_MAX_ACCURACY_M) return null;

  return computeSpeedKmh(prevFix, currentFix);
}

/**
 * Hysteresis for the vehicle flag: only a sustained run of over-cap samples
 * raises it, and an unknown reading clears it outright. Pure — prev is
 * { hits, inVehicle }.
 */
export function nextVehicleState(prev, speedKmh) {
  const base = prev ?? { hits: 0, inVehicle: false };
  // Unknown/stale must never hold the flag on: a single spurious spike
  // followed by GPS going quiet would otherwise wedge the walk permanently.
  if (speedKmh == null) return { hits: 0, inVehicle: false };
  const hits = isVehicleSpeed(speedKmh) ? base.hits + 1 : 0;
  return { hits, inVehicle: hits >= VEHICLE_CONSECUTIVE_HITS };
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
  VEHICLE_CONSECUTIVE_HITS,
};
