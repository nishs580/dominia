import { BACKEND_URL } from './api';

/**
 * Backend client for the authenticated player's own record (/me/*).
 * Replaces the former direct `supabase.from('players')` reads/writes from the
 * mobile app, which are no longer permitted now that RLS is enabled.
 *
 * Every function takes `clerkGetToken` (async () => Clerk JWT) and never throws
 * — callers rely on the { ok } discriminant.
 */

// The backend may cold-start (Railway), so a request can take several seconds
// on the first hit. Cap it so the UI never hangs indefinitely.
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

// Resolve the Clerk token with a timeout — getToken() can stall right after a
// session becomes active, and we don't want that to block the UI forever.
async function getTokenWithTimeout(clerkGetToken) {
  return withTimeout(Promise.resolve(clerkGetToken()), TOKEN_TIMEOUT_MS, 'token');
}

async function fetchWithTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(path, token, body) {
  return fetchWithTimeout(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Connection: 'close', // matches lib/supabase.js dead-TCP fix
    },
    body: JSON.stringify(body ?? {}),
  });
}

async function parseError(res) {
  let errBody = null;
  try {
    errBody = await res.json();
  } catch (_) {
    try {
      const text = await res.text();
      errBody = text ? { message: text } : null;
    } catch (_) { /* ignore */ }
  }
  return errBody || `http_${res.status}`;
}

/**
 * Create the player row if it does not yet exist via POST /me/bootstrap.
 * Replaces lib/auth.js `ensurePlayer` (which inserted directly into Supabase).
 *
 * @returns {Promise<{ok: true, data: { player: Object, needsUsername: boolean }} | {ok: false, status: number, error: any}>}
 */
export async function bootstrapPlayer({ clerkGetToken, email }) {
  try {
    console.log('[meApi] bootstrapPlayer: requesting Clerk token…');
    const token = await getTokenWithTimeout(clerkGetToken);
    console.log('[meApi] bootstrapPlayer: token resolved?', !!token);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    console.log('[meApi] bootstrapPlayer: POST', `${BACKEND_URL}/me/bootstrap`);
    const res = await postJson('/me/bootstrap', token, { email });
    console.log('[meApi] bootstrapPlayer: response status', res.status);
    if (!res.ok) {
      const error = await parseError(res);
      console.log('[meApi] bootstrapPlayer non-2xx', res.status, error);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] bootstrapPlayer network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Update mutable fields on the player via PATCH /me.
 * Supports { username, has_onboarded, avatar_url, locale }. Replaces the direct
 * `supabase.from('players').update(...)` calls in UsernameScreen / OnboardingScreen.
 *
 * @returns {Promise<{ok: true, data: { player: Object }} | {ok: false, status: number, error: any}>}
 */
export async function patchMe({ clerkGetToken, fields }) {
  try {
    const token = await getTokenWithTimeout(clerkGetToken);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetchWithTimeout(`${BACKEND_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify(fields ?? {}),
    });

    if (!res.ok) {
      const error = await parseError(res);
      console.log('[meApi] patchMe non-2xx', res.status, error);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] patchMe network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Check whether a username is free via GET /me/username-available?username=X.
 * Used by the onboarding picker to give inline feedback before submit. The
 * backend applies the same validation + case-insensitive uniqueness as the
 * write path, so this is advisory — PATCH /me stays authoritative.
 *
 * @returns {Promise<{ok: true, data: { available: boolean, reason: 'invalid'|'taken'|null }} | {ok: false, status: number, error: any}>}
 */
export async function checkUsernameAvailable({ clerkGetToken, username }) {
  try {
    const token = await getTokenWithTimeout(clerkGetToken);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetchWithTimeout(
      `${BACKEND_URL}/me/username-available?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Connection: 'close',
        },
      },
    );

    if (!res.ok) {
      const error = await parseError(res);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] checkUsernameAvailable network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Permanently delete the player's account via DELETE /me/account.
 * The backend wipes all game data and the Clerk user; callers must treat a
 * success as terminal (sign out immediately — the session is dead).
 *
 * @returns {Promise<{ok: true, data: { deleted: boolean }} | {ok: false, status: number, error: any}>}
 */
export async function deleteAccount({ clerkGetToken }) {
  try {
    const token = await getTokenWithTimeout(clerkGetToken);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetchWithTimeout(`${BACKEND_URL}/me/account`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
    });

    if (!res.ok) {
      const error = await parseError(res);
      console.log('[meApi] deleteAccount non-2xx', res.status, error);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] deleteAccount network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Push one stride-calibration sample via POST /me/stride-calibration.
 * Replaces lib/claim.js `pushCalibrationSample`. The server computes and
 * persists the rolling-mean stride; out-of-range samples resolve to
 * { ok: true, data: { accepted: false, ... } }.
 *
 * @returns {Promise<{ok: true, data: { strideM: number, sessions: number, samples: number[], accepted: boolean }} | {ok: false, status: number, error: any}>}
 */
export async function pushStrideCalibration({ clerkGetToken, gpsDistM, stepsInWindow }) {
  try {
    const token = await getTokenWithTimeout(clerkGetToken);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await postJson('/me/stride-calibration', token, {
      gps_dist_m: gpsDistM,
      steps_in_window: stepsInWindow,
    });

    if (!res.ok) {
      const error = await parseError(res);
      console.log('[meApi] pushStrideCalibration non-2xx', res.status, error);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] pushStrideCalibration network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
