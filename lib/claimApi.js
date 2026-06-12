import { BACKEND_URL } from './api';

export async function startClaim({ clerkGetToken, territoryId }) {
  return performClaimRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/territories/${territoryId}/claim/start`,
  });
}

export async function completeClaim({ clerkGetToken, territoryId }) {
  return performClaimRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/territories/${territoryId}/claim`,
  });
}

async function performClaimRequest({ clerkGetToken, url }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      console.log('[claimApi] no token');
      return { ok: false, status: 401, code: 'no_token', context: {} };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: '{}',
    });

    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (_) {
      /* ignore */
    }

    if (!res.ok) {
      console.log('[claimApi] non-2xx', res.status, bodyText);
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
    console.log('[claimApi] network error', err?.message ?? err);
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
