import { BACKEND_URL } from './api';

/**
 * Alliance Weekly Task API client. Mirrors lib/commandPostApi.js: Clerk bearer
 * token, `Connection: close` dead-TCP workaround, never throws, always returns
 * an {ok} discriminated result. Backend enforces all gates (membership, role,
 * pick window) — these helpers just relay.
 */

async function authedGet(clerkGetToken, path, tag) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

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
      console.log(`[weeklyTaskApi] ${tag} non-2xx`, res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log(`[weeklyTaskApi] ${tag} network error`, err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Current week's task card (all members; founder/marshal responses include the
 * per-member breakdown) via GET /alliances/:id/weekly-task
 */
export function getWeeklyTask({ clerkGetToken, allianceId }) {
  return authedGet(clerkGetToken, `/alliances/${allianceId}/weekly-task`, 'getWeeklyTask');
}

/**
 * Pick menu + window state via GET /alliances/:id/weekly-task/menu
 */
export function getWeeklyTaskMenu({ clerkGetToken, allianceId }) {
  return authedGet(clerkGetToken, `/alliances/${allianceId}/weekly-task/menu`, 'getWeeklyTaskMenu');
}

/**
 * Founder/Marshal pick for next week (Sat–Sun HQ-local window) via
 * POST /alliances/:id/weekly-task/pick { task_type }
 */
export async function pickWeeklyTask({ clerkGetToken, allianceId, taskType }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/weekly-task/pick`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({ task_type: taskType }),
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[weeklyTaskApi] pickWeeklyTask non-2xx', res.status, errBody);
      let error = `http_${res.status}`;
      try { error = JSON.parse(errBody)?.error ?? error; } catch (_) { /* keep code */ }
      return { ok: false, status: res.status, error };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[weeklyTaskApi] pickWeeklyTask network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
