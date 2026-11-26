/**
 * lib/__tests__/allianceApi.test.js
 *
 * U15: alliance list/search (GET /alliances?q=), detail normalisation
 * (GET /alliances/:id with description, rules, territories_held) and found
 * with optional rules/description and no HQ for the single-page create.
 */

const fs = require('fs');
const path = require('path');

const TOKEN = 'test-jwt';
const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';
const clerkGetToken = jest.fn(async () => TOKEN);

// lib/allianceApi.js is an ES module and jest here has no ESM transform, so
// evaluate the source with the BACKEND_URL import inlined.
function loadAllianceApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'allianceApi.js'), 'utf8');
  source = source
    .replace(/import \{ BACKEND_URL \} from '\.\/api';/, `const BACKEND_URL = '${BACKEND_URL}';`)
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function');
  source += '\nreturn { listAlliances, foundAlliance, getAllianceById, normalizeAllianceDetail, normalizeAllianceListItem, joinAlliance, listJoinRequests, acceptJoinRequest, declineJoinRequest };';
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

function mockFetch(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  global.fetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  });
}

let api;
let logSpy;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  clerkGetToken.mockResolvedValue(TOKEN);
  api = loadAllianceApi();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

const ROWS = [
  { id: 'a1', name: 'Glory Hounds', short_name: 'GLH', emblem: 'wolf', member_count: 12, territory_count: 30 },
  { id: 'a2', name: 'Jalahalli Cult', short_name: 'JNC', emblem: 'crown', member_count: 20, territory_count: 41 },
];

describe('listAlliances', () => {
  test('no query lists the caller city with no q and no city parameter', async () => {
    mockFetch(200, { alliances: ROWS });
    const res = await api.listAlliances({ clerkGetToken });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/alliances`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(res.ok).toBe(true);
    expect(res.data.alliances).toHaveLength(2);
  });

  test('search "Glory" sends q and returns the filtered rows; clearing restores the full list', async () => {
    mockFetch(200, { alliances: [ROWS[0]] });
    const searched = await api.listAlliances({ clerkGetToken, query: 'Glory' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${BACKEND_URL}/alliances?q=Glory`);
    expect(searched.data.alliances.map((a) => a.name)).toEqual(['Glory Hounds']);

    mockFetch(200, { alliances: ROWS });
    const cleared = await api.listAlliances({ clerkGetToken, query: '   ' });
    expect(global.fetch.mock.calls[1][0]).toBe(`${BACKEND_URL}/alliances`);
    expect(cleared.data.alliances).toHaveLength(2);
  });

  test('query is trimmed, URL-encoded and capped at 50 characters', async () => {
    mockFetch(200, { alliances: [] });
    await api.listAlliances({ clerkGetToken, query: '  JC & co%_  ' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${BACKEND_URL}/alliances?q=${encodeURIComponent('JC & co%_')}`);

    await api.listAlliances({ clerkGetToken, query: 'x'.repeat(200) });
    expect(global.fetch.mock.calls[1][0]).toBe(`${BACKEND_URL}/alliances?q=${'x'.repeat(50)}`);
  });

  test('rows are normalised: missing counts become 0', async () => {
    mockFetch(200, { alliances: [{ id: 'a3', name: 'New', short_name: 'NEW' }] });
    const res = await api.listAlliances({ clerkGetToken });
    expect(res.data.alliances[0]).toEqual({
      id: 'a3', name: 'New', short_name: 'NEW', emblem: null, member_count: 0, territory_count: 0,
      join_type: 'open',
    });
  });

  test('a city with no alliances returns an empty list', async () => {
    mockFetch(200, { alliances: [] });
    const res = await api.listAlliances({ clerkGetToken });
    expect(res).toEqual({ ok: true, data: { alliances: [] } });
  });

  test('a failed request returns ok:false with the status (screen shows retry)', async () => {
    mockFetch(500, 'boom');
    const res = await api.listAlliances({ clerkGetToken });
    expect(res).toEqual({ ok: false, status: 500, error: 'boom' });
  });

  test('a network error never throws', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));
    const res = await api.listAlliances({ clerkGetToken });
    expect(res).toEqual({ ok: false, status: 0, error: 'network_error' });
  });

  test('no token returns 401 without fetching', async () => {
    clerkGetToken.mockResolvedValueOnce(null);
    const res = await api.listAlliances({ clerkGetToken });
    expect(res).toEqual({ ok: false, status: 401, error: 'no_token' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('normalizeAllianceDetail', () => {
  test('defaults territories_held to 0 and ranks members by territories held', () => {
    const out = api.normalizeAllianceDetail({
      alliance: { id: 'a2', name: 'Jalahalli Cult', description: 'We walk.', rules: null },
      members: [
        { player_id: 'p1', username: 'ana', territories_held: 2 },
        { player_id: 'p2', username: 'bo' },
        { player_id: 'p3', username: 'cy', territories_held: 9 },
        { player_id: 'p4', username: 'di', territories_held: 2 },
      ],
    });
    expect(out.members.map((m) => [m.username, m.territories_held])).toEqual([
      ['cy', 9], ['ana', 2], ['di', 2], ['bo', 0],
    ]);
    expect(out.alliance.description).toBe('We walk.');
    expect(out.alliance.rules).toBe('');
  });

  test('carries the top-level has_pending_request onto the alliance (real body shape)', () => {
    const out = api.normalizeAllianceDetail({
      alliance: { id: 'a9', name: 'Invite Only', join_type: 'invite_only' },
      members: [{ player_id: 'p1', username: 'ana', territories_held: 1 }],
      has_pending_request: true,
    });
    expect(out.alliance.has_pending_request).toBe(true);
    expect(out.alliance.join_type).toBe('invite_only');
    const none = api.normalizeAllianceDetail({ alliance: { id: 'a9' }, members: [], has_pending_request: false });
    expect(none.alliance.has_pending_request).toBe(false);
  });

  test('a body without the U7 fields still normalises', () => {
    const out = api.normalizeAllianceDetail({ alliance: { id: 'x' } });
    expect(out.members).toEqual([]);
    expect(out.alliance).toEqual({ id: 'x', description: '', rules: '', join_type: 'open' });
  });
});

describe('foundAlliance', () => {
  const okBody = { alliance: { id: 'new' }, members: [] };

  test('create with Rules sends them and omits the HQ', async () => {
    mockFetch(201, okBody);
    const res = await api.foundAlliance({
      clerkGetToken, fullName: 'Glory Hounds', shortName: 'GLH', emblem: 'wolf', rules: 'Walk daily.',
    });
    expect(res.ok).toBe(true);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/alliances/found`);
    expect(JSON.parse(init.body)).toEqual({
      full_name: 'Glory Hounds', short_name: 'GLH', emblem: 'wolf', rules: 'Walk daily.',
    });
  });

  test('create without Rules succeeds and sends no rules or description keys', async () => {
    mockFetch(201, okBody);
    const res = await api.foundAlliance({ clerkGetToken, fullName: 'Glory Hounds', shortName: 'GLH' });
    expect(res.ok).toBe(true);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ full_name: 'Glory Hounds', short_name: 'GLH' });
  });

  test('3-step create (alliance_hq_create on) still sends the HQ territory', async () => {
    mockFetch(201, okBody);
    await api.foundAlliance({
      clerkGetToken, fullName: 'Glory Hounds', shortName: 'GLH', hqTerritoryId: 'terr-1', emblem: 'wolf',
    });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      full_name: 'Glory Hounds', short_name: 'GLH', hq_territory_id: 'terr-1', emblem: 'wolf',
    });
  });

  test('description is sent when provided', async () => {
    mockFetch(201, okBody);
    await api.foundAlliance({ clerkGetToken, fullName: 'Glory Hounds', shortName: 'GLH', description: 'Hi' });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).description).toBe('Hi');
  });

  test('server rejection surfaces the error body', async () => {
    mockFetch(400, { code: 'invalid_full_name' });
    const res = await api.foundAlliance({ clerkGetToken, fullName: 'G', shortName: 'GLH' });
    expect(res).toEqual({ ok: false, status: 400, error: { code: 'invalid_full_name' } });
  });
});

