import { BACKEND_URL } from './api';

export async function getLeaderboard({ clerkGetToken, board, subject }) {
  return performLeaderboardRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/leaderboards/${board}/${subject}`,
    method: 'GET',
  });
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
