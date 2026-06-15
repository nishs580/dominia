/**
 * lib/__tests__/contestDefendApi.test.js
 */

const fs = require('fs');
const path = require('path');

let getDefendPreview;
let postDefend;

const TOKEN = 'test-jwt';
const clerkGetToken = jest.fn(async () => TOKEN);
const clerkGetTokenNoToken = jest.fn(async () => null);

function loadContestDefendApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'contestDefendApi.js'), 'utf8');
  source = source
    .replace(
      /import \{ BACKEND_URL \} from '\.\/api';/,
      "const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';",
    )
    .replace(/export async function/g, 'async function');
  source += '\nreturn { getDefendPreview, postDefend };';
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
  ({ getDefendPreview, postDefend } = loadContestDefendApi());
});

describe('getDefendPreview', () => {
  test('200 with envelope body -> ok:true, data deep-equals envelope', async () => {
    const envelope = {
      contest_id: 'contest-1',
      territory_id: 'territory-1',
      territory_name: 'North Dock',
      attacker_username: 'rival',
      attacker_walked_m: 320,
      required_walk_m: 820,
      already_past_cutoff: false,
      defend_cutoff_fraction: 0.75,
      defender_player_id: null,
      defender_username: null,
      current_stone: 12,
      required_stone: 10,
      attack_day_date: '2026-06-15',
      can_spend_stone: true,
      defender_walk_required_m: 615,
      is_territory_owner: true,
    };
    mockFetchResponse(200, envelope);

    const result = await getDefendPreview({
      clerkGetToken,
      contestId: 'contest-1',
    });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('clerkGetToken returns falsy -> ok:false, status:401, code:no_token', async () => {
    const result = await getDefendPreview({
      clerkGetToken: clerkGetTokenNoToken,
      contestId: 'contest-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'no_token',
      context: {},
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('fetch throws -> ok:false, status:0, code:network_error', async () => {
    global.fetch.mockRejectedValue(new Error('socket hang up'));

    const result = await getDefendPreview({
      clerkGetToken,
      contestId: 'contest-1',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.code).toBe('network_error');
    expect(result.context.message).toBe('socket hang up');
  });

  test('2xx with invalid JSON -> ok:false, code:unknown_error, context.raw', async () => {
    mockFetchResponse(200, 'not-json{');

    const result = await getDefendPreview({
      clerkGetToken,
      contestId: 'contest-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 200,
      code: 'unknown_error',
      context: { raw: 'not-json{' },
    });
  });

  test('non-2xx with unparseable body -> ok:false, code:unknown_error', async () => {
    mockFetchResponse(500, '<<broken>>');

    const result = await getDefendPreview({
      clerkGetToken,
      contestId: 'contest-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'unknown_error',
      context: { raw: '<<broken>>' },
    });
  });

  test('non-2xx body without error field -> ok:false, code:unknown_error', async () => {
    mockFetchResponse(400, { message: 'bad request' });

    const result = await getDefendPreview({
      clerkGetToken,
      contestId: 'contest-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'unknown_error',
      context: { raw: JSON.stringify({ message: 'bad request' }) },
    });
  });

  test('player_not_found (404, no context)', async () => {
    mockFetchResponse(404, { error: 'player_not_found' });

    const result = await getDefendPreview({ clerkGetToken, contestId: 'contest-1' });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'player_not_found',
      context: {},
    });
  });

  test('contest_not_found (404, no context)', async () => {
    mockFetchResponse(404, { error: 'contest_not_found' });

    const result = await getDefendPreview({ clerkGetToken, contestId: 'contest-1' });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'contest_not_found',
      context: {},
    });
  });

  test('contest_not_active (409, context: { status: expired })', async () => {
    mockFetchResponse(409, { error: 'contest_not_active', status: 'expired' });

    const result = await getDefendPreview({ clerkGetToken, contestId: 'contest-1' });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'contest_not_active',
      context: { status: 'expired' },
    });
  });

  test('not_in_defender_alliance (403, no context)', async () => {
    mockFetchResponse(403, { error: 'not_in_defender_alliance' });

    const result = await getDefendPreview({ clerkGetToken, contestId: 'contest-1' });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: 'not_in_defender_alliance',
      context: {},
    });
  });
});

describe('postDefend', () => {
  test('200 with envelope body -> ok:true, data deep-equals envelope', async () => {
    const envelope = {
      contest_id: 'contest-1',
      defender_player_id: 'player-1',
      defender_starting_walk_m: 0,
      defender_response_ratio: 1.25,
      stone_balance_after: 12,
      required_walk_m: 615,
    };
    mockFetchResponse(200, envelope);

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ spendStone: false, defenderStartingWalkM: 0 }));
  });

  test('player_not_found (404, no context)', async () => {
    mockFetchResponse(404, { error: 'player_not_found' });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'player_not_found',
      context: {},
    });
  });

  test('contest_not_found (404, no context)', async () => {
    mockFetchResponse(404, { error: 'contest_not_found' });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'contest_not_found',
      context: {},
    });
  });

  test('contest_not_active (409, context: { status: expired })', async () => {
    mockFetchResponse(409, { error: 'contest_not_active', status: 'expired' });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'contest_not_active',
      context: { status: 'expired' },
    });
  });

  test('contest_too_advanced (409, context: { attacker_walked_m: 800, required_walk_m: 1000 })', async () => {
    mockFetchResponse(409, {
      error: 'contest_too_advanced',
      attacker_walked_m: 800,
      required_walk_m: 1000,
    });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'contest_too_advanced',
      context: { attacker_walked_m: 800, required_walk_m: 1000 },
    });
  });

  test('not_in_defender_alliance (403, no context)', async () => {
    mockFetchResponse(403, { error: 'not_in_defender_alliance' });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: 'not_in_defender_alliance',
      context: {},
    });
  });

  test('outside_defend_hours (400, no context)', async () => {
    mockFetchResponse(400, { error: 'outside_defend_hours' });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'outside_defend_hours',
      context: {},
    });
  });

  test('insufficient_stone (402, context: { current_stone: 5, required_stone: 10 })', async () => {
    mockFetchResponse(402, {
      error: 'insufficient_stone',
      current_stone: 5,
      required_stone: 10,
    });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: true,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 402,
      code: 'insufficient_stone',
      context: { current_stone: 5, required_stone: 10 },
    });
  });

  test('contest_already_defended (409, context: { defender_username: someone })', async () => {
    mockFetchResponse(409, {
      error: 'contest_already_defended',
      defender_username: 'someone',
    });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'contest_already_defended',
      context: { defender_username: 'someone' },
    });
  });

  test('invalid_body (400, context: { details: spendStone must be boolean })', async () => {
    mockFetchResponse(400, {
      error: 'invalid_body',
      details: 'spendStone must be boolean',
    });

    const result = await postDefend({
      clerkGetToken,
      contestId: 'contest-1',
      spendStone: false,
      defenderStartingWalkM: 0,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_body',
      context: { details: 'spendStone must be boolean' },
    });
  });
});
