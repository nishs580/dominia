/**
 * lib/__tests__/claimCompletion.test.js — shared claim completion (plan U13).
 */

const {
  secureClaim,
  completeErrorShowsRetry,
  verifyRetryDelayMs,
  claimCompleteErrorMessage,
} = require('../claimCompletion');

function makeDeps(results) {
  const queue = [...results];
  const calls = [];
  const deps = {
    calls,
    completeClaim: jest.fn(async (payload) => {
      calls.push(payload);
      return queue.shift();
    }),
    flushClaimSamples: jest.fn(async () => {}),
    flushActivity: jest.fn(async () => {}),
    stopClaimSamples: jest.fn(),
    sleep: jest.fn(async () => {}),
  };
  return deps;
}

const getToken = () => 'tok';
const OK = { ok: true, data: { already_completed: false } };
const NET = { ok: false, status: 0, code: 'network_error', context: {} };
const NOT_VERIFIED = { ok: false, status: 409, code: 'walk_not_verified', context: { walked_m: 400, required_m: 500 } };

describe('secureClaim', () => {
  test('success flushes samples, completes once, releases the producer', async () => {
    const deps = makeDeps([OK]);
    const r = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', deps });
    expect(r).toBe(OK);
    expect(deps.flushClaimSamples).toHaveBeenCalledTimes(1);
    expect(deps.flushActivity).toHaveBeenCalledTimes(1);
    expect(deps.completeClaim).toHaveBeenCalledTimes(1);
    expect(deps.stopClaimSamples).toHaveBeenCalledTimes(1);
  });

  test('failure keeps the producer alive; retry resubmits the same walk and succeeds', async () => {
    const deps = makeDeps([NET, OK]);
    const first = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', deps });
    expect(first.ok).toBe(false);
    expect(first.code).toBe('network_error');
    expect(deps.stopClaimSamples).not.toHaveBeenCalled();

    const second = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', maxVerifyRetries: 0, deps });
    expect(second.ok).toBe(true);
    expect(deps.calls).toHaveLength(2);
    expect(deps.calls[1]).toEqual(deps.calls[0]);
    expect(deps.calls[1].territoryId).toBe('t1');
    expect(deps.calls[1].clerkGetToken).toBe(getToken);
    // Buffered samples flushed before each attempt, producer stopped only after success.
    expect(deps.flushClaimSamples).toHaveBeenCalledTimes(2);
    expect(deps.stopClaimSamples).toHaveBeenCalledTimes(1);
  });

  test('walk_not_verified auto-retries with progress, then succeeds', async () => {
    const deps = makeDeps([NOT_VERIFIED, OK]);
    const onVerifyProgress = jest.fn();
    const r = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', onVerifyProgress, deps });
    expect(r.ok).toBe(true);
    expect(deps.completeClaim).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
    expect(onVerifyProgress).toHaveBeenCalledWith({ walkedM: 400, requiredM: 500 });
  });

  test('walk_not_verified gives up after the retry budget', async () => {
    const deps = makeDeps([NOT_VERIFIED, NOT_VERIFIED, NOT_VERIFIED]);
    const r = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', maxVerifyRetries: 2, deps });
    expect(r.code).toBe('walk_not_verified');
    expect(deps.completeClaim).toHaveBeenCalledTimes(3);
    expect(deps.stopClaimSamples).not.toHaveBeenCalled();
  });

  test('manual retry (maxVerifyRetries 0) makes a single request', async () => {
    const deps = makeDeps([NOT_VERIFIED, OK]);
    const r = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', maxVerifyRetries: 0, deps });
    expect(r.code).toBe('walk_not_verified');
    expect(deps.completeClaim).toHaveBeenCalledTimes(1);
  });

  test('cancellation returns without stopping the producer', async () => {
    const deps = makeDeps([OK]);
    let cancelled = false;
    deps.completeClaim.mockImplementation(async () => { cancelled = true; return OK; });
    const r = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', isCancelled: () => cancelled, deps });
    expect(r.code).toBe('cancelled');
    expect(deps.stopClaimSamples).not.toHaveBeenCalled();
  });

  test('a throwing flush never blocks completion', async () => {
    const deps = makeDeps([OK]);
    deps.flushClaimSamples.mockRejectedValue(new Error('boom'));
    const r = await secureClaim({ clerkGetToken: getToken, territoryId: 't1', deps });
    expect(r.ok).toBe(true);
  });
});

describe('helpers', () => {
  test('retryability', () => {
    expect(completeErrorShowsRetry('network_error')).toBe(true);
    expect(completeErrorShowsRetry('walk_not_verified')).toBe(true);
    expect(completeErrorShowsRetry('territory_already_claimed')).toBe(false);
    expect(completeErrorShowsRetry('intent_expired')).toBe(false);
  });

  test('retry delay aims past the minute boundary on attempt 1', () => {
    expect(verifyRetryDelayMs(0)).toBe(2000);
    expect(verifyRetryDelayMs(1, 30_000)).toBe(32_500);
    expect(verifyRetryDelayMs(9)).toBe(60_000);
  });

  test('error copy keys', () => {
    const t = (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k);
    expect(claimCompleteErrorMessage(t, null)).toBeNull();
    expect(claimCompleteErrorMessage(t, { code: 'network_error' })).toBe('claimSuccess.errNetwork');
    expect(claimCompleteErrorMessage(t, { code: 'territory_already_claimed' }, { goldPaid: 25 }))
      .toBe('claimSuccess.errAlreadyClaimedRefunded:{"gold":25}');
    expect(claimCompleteErrorMessage(t, { code: 'whatever' })).toBe('claimSuccess.errGeneric');
  });
});
