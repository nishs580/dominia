import { BACKEND_URL } from './api';

export async function startContest({ clerkGetToken, territoryId }) {
  return performContestRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/territories/${territoryId}/contest`,
    method: 'POST',
    body: '{}',
  });
}

export async function postContestSamples({ clerkGetToken, contestId, samples }) {
  return performContestRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/contests/${contestId}/walk`,
    method: 'POST',
    body: JSON.stringify({ samples }),
  });
}

async function performContestRequest({ clerkGetToken, url, method, body }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      console.log('[contestWalkApi] no token');
      return { ok: false, status: 401, code: 'no_token', context: {} };
    }

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    };
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    const res = await fetch(url, fetchOptions);

    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (_) {
      /* ignore */
    }

    if (!res.ok) {
      console.log('[contestWalkApi] non-2xx', res.status, bodyText);
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
    console.log('[contestWalkApi] network error', err?.message ?? err);
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
