import { BACKEND_URL } from './api';

/**
 * Develop a territory to its next level via POST /territories/:id/develop.
 * One atomic spend of the full per-level cost — the backend rejects with
 * 402 { error: 'insufficient_resources', shortfall } when the wallet is
 * short, 403 { error: 'level_gate' } below the player-level gate, and
 * 409 { error: 'level_changed' } when the sheet went stale.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async () => Clerk JWT
 * @param {string} opts.territoryId
 * @param {number} opts.confirmLevel — level shown at confirm time (current + 1)
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: any}>}
 */
export async function developTerritory({ clerkGetToken, territoryId, confirmLevel }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/territories/${territoryId}/develop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({ confirm_level: confirmLevel }),
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
      console.log('[developApi] developTerritory non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[developApi] developTerritory network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
