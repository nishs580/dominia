/**
 * lib/__tests__/contestWalkApi.test.js
 */

const fs = require('fs');
const path = require('path');

let startContest;
let postContestSamples;

const TOKEN = 'test-jwt';
const clerkGetToken = jest.fn(async () => TOKEN);
const clerkGetTokenNoToken = jest.fn(async () => null);

function loadContestWalkApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'contestWalkApi.js'), 'utf8');
  source = source
    .replace(
      /import \{ BACKEND_URL \} from '\.\/api';/,
      "const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';",
    )
    .replace(/export async function/g, 'async function');
  source += '\nreturn { startContest, postContestSamples };';
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
  ({ startContest, postContestSamples } = loadContestWalkApi());
});

describe('startContest', () => {
  test('200 with envelope body → ok:true, data deep-equals envelope', async () => {
    const envelope = {
      contest_id: 'contest-1',
      required_walk_m: 820,
      iron_balance_after: 42,
      attacker_alliance_id: null,
    };
    mockFetchResponse(200, envelope);

    const result = await startContest({
      clerkGetToken,
      territoryId: 'territory-1',
    });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('clerkGetToken returns falsy → ok:false, status:401, code:no_token', async () => {
    const result = await startContest({
      clerkGetToken: clerkGetTokenNoToken,
      territoryId: 'territory-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'no_token',
      context: {},
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('fetch throws → ok:false, status:0, code:network_error', async () => {
    global.fetch.mockRejectedValue(new Error('socket hang up'));

    const result = await startContest({
      clerkGetToken,
      territoryId: 'territory-1',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.code).toBe('network_error');
    expect(result.context.message).toBe('socket hang up');
  });

  test('2xx with invalid JSON → ok:false, code:unknown_error, context.raw', async () => {
    mockFetchResponse(200, 'not-json{');

    const result = await startContest({
      clerkGetToken,
      territoryId: 'territory-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 200,
      code: 'unknown_error',
      context: { raw: 'not-json{' },
    });
  });

  test('non-2xx with unparseable body → ok:false, code:unknown_error', async () => {
    mockFetchResponse(500, '<<broken>>');

    const result = await startContest({
      clerkGetToken,
      territoryId: 'territory-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'unknown_error',
      context: { raw: '<<broken>>' },
    });
  });

  test('non-2xx body without error field → ok:false, code:unknown_error', async () => {
    mockFetchResponse(400, { message: 'bad request' });

    const result = await startContest({
      clerkGetToken,
      territoryId: 'territory-1',
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

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'player_not_found',
      context: {},
    });
  });

  test('territory_not_found (404, no context)', async () => {
    mockFetchResponse(404, { error: 'territory_not_found' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'territory_not_found',
      context: {},
    });
  });

  test('invalid_tier (400, context: { tier })', async () => {
    mockFetchResponse(400, { error: 'invalid_tier', tier: 'mega' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_tier',
      context: { tier: 'mega' },
    });
  });

  test('no_territory_owner (400, no context)', async () => {
    mockFetchResponse(400, { error: 'no_territory_owner' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'no_territory_owner',
      context: {},
    });
  });

  test('cannot_contest_own (400, no context)', async () => {
    mockFetchResponse(400, { error: 'cannot_contest_own' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'cannot_contest_own',
      context: {},
    });
  });

  test('territory_protected (403, context: { reason })', async () => {
    mockFetchResponse(403, { error: 'territory_protected', reason: 'alliance_protection' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: 'territory_protected',
      context: { reason: 'alliance_protection' },
    });
  });

  test('level_too_low (400, context: { current_level, required_level, tier })', async () => {
    mockFetchResponse(400, {
      error: 'level_too_low',
      current_level: 2,
      required_level: 4,
      tier: 'large',
    });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'level_too_low',
      context: { current_level: 2, required_level: 4, tier: 'large' },
    });
  });

  test('outside_contest_hours (400, context: { current_local_hour, allowed_start_hour, allowed_end_hour })', async () => {
    mockFetchResponse(400, {
      error: 'outside_contest_hours',
      current_local_hour: 23,
      allowed_start_hour: 5,
      allowed_end_hour: 22,
    });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'outside_contest_hours',
      context: {
        current_local_hour: 23,
        allowed_start_hour: 5,
        allowed_end_hour: 22,
      },
    });
  });

  test('contest_already_active (409, context: { existing_contest_id, attacker_id, attacker_username, attack_day_date, is_self_attacker })', async () => {
    mockFetchResponse(409, {
      error: 'contest_already_active',
      existing_contest_id: 'existing-1',
      attacker_id: 'player-2',
      attacker_username: 'rival',
      attack_day_date: '2026-06-12',
      is_self_attacker: false,
    });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'contest_already_active',
      context: {
        existing_contest_id: 'existing-1',
        attacker_id: 'player-2',
        attacker_username: 'rival',
        attack_day_date: '2026-06-12',
        is_self_attacker: false,
      },
    });
  });

  test('defender_not_found (500, no context)', async () => {
    mockFetchResponse(500, { error: 'defender_not_found' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'defender_not_found',
      context: {},
    });
  });

  test('no_perimeter (500, no context)', async () => {
    mockFetchResponse(500, { error: 'no_perimeter' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'no_perimeter',
      context: {},
    });
  });

  test('owner_level_unavailable (500, no context)', async () => {
    mockFetchResponse(500, { error: 'owner_level_unavailable' });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'owner_level_unavailable',
      context: {},
    });
  });

  test('insufficient_iron (402, context: { current_iron, required_iron })', async () => {
    mockFetchResponse(402, {
      error: 'insufficient_iron',
      current_iron: 5,
      required_iron: 20,
    });

    const result = await startContest({ clerkGetToken, territoryId: 't1' });

    expect(result).toEqual({
      ok: false,
      status: 402,
      code: 'insufficient_iron',
      context: { current_iron: 5, required_iron: 20 },
    });
  });
});

