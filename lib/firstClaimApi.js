import { BACKEND_URL } from './api';

/**
 * First-claim objective client (GET /territories/first-claim-objective).
 *
 * Returns { held_count, target } where target is the nearest unclaimed
 * small/medium territory (null once the player holds any territory, or when
 * no position/claimable land exists — `reason` says which). Never throws;
 * callers rely on the { ok } discriminant, matching lib/meApi.js.
 */

const REQUEST_TIMEOUT_MS = 20000;
const TOKEN_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms),
    ),
  ]);
}

export async function fetchFirstClaimObjective({ clerkGetToken, lat, lng }) {
  try {
    const token = await withTimeout(Promise.resolve(clerkGetToken()), TOKEN_TIMEOUT_MS, 'token');
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const params =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
        : '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${BACKEND_URL}/territories/first-claim-objective${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Connection: 'close',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[firstClaimApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/** "320m" under a kilometre, "1.2km" above — for the objective instruction. */
export function formatWalkDistance(metres) {
  const m = Math.max(0, Math.round(Number(metres) || 0));
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
