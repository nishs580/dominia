import { BACKEND_URL } from './api';

/**
 * Set the player's home pin via backend POST /me/home-pin.
 *
 * Backend owns:
 *   - players.home_pin_lat / home_pin_lng update
 *   - players.home_timezone derivation via tz-lookup
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {number} opts.lat — home pin latitude
 * @param {number} opts.lng — home pin longitude
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function setHomePin({ clerkGetToken, lat, lng }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/home-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({
        home_pin_lat: lat,
        home_pin_lng: lng,
      }),
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[homePinApi] non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[homePinApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
