// lib/claim.js
// All math + Supabase I/O for the steps-driven claim/contest loop.
// Pure functions for math. Async functions for DB I/O.

import { supabase } from './supabase';
import { pushStrideCalibration } from './meApi';

const DEFAULT_STRIDE_M = 0.75;
const CALIBRATION_SAMPLE_CAP = 10;
const CALIBRATION_MIN_WINDOW_MS = 30 * 1000;
const CALIBRATION_MIN_ACCURACY_M = 5;
const CALIBRATION_MAX_ACCURACY_M = 20;
const VEHICLE_SPEED_KMH = 25;

// ─── DB I/O ────────────────────────────────────────────────────────────────

export async function loadPlayerStride(playerId) {
  if (!playerId) {
    return {
      strideM: DEFAULT_STRIDE_M,
      sessions: 0,
      samples: [],
    };
  }
  const { data, error } = await supabase
    .from('players')
    .select('stride_length_m, stride_calibration_sessions, stride_calibration_samples')
    .eq('id', playerId)
    .maybeSingle();
  if (error) {
    console.warn('[claim] loadPlayerStride error:', error.message);
    return { strideM: DEFAULT_STRIDE_M, sessions: 0, samples: [] };
  }
  return {
    strideM: data?.stride_length_m ?? DEFAULT_STRIDE_M,
    sessions: data?.stride_calibration_sessions ?? 0,
    samples: Array.isArray(data?.stride_calibration_samples)
      ? data.stride_calibration_samples
      : [],
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
};
