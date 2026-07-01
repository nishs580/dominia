import { BACKEND_URL } from './api';

/**
 * Command Post API client. Founder-only surface; the backend enforces the gate
 * (403 not_founder) — these helpers just relay it. Mirrors lib/allianceApi.js:
 * Clerk bearer token, `Connection: close` dead-TCP workaround, never throws,
 * always returns an {ok} discriminated result.
 */

/**
 * Panels 1 + 2 — Roster Readiness + Lapse Radar via
 * GET /alliances/:id/command-post?sort=readiness|steps
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.allianceId — alliance UUID
 * @param {'readiness'|'steps'} [opts.sort] — roster sort (default readiness)
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: string}>}
 */
export async function getCommandPost({ clerkGetToken, allianceId, sort }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const qs = sort ? `?sort=${encodeURIComponent(sort)}` : '';
    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/command-post${qs}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[commandPostApi] getCommandPost non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[commandPostApi] getCommandPost network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Panel 5 — latest Week in Review card via
 * GET /alliances/:id/command-post/week-in-review
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.allianceId — alliance UUID
 *
 * @returns {Promise<{ok: true, data: { week_in_review: Object | null }} | {ok: false, status: number, error: string}>}
 */
export async function getWeekInReview({ clerkGetToken, allianceId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/command-post/week-in-review`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[commandPostApi] getWeekInReview non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[commandPostApi] getWeekInReview network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
