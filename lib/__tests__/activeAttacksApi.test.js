/**
 * lib/__tests__/activeAttacksApi.test.js
 *
 * Client for GET /me/active-attacks (Figma parity plan U8/U12). Every failure
 * (404 before the endpoint ships, network, timeout, malformed body) resolves
 * to a failure envelope, never throws, and leaves the map with no pop-up.
 */

const fs = require('fs');
const path = require('path');
const { nextAttacks } = require('../defendPopup');

let getActiveAttacks;

const TOKEN = 'test-jwt';
const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';
const clerkGetToken = jest.fn(async () => TOKEN);

function loadApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'activeAttacksApi.js'), 'utf8');
  source = source
    .replace(
      /import \{ BACKEND_URL \} from '\.\/api';/,
      `const BACKEND_URL = '${BACKEND_URL}';`,
    )
    .replace(/export async function/g, 'async function');
  source += '\nreturn { getActiveAttacks };';
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

function mockFetchResponse(status, body) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  global.fetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
  });
}

const ATTACK = {
  contest_id: 'c1',
  territory_id: 't1',
  territory_name: 'Cubbon Park',
  attacker_username: 'Mr ABC',
  started_at: '2026-11-16T10:00:00Z',
  scope: 'own',
  owner_username: 'me',
  defend_window_ends_at: '2026-11-16T10:30:00Z',
  can_defend: true,
  defended_by: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = jest.fn();
  clerkGetToken.mockResolvedValue(TOKEN);
  ({ getActiveAttacks } = loadApi());
});

afterEach(() => {
  console.log.mockRestore();
});

describe('getActiveAttacks — request', () => {
  test('GETs /me/active-attacks with the bearer token', async () => {
    mockFetchResponse(200, { attacks: [] });
    await getActiveAttacks({ clerkGetToken });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/me/active-attacks`);
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(opts.body).toBeUndefined();
  });

  test('no token: no fetch, no_token failure', async () => {
    clerkGetToken.mockResolvedValueOnce(null);
    const r = await getActiveAttacks({ clerkGetToken });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, status: 401, code: 'no_token', context: {} });
  });
});

describe('getActiveAttacks — responses', () => {
  test('200 returns the attacks body', async () => {
    mockFetchResponse(200, { attacks: [ATTACK] });
    const r = await getActiveAttacks({ clerkGetToken });
    expect(r).toEqual({ ok: true, data: { attacks: [ATTACK] } });
  });

  test('404 (endpoint not deployed) is a failure, not a throw', async () => {
    mockFetchResponse(404, 'Cannot GET /me/active-attacks');
    const r = await getActiveAttacks({ clerkGetToken });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.code).toBe('unknown_error');
  });

  test('typed error body is parsed into code and context', async () => {
    mockFetchResponse(429, { error: 'rate_limited', retry_after_s: 7 });
    const r = await getActiveAttacks({ clerkGetToken });
    expect(r).toEqual({ ok: false, status: 429, code: 'rate_limited', context: { retry_after_s: 7 } });
  });

  test('malformed 200 body is unknown_error', async () => {
    mockFetchResponse(200, '<html>');
    const r = await getActiveAttacks({ clerkGetToken });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('unknown_error');
  });

  test('network error resolves to network_error', async () => {
    global.fetch.mockRejectedValue(new Error('Network request failed'));
    const r = await getActiveAttacks({ clerkGetToken });
    expect(r).toEqual({
      ok: false, status: 0, code: 'network_error', context: { message: 'Network request failed' },
    });
  });

  test('abort (timeout) resolves to network_error', async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    global.fetch.mockRejectedValue(err);
    const r = await getActiveAttacks({ clerkGetToken });
    expect(r.code).toBe('network_error');
    expect(r.context.message).toMatch(/timed out/);
  });
});

describe('nextAttacks — what the map keeps after a fetch', () => {
  const prev = [ATTACK];

  test('success replaces the list with valid entries only', () => {
    const r = nextAttacks(prev, { ok: true, data: { attacks: [ATTACK, { nope: 1 }, null] } });
    expect(r).toEqual([ATTACK]);
  });

  test('success with no attacks key is an empty list', () => {
    expect(nextAttacks(prev, { ok: true, data: {} })).toEqual([]);
  });

  test('404 clears: no pop-up', () => {
    expect(nextAttacks(prev, { ok: false, status: 404, code: 'unknown_error' })).toEqual([]);
  });

  test('network error clears: no pop-up', () => {
    expect(nextAttacks(prev, { ok: false, status: 0, code: 'network_error' })).toEqual([]);
  });

  test('429 keeps what the map already shows', () => {
    expect(nextAttacks(prev, { ok: false, status: 429, code: 'rate_limited' })).toBe(prev);
  });

  test('undefined result clears', () => {
    expect(nextAttacks(prev, undefined)).toEqual([]);
  });
});