describe('U12: join type, join requests', () => {
  test('list rows and detail carry join_type, invite_only kept, unknown is open', () => {
    expect(api.normalizeAllianceListItem({ id: 'a', join_type: 'invite_only' }).join_type).toBe('invite_only');
    expect(api.normalizeAllianceListItem({ id: 'a', join_type: 'weird' }).join_type).toBe('open');
    expect(api.normalizeAllianceDetail({ alliance: { id: 'x', join_type: 'invite_only' } }).alliance.join_type)
      .toBe('invite_only');
  });

  test('found sends join_type when given', async () => {
    mockFetch(201, { alliance: { id: 'n' }, members: [] });
    await api.foundAlliance({ clerkGetToken, fullName: 'Glory Hounds', shortName: 'GLH', joinType: 'open' });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).join_type).toBe('open');
  });

  test('join on an invite-only alliance passes { status: requested } through', async () => {
    mockFetch(202, { status: 'requested' });
    const res = await api.joinAlliance({ clerkGetToken, allianceId: 'a1' });
    expect(res).toEqual({ ok: true, data: { status: 'requested' } });
  });

  test('listJoinRequests GETs /alliances/:id/requests', async () => {
    mockFetch(200, { requests: [{ id: 'r1' }] });
    const res = await api.listJoinRequests({ clerkGetToken, allianceId: 'a1' });
    expect(res).toEqual({ ok: true, data: { requests: [{ id: 'r1' }] } });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/alliances/a1/requests`);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  test('accept and decline POST to the request routes', async () => {
    mockFetch(200, {});
    await api.acceptJoinRequest({ clerkGetToken, allianceId: 'a1', requestId: 'r1' });
    await api.declineJoinRequest({ clerkGetToken, allianceId: 'a1', requestId: 'r2' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${BACKEND_URL}/alliances/a1/requests/r1/accept`);
    expect(global.fetch.mock.calls[0][1].method).toBe('POST');
    expect(global.fetch.mock.calls[1][0]).toBe(`${BACKEND_URL}/alliances/a1/requests/r2/decline`);
  });

  test('a 403 from accept surfaces the error body', async () => {
    mockFetch(403, { code: 'insufficient_permission' });
    const res = await api.acceptJoinRequest({ clerkGetToken, allianceId: 'a1', requestId: 'r1' });
    expect(res).toEqual({ ok: false, status: 403, error: { code: 'insufficient_permission' } });
  });
  test('passes an abort signal and maps a timeout (AbortError) to network_error', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    global.fetch.mockRejectedValue(abortErr);
    const res = await api.acceptJoinRequest({ clerkGetToken, allianceId: 'a1', requestId: 'r1' });
    expect(res).toEqual({ ok: false, status: 0, error: 'network_error' });
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
  });

  test('aborts a request still hanging after 15 s', async () => {
    jest.useFakeTimers();
    try {
      global.fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('Aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }));
      const pending = api.declineJoinRequest({ clerkGetToken, allianceId: 'a1', requestId: 'r1' });
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(15000);
      await expect(pending).resolves.toEqual({ ok: false, status: 0, error: 'network_error' });
    } finally {
      jest.useRealTimers();
    }
  });
});
