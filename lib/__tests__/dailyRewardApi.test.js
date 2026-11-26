/**
 * lib/__tests__/dailyRewardApi.test.js
 *
 * Daily reward client (plan U10 against backend U6): success, 409, 404 and
 * network failures all resolve without throwing.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'https://dominia-backend-production.up.railway.app';
const clerkGetToken = jest.fn(async () => 'test-jwt');

function loadApi() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'dailyRewardApi.js'), 'utf8');
  source = source
    .replace(/import \{ BACKEND_URL \} from '\.\/api';/, `const BACKEND_URL = '${BACKEND_URL}';`)
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function');
  source += '\nreturn { getDailyReward, claimDailyReward, isAlreadyClaimed, normaliseDailyReward };';
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

function respond(status, body) {
  global.fetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

let api;
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = jest.fn();
  api = loadApi();
});
afterEach(() => jest.restoreAllMocks());

test('GET returns available, day and amount', async () => {
  respond(200, { available: true, day: 3, amount: 60 });
  const res = await api.getDailyReward({ clerkGetToken });
  expect(res).toEqual({ ok: true, data: { available: true, day: 3, amount: 60, ladder: null } });
  expect(global.fetch.mock.calls[0][0]).toBe(`${BACKEND_URL}/me/daily-reward`);
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-jwt');
});

test('GET passes the 7-day ladder through', async () => {
  respond(200, { available: true, day: 2, amount: 70, ladder: [60, 70, 80, 90, 100, 120, 200] });
  const res = await api.getDailyReward({ clerkGetToken });
  expect(res.data.ladder).toEqual([60, 70, 80, 90, 100, 120, 200]);
});

test('GET with a malformed body is a failure', async () => {
  respond(200, { nope: true });
  const res = await api.getDailyReward({ clerkGetToken });
  expect(res.ok).toBe(false);
});

test('GET 404 (not deployed) resolves to not_found', async () => {
  respond(404, 'Not Found');
  const res = await api.getDailyReward({ clerkGetToken });
  expect(res).toMatchObject({ ok: false, status: 404, code: 'not_found' });
});

test('claim posts and returns gold_awarded, day and balance', async () => {
  respond(200, { gold_awarded: 60, day: 1, gold_balance: 160 });
  const res = await api.claimDailyReward({ clerkGetToken });
  expect(res).toEqual({ ok: true, data: { gold_awarded: 60, day: 1, gold_balance: 160 } });
  expect(global.fetch.mock.calls[0][0]).toBe(`${BACKEND_URL}/me/daily-reward/claim`);
  expect(global.fetch.mock.calls[0][1].method).toBe('POST');
});

test('claim 409 already_claimed is recognised', async () => {
  respond(409, { error: 'already_claimed' });
  const res = await api.claimDailyReward({ clerkGetToken });
  expect(res).toMatchObject({ ok: false, status: 409, code: 'already_claimed' });
  expect(api.isAlreadyClaimed(res)).toBe(true);
});

test('network error never throws', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));
  const res = await api.claimDailyReward({ clerkGetToken });
  expect(res).toMatchObject({ ok: false, status: 0, code: 'network_error' });
  expect(api.isAlreadyClaimed(res)).toBe(false);
});

test('no token is a 401 without a request', async () => {
  const res = await api.getDailyReward({ clerkGetToken: async () => null });
  expect(res).toMatchObject({ ok: false, status: 401 });
  expect(global.fetch).not.toHaveBeenCalled();
});
