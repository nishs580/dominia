// lib/activeAttacksApi.js
//
// Client for GET /me/active-attacks (Figma parity plan U8/U12): open contests
// on territories owned by the player or the player's alliance, which the map
// shows as defend pop-ups.
//
// Follows lib/leaderboardApi.js: resolves to { ok: true, data } or
// { ok: false, status, code, context }, never throws. A 404 (endpoint not
// deployed yet), a timeout or a network error is just a failure the caller
// turns into "no pop-up".

import { BACKEND_URL } from './api';

export async function getActiveAttacks({ clerkGetToken }) {
  return performActiveAttacksRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/me/active-attacks`,
    method: 'GET',
  });
}

async function performActiveAttacksRequest({ clerkGetToken, url, method, body }) {
  const startTs = Date.now();
  console.log('[activeAttacksApi] start url=' + url);
  let timeoutId;
  try {
    const token = await clerkGetToken();
    if (!token) {
      console.log('[activeAttacksApi] no token');
      return { ok: false, status: 401, code: 'no_token', context: {} };
    }
    console.log('[activeAttacksApi] token acquired ms=' + (Date.now() - startTs));

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

    const fetchStartTs = Date.now();
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    timeoutId = undefined;
    console.log('[activeAttacksApi] fetch resolved status=' + res.status + ' ms=' + (Date.now() - fetchStartTs));

    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (_) {
      /* ignore */
    }
    if (!res.ok) {
      console.log('[activeAttacksApi] non-2xx', res.status, bodyText);
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
      console.log('[activeAttacksApi] fetch timeout after 15000ms');
      return {
        ok: false,
        status: 0,
        code: 'network_error',
        context: { message: 'request timed out after 15s' },
      };
    }
    console.log('[activeAttacksApi] network error', err?.message ?? err);
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
