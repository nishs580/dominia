import { BACKEND_URL } from './api';

/**
 * Fetch unacknowledged streak-break status via GET /me/streak-break-status.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 *
 * @returns {Promise<
 *   | { ok: true, data: { has_unacknowledged_break: boolean, previous_streak: number | null, broken_at: string | null } }
 *   | { ok: false, status: number, error: string }
 * >}
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function getStreakBreakStatus({ clerkGetToken }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/streak-break-status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[streakBreakApi] getStreakBreakStatus non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[streakBreakApi] getStreakBreakStatus network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Acknowledge streak break via POST /me/streak-break/acknowledge.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 *
 * @returns {Promise<
 *   | { ok: true, data: { ok: true, acknowledged_at: string } }
 *   | { ok: false, status: number, error: string }
 * >}
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function acknowledgeStreakBreak({ clerkGetToken }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/streak-break/acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: '{}',
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[streakBreakApi] acknowledgeStreakBreak non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[streakBreakApi] acknowledgeStreakBreak network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
