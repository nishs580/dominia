/**
 * lib/__tests__/leaderboardApi.test.js
 */

const fs = require('fs');
const path = require('path');

let getLeaderboard;

const TOKEN = 'test-jwt';
const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';
const clerkGetToken = jest.fn(async () => TOKEN);
const clerkGetTokenNoToken = jest.fn(async () => null);

function loadLeaderboardApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'leaderboardApi.js'), 'utf8');
  source = source
    .replace(
      /import \{ BACKEND_URL \} from '\.\/api';/,
      `const BACKEND_URL = '${BACKEND_URL}';`,
    )
    .replace(/export async function/g, 'async function');
  source += '\nreturn { getLeaderboard };';
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

function mockFetchResponse(status, body, { ok } = {}) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  global.fetch.mockResolvedValue({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    text: async () => bodyText,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  clerkGetToken.mockResolvedValue(TOKEN);
  ({ getLeaderboard } = loadLeaderboardApi());
});

describe('getLeaderboard — URL construction', () => {
  test('power/players hits /leaderboards/power/players', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({ clerkGetToken, board: 'power', subject: 'players' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/leaderboards/power/players`);
  });

  test('territory/alliances hits /leaderboards/territory/alliances', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({ clerkGetToken, board: 'territory', subject: 'alliances' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/leaderboards/territory/alliances`);
  });

  test('battles/players hits /leaderboards/battles/players', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({ clerkGetToken, board: 'battles', subject: 'players' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/leaderboards/battles/players`);
  });
});

describe('getLeaderboard — auth', () => {
  test('Authorization header includes Bearer <token>', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({ clerkGetToken, board: 'power', subject: 'players' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  test('clerkGetToken returning null -> ok:false, status:401, code:no_token', async () => {
    const result = await getLeaderboard({
      clerkGetToken: clerkGetTokenNoToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'no_token',
      context: {},
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('getLeaderboard — success', () => {
  test('200 with envelope body -> ok:true, data deep-equals envelope', async () => {
    const envelope = {
      board: 'power',
      subject: 'players',
      generated_at: '2026-06-17T12:00:00.000Z',
      entries: [
        { rank: 1, player_id: 'p-1', username: 'alpha', score: 9001 },
        { rank: 2, player_id: 'p-2', username: 'bravo', score: 8420 },
      ],
    };
    mockFetchResponse(200, envelope);

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('getLeaderboard — error discriminants', () => {
  test('401 with parseable JSON error -> returns code from body.error', async () => {
    mockFetchResponse(401, { error: 'invalid_token' });

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'invalid_token',
      context: {},
    });
  });

  test('404 invalid_board -> context preserves board field', async () => {
    mockFetchResponse(404, { error: 'invalid_board', board: 'foo' });

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'foo',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'invalid_board',
      context: { board: 'foo' },
    });
  });

  test('404 invalid_subject -> context preserves subject field', async () => {
    mockFetchResponse(404, { error: 'invalid_subject', subject: 'bar' });

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'bar',
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'invalid_subject',
      context: { subject: 'bar' },
    });
  });

  test('500 with non-JSON body -> unknown_error with context.raw', async () => {
    mockFetchResponse(500, '<html><body>Internal Server Error</body></html>');

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'unknown_error',
      context: { raw: '<html><body>Internal Server Error</body></html>' },
    });
  });

  test('200 with unparseable JSON body -> unknown_error with context.raw', async () => {
    mockFetchResponse(200, 'not-json{');

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 200,
      code: 'unknown_error',
      context: { raw: 'not-json{' },
    });
  });

  test('non-2xx body without error field -> unknown_error with raw', async () => {
    mockFetchResponse(400, { message: 'bad request' });

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'unknown_error',
      context: { raw: JSON.stringify({ message: 'bad request' }) },
    });
  });
});

describe('getLeaderboard — network behaviour', () => {
  test('fetch throws TypeError -> network_error with err.message', async () => {
    global.fetch.mockRejectedValue(new TypeError('Network request failed'));

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.code).toBe('network_error');
    expect(result.context.message).toBe('Network request failed');
  });

  test('AbortError -> network_error with "request timed out after 15s"', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    global.fetch.mockRejectedValue(abortErr);

    const result = await getLeaderboard({
      clerkGetToken,
      board: 'power',
      subject: 'players',
    });

    expect(result).toEqual({
      ok: false,
      status: 0,
      code: 'network_error',
      context: { message: 'request timed out after 15s' },
    });
  });
});

describe('getLeaderboard — headers / boundary', () => {
  test('Content-Type request header is application/json', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({ clerkGetToken, board: 'power', subject: 'players' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  test('method is GET and no body is sent on the request', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({ clerkGetToken, board: 'power', subject: 'players' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
  });

  test('snake_case board/subject values pass through to URL untouched', async () => {
    mockFetchResponse(200, { entries: [] });

    await getLeaderboard({
      clerkGetToken,
      board: 'power_weekly',
      subject: 'alliance_members',
    });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/leaderboards/power_weekly/alliance_members`);
  });
});
