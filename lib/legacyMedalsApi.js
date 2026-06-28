import { BACKEND_URL } from './api';

/**
 * Fetch a player's Legacy Medal state from the backend.
 * Self: GET /legacy/medals. Another player: GET /players/:id/legacy/medals.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning a Clerk JWT
 * @param {string} [opts.playerId] — when set, fetches that player's medals
 * @returns {Promise<{ ok: true, data: { playerId, medals } } | { ok: false, status: number, error: string }>}
 *
 * Never throws — caller relies on the {ok} discriminant.
 */
export async function fetchLegacyMedals({ clerkGetToken, playerId } = {}) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const path = playerId
      ? `/players/${playerId}/legacy/medals`
      : '/legacy/medals';

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[legacyMedalsApi] non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[legacyMedalsApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