describe('postContestSamples', () => {
  const samples = [{
    source_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    window_start: '2026-06-12T10:00:00.000Z',
    window_end: '2026-06-12T10:00:30.000Z',
    steps: 42,
    distance_m: 31,
  }];

  test('200 with envelope body → ok:true, data deep-equals envelope', async () => {
    const envelope = {
      contest_id: 'contest-1',
      role: 'attacker',
      status: 'active',
      outcome: null,
      attacker_walked_m: 120,
      defender_walked_m: 0,
      samples_accepted: 1,
      samples_rejected: 0,
      rejections: [],
    };
    mockFetchResponse(200, envelope);

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
    });

    expect(result).toEqual({ ok: true, data: envelope });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ samples }));
  });

  test('invalid_body (400, context: { details })', async () => {
    mockFetchResponse(400, {
      error: 'invalid_body',
      details: { samples: ['Required'] },
    });

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_body',
      context: { details: { samples: ['Required'] } },
    });
  });

  test('player_not_found (404, no context)', async () => {
    mockFetchResponse(404, { error: 'player_not_found' });

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
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

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'contest_not_found',
      context: {},
    });
  });

  test('contest_not_active (409, context: { status })', async () => {
    mockFetchResponse(409, { error: 'contest_not_active', status: 'expired' });

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'contest_not_active',
      context: { status: 'expired' },
    });
  });

  test('not_a_participant (403, no context)', async () => {
    mockFetchResponse(403, { error: 'not_a_participant' });

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: 'not_a_participant',
      context: {},
    });
  });

  test('invalid_sample_timestamp (400, context: { source_id })', async () => {
    mockFetchResponse(400, {
      error: 'invalid_sample_timestamp',
      source_id: 'bad-sample-id',
    });

    const result = await postContestSamples({
      clerkGetToken,
      contestId: 'contest-1',
      samples,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_sample_timestamp',
      context: { source_id: 'bad-sample-id' },
    });
  });
});
