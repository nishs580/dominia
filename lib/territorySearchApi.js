import { BACKEND_URL } from './api';

// Territory search for the map's search bar (Figma parity plan U11, backend
// U7): GET /territories/search?q= ->
//   { results: [{ id, name, centroid: [lng, lat], bbox: [minLng, minLat, maxLng, maxLat] }] }
// Auth required. The server caps q at 50 characters; the client trims and
// caps too so a long paste never round-trips just to be rejected.
//
// Same result envelope as lib/leaderboardApi.js: { ok: true, data } or
// { ok: false, status, code, context }. 404 (endpoint not deployed yet) and
// network failures resolve to ok:false so the UI shows its retry state.

export const SEARCH_MAX_LEN = 50;

export async function searchTerritories({ clerkGetToken, query }) {
  const q = String(query ?? '').trim().slice(0, SEARCH_MAX_LEN);
  if (!q) return { ok: true, data: { results: [] } };

  const res = await performTerritorySearchRequest({
    clerkGetToken,
    url: `${BACKEND_URL}/territories/search?q=${encodeURIComponent(q)}`,
    method: 'GET',
  });
  if (!res.ok) return res;
  return { ok: true, data: { results: normaliseSearchResults(res.data) } };
}

function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

// Drops malformed rows rather than failing the whole search: a row needs an
// id, a name and either a 4-number bbox or a 2-number centroid to fly to.
export function normaliseSearchResults(data) {
  const rows = Array.isArray(data?.results) ? data.results : [];
  const out = [];
  for (const r of rows) {
    if (!r || r.id == null || typeof r.name !== 'string') continue;
    const bbox = Array.isArray(r.bbox) && r.bbox.length === 4 && r.bbox.every(isFiniteNum) ? r.bbox : null;
    const centroid = Array.isArray(r.centroid) && r.centroid.length === 2 && r.centroid.every(isFiniteNum)
      ? r.centroid
      : null;
    if (!bbox && !centroid) continue;
    out.push({ id: r.id, name: r.name, centroid, bbox });
  }
  return out;
}

async function performTerritorySearchRequest({ clerkGetToken, url, method }) {
  let timeoutId;
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, code: 'no_token', context: {} };
    }

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    timeoutId = undefined;

    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (_) {
      /* ignore */
    }
    if (!res.ok) {
      console.log('[territorySearchApi] non-2xx', res.status);
      return parseFailure(res.status, bodyText);
    }
    try {
      return { ok: true, data: JSON.parse(bodyText) };
    } catch (_) {
      return { ok: false, status: res.status, code: 'unknown_error', context: { raw: bodyText || '' } };
    }
  } catch (err) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return { ok: false, status: 0, code: 'network_error', context: { message: 'request timed out after 15s' } };
    }
    console.log('[territorySearchApi] network error', err?.message ?? err);
    return { ok: false, status: 0, code: 'network_error', context: { message: err?.message ?? String(err) } };
  }
}

function parseFailure(status, bodyText) {
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (_) {
    return { ok: false, status, code: status === 404 ? 'not_found' : 'unknown_error', context: { raw: bodyText || '' } };
  }
  if (!body || typeof body !== 'object' || typeof body.error !== 'string') {
    return { ok: false, status, code: status === 404 ? 'not_found' : 'unknown_error', context: { raw: bodyText || '' } };
  }
  const { error: code, ...context } = body;
  return { ok: false, status, code, context };
}
