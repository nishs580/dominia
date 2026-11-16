// lib/claimCompletion.js
// Asking the server to award a walked claim — shared by ClaimSuccessScreen
// (claim_celebration on) and ActiveClaimScreen's "Securing the claim…" state
// (claim_celebration off), so both paths flush, retry and release the sample
// producer identically.
//
// The completion request itself carries no walk data: the server verifies the
// walk from the minute samples it already holds. "Resubmitting the walk" is
// therefore: flush every sample still buffered, then POST completion for the
// same territory again. The claim sample producer is kept alive across every
// attempt (it is only stopped after a success, or by the caller when the
// player leaves), so a retry never needs the player to walk again.
//
// CJS so jest can require it without a transform. The real dependencies are
// required lazily (they are ES modules Metro transpiles) and tests inject
// fakes through `deps`.

// walk_not_verified is retryable on purpose: the walk window is still open
// and the missing distance is usually activity that has not synced yet.
const NON_RETRYABLE_CODES = Object.freeze([
  'intent_expired',
  'intent_lapsed',
  'territory_already_claimed',
  'no_token',
  'unauthorized',
]);

function completeErrorShowsRetry(code) {
  return !NON_RETRYABLE_CODES.includes(code);
}

// Auto-retry spacing for walk_not_verified. The sample producer only posts
// CLOSED, minute-aligned windows, so the distance the server is missing is
// almost always the walk's final minute — which becomes postable the moment
// the wall-clock minute ticks over. Retry #2 is therefore aimed just past the
// next minute boundary rather than at a blind interval; the tail retries
// cover Health Connect catch-up on top.
const VERIFY_MAX_RETRIES = 5;

function verifyRetryDelayMs(attempt, nowMs = Date.now()) {
  if (attempt === 0) return 2000; // catches a flush that landed mid-attempt
  if (attempt === 1) {
    const msToMinuteBoundary = 60_000 - (nowMs % 60_000);
    return msToMinuteBoundary + 2500;
  }
  const tail = [15_000, 30_000, 60_000];
  return tail[Math.min(attempt - 2, tail.length - 1)];
}

function defaultDeps() {
  /* eslint-disable global-require */
  const claimApi = require('./claimApi');
  const claimWalkSamples = require('./claimWalkSamples');
  const activityProducer = require('./activity');
  /* eslint-enable global-require */
  return {
    completeClaim: claimApi.completeClaim,
    flushClaimSamples: claimWalkSamples.flushNow,
    flushActivity: activityProducer.flushNow,
    stopClaimSamples: claimWalkSamples.stop,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

// Every sample the server has not seen yet, pushed before asking it to verify
// the walk. Both flushes are non-throwing by contract, but a claim must never
// die on a sync hiccup — belt and braces.
async function flushAllSamples(deps) {
  try { await deps.flushClaimSamples?.(); } catch (_) { /* ignore */ }
  try { await deps.flushActivity?.(); } catch (_) { /* ignore */ }
}

/**
 * Flush samples and ask the server to complete the claim.
 *
 * @param {object}   opts
 * @param {Function} opts.clerkGetToken
 * @param {string}   opts.territoryId
 * @param {number}   [opts.maxVerifyRetries=VERIFY_MAX_RETRIES]
 *        Automatic retries while the server answers walk_not_verified. Pass 0
 *        for a single attempt (a manual retry tap).
 * @param {Function} [opts.isCancelled]  Checked after every await; when it
 *        returns true the helper resolves { ok:false, code:'cancelled' }
 *        without stopping the producer.
 * @param {Function} [opts.onVerifyProgress] ({ walkedM, requiredM }) while
 *        auto-retrying, so the wait reads as progress.
 * @param {object}   [opts.deps]  Test seam (see defaultDeps).
 * @returns the claimApi result: { ok:true, data } | { ok:false, code, context, status }
 */
async function secureClaim({
  clerkGetToken,
  territoryId,
  maxVerifyRetries = VERIFY_MAX_RETRIES,
  isCancelled = () => false,
  onVerifyProgress,
  deps: injected,
}) {
  const deps = { ...(injected ? {} : defaultDeps()), ...(injected || {}) };
  const cancelled = { ok: false, code: 'cancelled', context: {}, status: 0 };
  let result;
  for (let attempt = 0; ; attempt++) {
    await flushAllSamples(deps);
    if (isCancelled()) return cancelled;
    result = await deps.completeClaim({ clerkGetToken, territoryId });
    if (isCancelled()) return cancelled;
    // Stay in the securing beat and retry on our own while the missing
    // distance is plausibly just samples in flight; every other failure (or
    // an exhausted budget) is handed back to the caller.
    if (result.ok || result.code !== 'walk_not_verified' || attempt >= maxVerifyRetries) break;
    onVerifyProgress?.({
      walkedM: result.context?.walked_m ?? null,
      requiredM: result.context?.required_m ?? null,
    });
    await deps.sleep(verifyRetryDelayMs(attempt));
    if (isCancelled()) return cancelled;
  }
  if (result.ok) deps.stopClaimSamples?.();
  return result;
}

/**
 * Player-facing message for a failed completion. `t` is i18next's; the keys
 * are ClaimSuccessScreen's existing claimSuccess.* strings.
 */
function claimCompleteErrorMessage(t, error, { freeClaim = false, goldPaid = 0 } = {}) {
  if (!error) return null;
  const { code, context } = error;
  switch (code) {
    case 'intent_expired':
      return freeClaim
        ? t('claimSuccess.errIntentExpiredFree')
        : t('claimSuccess.errIntentExpiredPaid', { gold: goldPaid });
    case 'intent_lapsed':
      return context?.gold_refunded > 0
        ? t('claimSuccess.errIntentLapsedPaid', { gold: context.gold_refunded })
        : t('claimSuccess.errIntentLapsedFree');
    case 'walk_not_verified':
      return t('claimSuccess.errWalkNotVerified', {
        walked: Math.round((context?.walked_m ?? 0) / 10) * 10,
        required: context?.required_m ?? 0,
      });
    case 'claim_not_started':
      return t('claimSuccess.errClaimNotStarted');
    case 'territory_already_claimed':
      // Losing the race refunds the fee — say so rather than leaving the
      // player to wonder where the gold went.
      return freeClaim
        ? t('claimSuccess.errAlreadyClaimedFree')
        : t('claimSuccess.errAlreadyClaimedRefunded', { gold: goldPaid });
    case 'intent_not_found':
      return t('claimSuccess.errIntentNotFound');
    case 'network_error':
      return t('claimSuccess.errNetwork');
    case 'no_token':
    case 'unauthorized':
      return t('claimSuccess.errSignIn');
    case 'player_not_found':
    case 'territory_not_found':
    case 'unknown_error':
    default:
      return t('claimSuccess.errGeneric');
  }
}

module.exports = {
  VERIFY_MAX_RETRIES,
  NON_RETRYABLE_CODES,
  completeErrorShowsRetry,
  verifyRetryDelayMs,
  secureClaim,
  claimCompleteErrorMessage,
};
