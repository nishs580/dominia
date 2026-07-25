/**
 * lib/__tests__/claimWalkSamples.test.js
 *
 * Same source-eval harness as contestWalk.test.js: strip the imports, inject
 * stubs, exercise the module functions directly.
 */

const fs = require('fs');
const path = require('path');

let start;
let stop;
let addSteps;
let flushNow;
let getBufferedMinutes;

let postActivitySteps;
let digestInputs;

const MINUTE = 60_000;
// A fixed minute boundary well in the past keeps the arithmetic legible.
const T0 = 1_700_000_040_000; // multiple of 60_000

function loadModule(stubs) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'claimWalkSamples.js'), 'utf8');
  source = source
    .replace(/^import\s+.*$/gm, '')
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function');
  // eslint-disable-next-line no-new-func
  return new Function(
    'Crypto',
    'postActivitySteps',
    'formatHexAsUuid',
    'alignToMinute',
    `${source}\n;return { start, stop, addSteps, flushNow, getBufferedMinutes };`,
  )(stubs.Crypto, stubs.postActivitySteps, stubs.formatHexAsUuid, stubs.alignToMinute);
}

function makeStubs() {
  digestInputs = [];
  postActivitySteps = jest.fn(async () => ({ ok: true }));
  const Crypto = {
    digestStringAsync: jest.fn(async (_alg, input) => {
      digestInputs.push(input);
      return 'ab'.repeat(32);
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  };
  const formatHexAsUuid = (hex) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  const alignToMinute = (ms) => Math.floor(ms / MINUTE) * MINUTE;
  return { Crypto, postActivitySteps, formatHexAsUuid, alignToMinute };
}

function startProducer(mod, overrides = {}) {
  mod.start({
    playerId: 'p1',
    clerkGetToken: () => Promise.resolve('tok'),
    getStrideM: () => 0.8,
    ...overrides,
  });
}

// Drain the fire-and-forget flush a minute rollover triggers.
function settle() {
  return new Promise((resolve) => setImmediate(resolve)).then(
    () => new Promise((resolve) => setImmediate(resolve)),
  );
}

let mod;

beforeEach(() => {
  mod = loadModule(makeStubs());
  ({ start, stop, addSteps, flushNow, getBufferedMinutes } = mod);
});

afterEach(() => {
  stop();
});

describe('bucketing', () => {
  test('steps in the same minute accumulate into one bucket', () => {
    startProducer(mod);
    addSteps(10, T0 + 1_000);
    addSteps(5, T0 + 30_000);
    expect(getBufferedMinutes()).toBe(1);
  });

  test('a minute rollover closes the previous bucket and auto-flushes it', async () => {
    startProducer(mod);
    addSteps(10, T0 + 1_000);
    addSteps(7, T0 + MINUTE + 1_000);
    await settle();

    // The closed minute went out on its own; only the in-progress one remains.
    expect(postActivitySteps).toHaveBeenCalledTimes(1);
    const { samples } = postActivitySteps.mock.calls[0][0];
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      windowStartMs: T0,
      windowEndMs: T0 + MINUTE,
      steps: 10,
    });
    expect(getBufferedMinutes()).toBe(1);
  });

  test('ignores zero, negative, and non-finite deltas', () => {
    startProducer(mod);
    addSteps(0, T0);
    addSteps(-4, T0);
    addSteps(NaN, T0);
    expect(getBufferedMinutes()).toBe(0);
  });

  test('does nothing when not started', () => {
    addSteps(10, T0);
    expect(getBufferedMinutes()).toBe(0);
  });
});

describe('flushNow', () => {
  test('posts only closed minutes — never the one in progress', async () => {
    startProducer(mod);
    addSteps(10, T0 + 1_000);            // minute A
    addSteps(7, T0 + MINUTE + 1_000);    // minute B (in progress) — auto-flushes A
    await settle();

    // A further flush inside minute B has nothing closed to post.
    await flushNow(T0 + MINUTE + 30_000);

    expect(postActivitySteps).toHaveBeenCalledTimes(1);
    const { samples } = postActivitySteps.mock.calls[0][0];
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      windowStartMs: T0,
      windowEndMs: T0 + MINUTE,
      steps: 10,
      distanceM: 8, // floor(10 * 0.8)
    });
    // Minute B is still buffered, unsent.
    expect(getBufferedMinutes()).toBe(1);
  });

  test('closes an elapsed in-progress minute before posting', async () => {
    startProducer(mod);
    addSteps(12, T0 + 5_000);

    // The minute has fully passed by flush time — it must go out.
    await flushNow(T0 + MINUTE + 1_000);

    expect(postActivitySteps).toHaveBeenCalledTimes(1);
    const { samples } = postActivitySteps.mock.calls[0][0];
    expect(samples[0].windowStartMs).toBe(T0);
    expect(samples[0].windowEndMs).toBe(T0 + MINUTE);
    expect(getBufferedMinutes()).toBe(0);
  });

  test('source_id input matches lib/activity derivation (playerId|startMs|endMs)', async () => {
    startProducer(mod);
    addSteps(10, T0 + 1_000);
    await flushNow(T0 + MINUTE + 1_000);
    expect(digestInputs).toContain(`p1|${T0}|${T0 + MINUTE}`);
  });

  test('keeps the buffer on a retryable failure', async () => {
    postActivitySteps.mockResolvedValueOnce({ ok: false, retryable: true });
    startProducer(mod);
    addSteps(10, T0 + 1_000);
    await flushNow(T0 + MINUTE + 1_000);
    expect(getBufferedMinutes()).toBe(1);

    // Next flush retries the same minute and clears it on success.
    await flushNow(T0 + MINUTE + 5_000);
    expect(getBufferedMinutes()).toBe(0);
    expect(postActivitySteps).toHaveBeenCalledTimes(2);
  });

  test('drops the batch on a non-retryable failure', async () => {
    postActivitySteps.mockResolvedValueOnce({ ok: false, retryable: false });
    startProducer(mod);
    addSteps(10, T0 + 1_000);
    await flushNow(T0 + MINUTE + 1_000);
    expect(getBufferedMinutes()).toBe(0);
  });

  test('no-op with an empty buffer and when stopped', async () => {
    startProducer(mod);
    await flushNow(T0);
    stop();
    addSteps(10, T0);
    await flushNow(T0 + MINUTE + 1_000);
    expect(postActivitySteps).not.toHaveBeenCalled();
  });
});

describe('stop', () => {
  test('discards all state', async () => {
    startProducer(mod);
    addSteps(10, T0 + 1_000);
    stop();
    expect(getBufferedMinutes()).toBe(0);
    await flushNow(T0 + MINUTE + 1_000);
    expect(postActivitySteps).not.toHaveBeenCalled();
  });
});
