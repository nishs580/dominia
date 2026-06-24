import { BACKEND_URL } from './api';

/**
 * Fetch the player's Daily Achievements data from backend GET /me/activity-bests.
 *
 * Returns today's totals and all-time best single-day totals, aggregated
 * server-side from accepted activity_samples.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @returns {Promise<
 *   { ok: true, data: { today: { distance_m, active_minutes }, best: { distance_m, active_minutes } } }
 *   | { ok: false, status: number, error: string }
 * >}
 *
 * Never throws — caller relies on the {ok} discriminant.
 */
export async function fetchActivityBests({ clerkGetToken }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/activity-bests`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[activityBestsApi] non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[activityBestsApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
