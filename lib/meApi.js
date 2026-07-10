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
const REQUEST_TIMEOUT_MS = 12000;
const TOKEN_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 600;

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

// A single fetch attempt, guaranteed to settle. On Android, RN's fetch does not
// reliably reject when the AbortController fires (and `Connection: close` is a
// no-op over Railway's HTTP/2), so a request reusing a stale keep-alive
// connection can hang forever. Racing an explicit reject-timer guarantees this
// promise settles even if the underlying fetch never does.
async function fetchOnce(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await withTimeout(
      fetch(url, { ...opts, signal: controller.signal }),
      REQUEST_TIMEOUT_MS + 1000,
      'request',
    );
  } finally {
    clearTimeout(timer);
  }
}

// `retries` is opt-in and must only be used by idempotent (GET) callers: a
// stalled connection is torn down on timeout, so the retry establishes a fresh
// one — which is what recovers from the stale-HTTP/2-connection hang.
async function fetchWithTimeout(url, opts, { retries = 0 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    try {
      return await fetchOnce(url, opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
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

async function getJson(path, token) {
  return fetchWithTimeout(
    `${BACKEND_URL}${path}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    },
    { retries: 1 }, // GET is idempotent — retry recovers from a stale connection
  );
}

/**
 * Fetch the authenticated player's own record via GET /me. Returns the same
 * PlayerMe shape as bootstrap (includes home_pin_lat/lng, which are no longer
 * readable by the anon Supabase client). Callers that previously did
 * `supabase.from('players').select(...).eq('clerk_id', userId)` for their own
 * row should use this instead.
 *
 * @returns {Promise<{ok: true, data: { clerkUserId: string, player: Object }} | {ok: false, status: number, error: any}>}
 */
export async function getMe({ clerkGetToken }) {
  try {
    const token = await getTokenWithTimeout(clerkGetToken);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await getJson('/me', token);
    if (!res.ok) {
      const error = await parseError(res);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] getMe network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Read the player's stride calibration via GET /me/stride-calibration.
 * Replaces the direct `stride_*` column read in lib/claim.js `loadPlayerStride`
 * — those columns are no longer readable by the anon client.
 *
 * @returns {Promise<{ok: true, data: { strideM: number, sessions: number, samples: number[] }} | {ok: false, status: number, error: any}>}
 */
export async function getStrideCalibration({ clerkGetToken }) {
  try {
    const token = await getTokenWithTimeout(clerkGetToken);
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await getJson('/me/stride-calibration', token);
    if (!res.ok) {
      const error = await parseError(res);
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[meApi] getStrideCalibration network error', err?.message ?? err);
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
      { retries: 1 }, // idempotent read — retry recovers from a stale connection
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
