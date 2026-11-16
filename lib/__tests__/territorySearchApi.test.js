/**
 * lib/__tests__/territorySearchApi.test.js
 *
 * Territory search client (Figma parity plan U11 against backend U7):
 * success, empty, 404 / network errors, query handling.
 */

const fs = require('fs');
const path = require('path');

const TOKEN = 'test-jwt';
const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';
const clerkGetToken = jest.fn(async () => TOKEN);

let api;

function loadApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'territorySearchApi.js'), 'utf8');
  source = source
    .replace(/import \{ BACKEND_URL \} from '\.\/api';/, `const BACKEND_URL = '${BACKEND_URL}';`)
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function')
    .replace(/export const/g, 'const');
  source += '\nreturn { searchTerritories, normaliseSearchResults, SEARCH_MAX_LEN };';
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = jest.fn();
  clerkGetToken.mockResolvedValue(TOKEN);
  api = loadApi();
});

afterEach(() => console.log.mockRestore());

const ROW = { id: 't1', name: 'Cubbon Park', centroid: [77.59, 12.97], bbox: [77.58, 12.96, 77.6, 12.98] };

describe('searchTerritories', () => {
  test('success: hits /territories/search with the encoded query and bearer token', async () => {
    mockFetchResponse(200, { results: [ROW] });
    const res = await api.searchTerritories({ clerkGetToken, query: '  cubbon park ' });
    expect(res).toEqual({ ok: true, data: { results: [ROW] } });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/territories/search?q=cubbon%20park`);
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  test('empty: no results resolves ok with an empty list', async () => {
    mockFetchResponse(200, { results: [] });
    const res = await api.searchTerritories({ clerkGetToken, query: 'zzz' });
    expect(res).toEqual({ ok: true, data: { results: [] } });
  });

  test('blank query resolves empty without a request', async () => {
    const res = await api.searchTerritories({ clerkGetToken, query: '   ' });
    expect(res).toEqual({ ok: true, data: { results: [] } });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('query is capped at 50 characters', async () => {
    mockFetchResponse(200, { results: [] });
    await api.searchTerritories({ clerkGetToken, query: 'a'.repeat(80) });
    const [url] = global.fetch.mock.calls[0];
    expect(url.split('q=')[1]).toBe('a'.repeat(api.SEARCH_MAX_LEN));
  });

  test('malformed rows are dropped', async () => {
    mockFetchResponse(200, {
      results: [ROW, { id: 't2', name: 'No geometry' }, { name: 'No id', bbox: [0, 0, 1, 1] }, { id: 't3', name: 'Centroid only', centroid: [1, 2] }],
    });
    const res = await api.searchTerritories({ clerkGetToken, query: 'park' });
    expect(res.data.results.map((r) => r.id)).toEqual(['t1', 't3']);
    expect(res.data.results[1].bbox).toBeNull();
  });

  test('404 (endpoint not deployed) resolves to an error, not a throw', async () => {
    mockFetchResponse(404, 'Cannot GET /territories/search');
    const res = await api.searchTerritories({ clerkGetToken, query: 'park' });
    expect(res).toMatchObject({ ok: false, status: 404, code: 'not_found' });
  });

  test('structured server error is passed through', async () => {
    mockFetchResponse(400, { error: 'query_too_long', max: 50 });
    const res = await api.searchTerritories({ clerkGetToken, query: 'park' });
    expect(res).toEqual({ ok: false, status: 400, code: 'query_too_long', context: { max: 50 } });
  });

  test('network failure resolves to network_error', async () => {
    global.fetch.mockRejectedValue(new Error('Network request failed'));
    const res = await api.searchTerritories({ clerkGetToken, query: 'park' });
    expect(res).toMatchObject({ ok: false, status: 0, code: 'network_error' });
  });

  test('missing token resolves to no_token without a request', async () => {
    clerkGetToken.mockResolvedValue(null);
    const res = await api.searchTerritories({ clerkGetToken, query: 'park' });
    expect(res).toMatchObject({ ok: false, status: 401, code: 'no_token' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
