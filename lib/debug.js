import { BACKEND_URL } from './api';

const DEBUG_ENABLED = true;

/**
 * Client-side diagnostic logging. Routes through the authenticated backend
 * endpoint POST /me/debug-log instead of writing to Supabase directly — the old
 * anon `debug_events` insert path was removed (it let anyone with the public key
 * insert unbounded rows). The backend derives player_id from the token, so the
 * caller no longer supplies it.
 *
 * @param {() => Promise<string|null>} getToken  Clerk token getter (from useAuth)
 * @param {string} eventType
 * @param {object} [payload]
 */
export async function logDebug(getToken, eventType, payload = {}) {
  if (!DEBUG_ENABLED) return;
  try {
    const token = typeof getToken === 'function' ? await getToken() : null;
    if (!token) return;
    await fetch(`${BACKEND_URL}/me/debug-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({ eventType, payload }),
    });
  } catch (e) {
    console.warn('[logDebug] failed:', e?.message);
  }
}
