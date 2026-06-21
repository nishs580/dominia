/**
 * lib/__tests__/chatApi.test.js
 */

const fs = require('fs');
const path = require('path');

let getRooms;
let getMessages;
let patchReadState;
let getAblyToken;

const TOKEN = 'test-jwt';
const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';
const clerkGetToken = jest.fn(async () => TOKEN);
const clerkGetTokenNoToken = jest.fn(async () => null);

function loadChatApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'chatApi.js'), 'utf8');
  source = source
    .replace(
      /import \{ BACKEND_URL \} from '\.\/api';/,
      `const BACKEND_URL = '${BACKEND_URL}';`,
    )
    .replace(/export async function/g, 'async function');
  source += '\nreturn { getRooms, getMessages, patchReadState, getAblyToken };';
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
  ({ getRooms, getMessages, patchReadState, getAblyToken } = loadChatApi());
});

describe('getRooms — URL + envelope', () => {
  test('GET /chat/rooms with Bearer header', async () => {
    mockFetchResponse(200, { rooms: [] });

    await getRooms({ clerkGetToken });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/chat/rooms`);
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(options.body).toBeUndefined();
  });

  test('200 with rooms envelope -> ok:true, data passes through (snake_case preserved)', async () => {
    const envelope = {
      rooms: [
        {
          id: 'r-1',
          room_type: 'city',
          room_key: 'Amsterdam',
          display_name: 'Amsterdam',
          alliance_id: null,
          archived_at: null,
          last_message_at: '2026-06-21T12:00:00.000Z',
          unread_count: 3,
          latest_message_preview: { content: 'hi', created_at: '2026-06-21T12:00:00.000Z' },
        },
      ],
    };
    mockFetchResponse(200, envelope);

    const result = await getRooms({ clerkGetToken });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(result.data.rooms[0].room_type).toBe('city');
    expect(result.data.rooms[0].unread_count).toBe(3);
  });

  test('no token -> ok:false, status:401, code:no_token', async () => {
    const result = await getRooms({ clerkGetToken: clerkGetTokenNoToken });

    expect(result).toEqual({ ok: false, status: 401, code: 'no_token', context: {} });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('getMessages — URL + query params', () => {
  test('no cursor, no limit -> bare /chat/rooms/:id/messages', async () => {
    mockFetchResponse(200, { messages: [], next_cursor: null });

    await getMessages({ clerkGetToken, roomId: 'r-1' });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/chat/rooms/r-1/messages`);
  });

  test('beforeCursor + limit appended as query params', async () => {
    mockFetchResponse(200, { messages: [], next_cursor: null });

    await getMessages({
      clerkGetToken,
      roomId: 'r-1',
      beforeCursor: 'cursor-abc',
      limit: 25,
    });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe(
      `${BACKEND_URL}/chat/rooms/r-1/messages?before=cursor-abc&limit=25`,
    );
  });

  test('200 with messages envelope -> ok:true, snake_case preserved in data', async () => {
    const envelope = {
      messages: [
        {
          id: 'm-1',
          room_id: 'r-1',
          sender_id: 'p-1',
          sender_name: 'alice',
          sender_level: 6,
          sender_alliance_short_name: 'SNW',
          content: 'hi there',
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ],
      next_cursor: 'opaque-cursor',
    };
    mockFetchResponse(200, envelope);

    const result = await getMessages({ clerkGetToken, roomId: 'r-1' });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(result.data.messages[0].sender_name).toBe('alice');
    expect(result.data.next_cursor).toBe('opaque-cursor');
  });

  test('403 room_access_forbidden -> code + context preserved', async () => {
    mockFetchResponse(403, { error: 'room_access_forbidden', room_id: 'r-1' });

    const result = await getMessages({ clerkGetToken, roomId: 'r-1' });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: 'room_access_forbidden',
      context: { room_id: 'r-1' },
    });
  });

  test('400 invalid_limit -> code preserved', async () => {
    mockFetchResponse(400, { error: 'invalid_limit' });

    const result = await getMessages({
      clerkGetToken,
      roomId: 'r-1',
      limit: 51,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_limit',
      context: {},
    });
  });
});

describe('patchReadState — method + body', () => {
  test('PATCH /chat/rooms/:id/read-state with body shape', async () => {
    mockFetchResponse(200, { ok: true });

    const lastReadAt = '2026-06-21T12:00:00.000Z';
    await patchReadState({
      clerkGetToken,
      roomId: 'r-1',
      lastReadMessageId: 'm-1',
      lastReadAt,
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/chat/rooms/r-1/read-state`);
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({
      last_read_message_id: 'm-1',
      last_read_at: lastReadAt,
    });
  });

  test('lastReadMessageId undefined -> null on the wire', async () => {
    mockFetchResponse(200, { ok: true });

    await patchReadState({
      clerkGetToken,
      roomId: 'r-1',
      lastReadAt: '2026-06-21T12:00:00.000Z',
    });

    const [, options] = global.fetch.mock.calls[0];
    expect(JSON.parse(options.body).last_read_message_id).toBeNull();
  });
});

describe('getAblyToken — method + envelope', () => {
  test('POST /chat/ably-token with no body', async () => {
    mockFetchResponse(200, {
      token_request: { keyName: 'k1', mac: 'sig' },
      channels: ['chat:r-1'],
      ttl_seconds: 3600,
    });

    const result = await getAblyToken({ clerkGetToken });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/chat/ably-token`);
    expect(options.method).toBe('POST');
    expect(options.body).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.data.ttl_seconds).toBe(3600);
    expect(result.data.channels).toEqual(['chat:r-1']);
  });

  test('404 player_not_found preserved', async () => {
    mockFetchResponse(404, { error: 'player_not_found' });

    const result = await getAblyToken({ clerkGetToken });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'player_not_found',
      context: {},
    });
  });
});

describe('network behaviour (shared performChatRequest)', () => {
  test('fetch throws TypeError -> network_error with message', async () => {
    global.fetch.mockRejectedValue(new TypeError('Network request failed'));

    const result = await getRooms({ clerkGetToken });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.code).toBe('network_error');
    expect(result.context.message).toBe('Network request failed');
  });

  test('AbortError -> network_error with timeout message', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    global.fetch.mockRejectedValue(abortErr);

    const result = await getRooms({ clerkGetToken });

    expect(result).toEqual({
      ok: false,
      status: 0,
      code: 'network_error',
      context: { message: 'request timed out after 15s' },
    });
  });

  test('200 with unparseable JSON -> unknown_error with raw context', async () => {
    mockFetchResponse(200, 'not-json{');

    const result = await getRooms({ clerkGetToken });

    expect(result).toEqual({
      ok: false,
      status: 200,
      code: 'unknown_error',
      context: { raw: 'not-json{' },
    });
  });

  test('500 non-2xx without error field -> unknown_error with raw', async () => {
    mockFetchResponse(500, { message: 'internal' });

    const result = await getRooms({ clerkGetToken });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'unknown_error',
      context: { raw: JSON.stringify({ message: 'internal' }) },
    });
  });
});
