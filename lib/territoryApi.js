import { BACKEND_URL } from './api';

/**
 * Abandon a territory via POST /territories/:id/abandon. Replaces the direct
 * `supabase.from('territories').update({ owner_id: null, alliance_id: null })`
 * write, which is no longer permitted now that RLS is enabled.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async () => Clerk JWT
 * @param {string} opts.territoryId
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: any}>}
 */
export async function abandonTerritory({ clerkGetToken, territoryId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/territories/${territoryId}/abandon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[territoryApi] abandonTerritory non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[territoryApi] abandonTerritory network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
