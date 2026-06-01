import { BACKEND_URL } from './api';
import { buildPostBody } from './activity.helpers';

const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1000;

function isRetryableStatus(status) {
  return status >= 500 || status === 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _fetchOnce(token, body, attempt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_URL}/activity/steps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return { kind: 'response', res };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      console.warn(`[activity.api] POST timeout ${TIMEOUT_MS}ms attempt=${attempt}`);
      return { kind: 'timeout' };
    }
    console.warn(`[activity.api] POST network-error attempt=${attempt}`);
    return { kind: 'network', message: err?.message ?? String(err) };
  }
}

async function _readErrorBody(res) {
  try {
    return await res.text();
  } catch (_) {
    return '';
  }
}

/**
 * POST /activity/steps — never throws; discriminated union return.
 */
export async function postActivitySteps({ clerkGetToken, samples }) {
  try {
    const body = buildPostBody(samples);

    async function attempt(getTokenFn, attemptNum) {
      const token = await getTokenFn();
      if (!token) {
        console.warn('[activity.api] no token');
        return { ok: false, status: 401, error: 'no_token', retryable: false };
      }

      const outcome = await _fetchOnce(token, body, attemptNum);
      if (outcome.kind === 'timeout' || outcome.kind === 'network') {
        return {
          ok: false,
          status: 0,
          error: outcome.kind === 'network' ? (outcome.message || 'network_error') : 'timeout',
          retryable: true,
        };
      }

      const { res } = outcome;
      const status = res.status;

      if (status === 200) {
        let data;
        try {
          data = await res.json();
        } catch (_) {
          return { ok: false, status: 200, error: 'invalid_json', retryable: false };
        }
        const a = data?.acceptedCount ?? 0;
        const r = data?.rejectedCount ?? 0;
        const d = data?.duplicateCount ?? 0;
        const reasons = data?.rejections ?? [];
        const reasonsStr = Array.isArray(reasons) ? JSON.stringify(reasons) : '[]';
        console.log(
          `[activity.api] POST ok=true accepted=${a} rejected=${r} duplicate=${d} rejections=${reasonsStr}`,
        );
        return { ok: true, data };
      }

      const errBody = await _readErrorBody(res);

      if (status === 401) {
        return { ok: false, status: 401, error: errBody || 'http_401', retryable: true, is401: true };
      }

      if (status >= 400 && status < 500) {
        console.error(`[activity.api] POST hard-reject status=${status} error=${errBody}`);
        return { ok: false, status, error: errBody || `http_${status}`, retryable: false };
      }

      console.warn(`[activity.api] POST failed status=${status} attempt=${attemptNum} retryable=true`);
      return {
        ok: false,
        status,
        error: errBody || `http_${status}`,
        retryable: true,
      };
    }

    let result = await attempt(clerkGetToken, 1);

    if (result.ok) {
      return result;
    }

    if (result.is401) {
      result = await attempt(clerkGetToken, 2);
      if (result.ok) {
        return result;
      }
      return {
        ok: false,
        status: result.status,
        error: result.error,
        retryable: isRetryableStatus(result.status),
      };
    }

    if (!result.retryable) {
      return result;
    }

    await sleep(RETRY_DELAY_MS);
    result = await attempt(clerkGetToken, 2);
    if (result.ok) {
      return result;
    }

    return {
      ok: false,
      status: result.status,
      error: result.error,
      retryable: isRetryableStatus(result.status),
    };
  } catch (err) {
    console.warn('[activity.api] POST network-error attempt=1');
    return { ok: false, status: 0, error: err?.message ?? 'unknown_error', retryable: true };
  }
}
