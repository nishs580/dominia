import { BACKEND_URL } from './api';

// Daily login reward (Figma parity plan U10 against backend U6):
//   GET  /me/daily-reward        -> { available, day, amount, ladder? }
//                                   ladder: Gold for days 1–7 (Updated UX U3)
//   POST /me/daily-reward/claim  -> { gold_awarded, day, gold_balance }
//                                   409 { error: 'already_claimed' | 'too_soon' }
//
// Same envelope as lib/territorySearchApi.js: { ok: true, data } or
// { ok: false, status, code, context }. Never throws. 404 (endpoint not
// deployed yet) and network failures resolve to ok:false so the reward screen
// can offer retry / skip and onboarding is never blocked.

const TIMEOUT_MS = 12000;

export async function getDailyReward({ clerkGetToken }) {
  const res = await request({ clerkGetToken, path: '/me/daily-reward', method: 'GET' });
  if (!res.ok) return res;
  const reward = normaliseDailyReward(res.data);
  if (!reward) return { ok: false, status: 200, code: 'bad_response', context: {} };
  return { ok: true, data: reward };
}

export async function claimDailyReward({ clerkGetToken }) {
  const res = await request({ clerkGetToken, path: '/me/daily-reward/claim', method: 'POST', body: {} });
  if (!res.ok) return res;
  const d = res.data || {};
  return {
    ok: true,
    data: {
      gold_awarded: toInt(d.gold_awarded),
      day: toInt(d.day),
      gold_balance: Number.isFinite(Number(d.gold_balance)) ? Number(d.gold_balance) : null,
    },
  };
}

/** True when a claim failure means "already collected today" (not an error to retry). */
export function isAlreadyClaimed(res) {
  return Boolean(res && !res.ok && res.status === 409);
}

export function normaliseDailyReward(data) {
  if (!data || typeof data !== 'object' || typeof data.available !== 'boolean') return null;
  const ladder =
    Array.isArray(data.ladder) && data.ladder.length > 0
      ? data.ladder.map((v) => Math.max(0, toInt(v)))
      : null;
  return {
    available: data.available,
    day: Math.max(1, toInt(data.day) || 1),
    amount: Math.max(0, toInt(data.amount)),
    ladder,
  };
}

function toInt(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : 0;
}

async function request({ clerkGetToken, path, method, body }) {
  let timeoutId;
  try {
    const token = await clerkGetToken();
    if (!token) return { ok: false, status: 401, code: 'no_token', context: {} };

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    timeoutId = undefined;

    let text = '';
    try {
      text = await res.text();
    } catch (_) {
      /* ignore */
    }
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    if (!res.ok) {
      console.log('[dailyRewardApi] non-2xx', res.status);
      const code = typeof json?.error === 'string' ? json.error : res.status === 404 ? 'not_found' : 'unknown_error';
      return { ok: false, status: res.status, code, context: json && typeof json === 'object' ? json : { raw: text } };
    }
    return { ok: true, data: json };
  } catch (err) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    console.log('[dailyRewardApi] network error', err?.message ?? err);
    return { ok: false, status: 0, code: 'network_error', context: { message: err?.message ?? String(err) } };
  }
}
