import { BACKEND_URL } from './api';

async function _readErrorBody(res) {
  try {
    return await res.text();
  } catch (_) {
    return '';
  }
}

async function _requestWith401Retry(clerkGetToken, fetchFn) {
  async function attempt() {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token', is401: true };
    }

    const res = await fetchFn(token);
    const status = res.status;

    if (status >= 200 && status < 300) {
      let data;
      try {
        data = await res.json();
      } catch (_) {
        return { ok: false, status, error: 'invalid_json' };
      }
      return { ok: true, data };
    }

    const errBody = await _readErrorBody(res);
    if (status === 401) {
      return { ok: false, status: 401, error: errBody || 'http_401', is401: true };
    }

    console.log('[allianceActivityLogApi] non-2xx', status, errBody);
    return { ok: false, status, error: errBody || `http_${status}` };
  }

  try {
    let result = await attempt();
    if (result.ok) {
      return result;
    }

    if (result.is401) {
      result = await attempt();
      if (result.ok) {
        return result;
      }
      return { ok: false, status: result.status ?? 401, error: result.error };
    }

    return result;
  } catch (err) {
    console.log('[allianceActivityLogApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

function _buildAllianceActivityLogUrl({ allianceId, limit, cursor }) {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  if (cursor !== undefined) params.set('cursor', String(cursor));
  const qs = params.toString();
  return `${BACKEND_URL}/alliances/${allianceId}/activity-log${qs ? `?${qs}` : ''}`;
}

/**
 * Fetch paginated alliance activity log via GET /alliances/:id/activity-log.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.allianceId — alliance UUID
 * @param {number} [opts.limit]
 * @param {string} [opts.cursor]
 *
 * @returns {Promise<{ok: true, data: { events, nextCursor, unreadCount }} | {ok: false, status: number, error: string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function getAllianceActivityLog({ clerkGetToken, allianceId, limit, cursor }) {
  const url = _buildAllianceActivityLogUrl({ allianceId, limit, cursor });
  return _requestWith401Retry(clerkGetToken, (token) =>
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
    }),
  );
}

/**
 * Mark alliance activity log read via PATCH /alliances/:id/activity-log/read.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.allianceId — alliance UUID
 * @param {string} [opts.readUpTo] — ISO timestamp; omitted → empty body {}
 *
 * @returns {Promise<{ok: true, data: { alliance_feed_last_read_at }} | {ok: false, status: number, error: string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function markAllianceActivityLogRead({ clerkGetToken, allianceId, readUpTo }) {
  const body = {};
  if (readUpTo !== undefined) body.readUpTo = readUpTo;

  return _requestWith401Retry(clerkGetToken, (token) =>
    fetch(`${BACKEND_URL}/alliances/${allianceId}/activity-log/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify(body),
    }),
  );
}
