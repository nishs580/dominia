import { BACKEND_URL } from './api';

// `q` is an optional name search (plan U12/U13). It is trimmed, sent only when
// non-empty and capped at 32 code points (the server's limit) without
// splitting a surrogate pair. The screen always
// filters the returned rows by name too (lib/leaderboardView
// filterRowsByName), so a backend that ignores `q` still shows matches.
export function leaderboardUrl({ board, subject, q } = {}) {
  const base = `${BACKEND_URL}/leaderboards/${board}/${subject}`;
  const query = typeof q === 'string' ? Array.from(q.trim()).slice(0, 32).join('') : '';
  return query ? `${base}?q=${encodeURIComponent(query)}` : base;
}

// True when a search request should be retried without `q`: the server
// answered 400, which an older backend does for the unknown param, or the
// newer one does for an over-long query (already capped client-side).
export function shouldRetryWithoutQuery(result, q) {
  const hasQuery = typeof q === 'string' && q.trim() !== '';
  return hasQuery && !!result && result.ok === false && result.status === 400;
}

export async function getLeaderboard({ clerkGetToken, board, subject, q }) {
  return performLeaderboardRequest({
    clerkGetToken,
    url: leaderboardUrl({ board, subject, q }),
    method: 'GET',
  });
}

// Boards: power | territory | battles today; `distance` (weekly metres walked)
// once backend U7 ships. Subjects: players | alliances.
//
// Normalises a successful envelope to { rows, self }. `self` is the caller's
// own standing ({ rank, value, ... }) and is null when the server omits it
// (pre-U7 backend), sends null (no value on this board), or sends something
// without a positive integer rank. Rows that are not objects are dropped.
export function parseLeaderboard(data) {
  const rawRows = data && Array.isArray(data.rows) ? data.rows : [];
  const rows = rawRows.filter((r) => r != null && typeof r === 'object');
  let self = null;
  const s = data ? data.self : null;
  if (s != null && typeof s === 'object' && !Array.isArray(s)) {
    const rank = typeof s.rank === 'string' && s.rank.trim() !== '' ? Number(s.rank) : s.rank;
    if (Number.isInteger(rank) && rank > 0) {
      self = { ...s, rank };
    }
  }
  return { rows, self };
}

async function performLeaderboardRequest({ clerkGetToken, url, method, body }) {
  const startTs = Date.now();
  console.log('[leaderboardApi] start url=' + url);
  let timeoutId;
  try {
    const token = await clerkGetToken();
    if (!token) {
      console.log('[leaderboardApi] no token');
      return { ok: false, status: 401, code: 'no_token', context: {} };
    }
    console.log('[leaderboardApi] token acquired ms=' + (Date.now() - startTs));

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000);

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      signal: controller.signal,
    };
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    console.log('[leaderboardApi] fetch start');
    const fetchStartTs = Date.now();
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    timeoutId = undefined;
    console.log('[leaderboardApi] fetch resolved status=' + res.status + ' ms=' + (Date.now() - fetchStartTs));

    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (_) {
      /* ignore */
    }
    if (!res.ok) {
      console.log('[leaderboardApi] non-2xx', res.status, bodyText);
      return parseFailure(res.status, bodyText);
    }
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (_) {
      return {
        ok: false,
        status: res.status,
        code: 'unknown_error',
        context: { raw: bodyText || '' },
      };
    }
    return { ok: true, data };
  } catch (err) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      console.log('[leaderboardApi] fetch timeout after 15000ms');
      return {
        ok: false,
        status: 0,
        code: 'network_error',
        context: { message: 'request timed out after 15s' },
      };
    }
    console.log('[leaderboardApi] network error', err?.message ?? err);
    return {
      ok: false,
      status: 0,
      code: 'network_error',
      context: { message: err?.message ?? String(err) },
    };
  }
}

function parseFailure(status, bodyText) {
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (_) {
    return { ok: false, status, code: 'unknown_error', context: { raw: bodyText || '' } };
  }

  if (!body || typeof body !== 'object' || typeof body.error !== 'string') {
    return { ok: false, status, code: 'unknown_error', context: { raw: bodyText || '' } };
  }

  const { error: code, ...context } = body;
  return { ok: false, status, code, context };
}
