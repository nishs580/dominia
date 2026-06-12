/**
 * lib/__tests__/contestWalk.test.js
 */

const fs = require('fs');
const path = require('path');

let start;
let stop;
let enqueueSample;
let flushNow;
let onAppStateChange;
let getCumulativeDistance;
let getBufferSize;

let postContestSamples;
let Crypto;
let formatHexAsUuid;

const EXPECTED_SOURCE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function loadContestWalk(stubs) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'contestWalk.js'), 'utf8');
  source = source
    .replace(/^import\s+.*$/gm, '')
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function');
  // eslint-disable-next-line no-new-func
  return new Function(
    'postContestSamples',
    'Crypto',
    'formatHexAsUuid',
    `${source}\n;return { start, stop, enqueueSample, flushNow, onAppStateChange, getCumulativeDistance, getBufferSize };`,
  )(stubs.postContestSamples, stubs.Crypto, stubs.formatHexAsUuid);
}

function makeStubs() {
  postContestSamples = jest.fn();
  Crypto = {
    digestStringAsync: jest.fn(async () => 'aa'.repeat(32)),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  };
  formatHexAsUuid = (hex) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return { postContestSamples, Crypto, formatHexAsUuid };
}

function defaultStartOpts(overrides = {}) {
  return {
    contestId: 'c1',
    requiredWalkM: 1000,
    playerId: 'p1',
    clerkGetToken: () => Promise.resolve('tok'),
    onResolved: jest.fn(),
    onWalkError: jest.fn(),
    ...overrides,
  };
}

function sample(overrides = {}) {
  return {
    steps: 10,
    distanceM: 100,
    windowStartMs: 1_000_000,
    windowEndMs: 1_030_000,
    ...overrides,
  };
}

async function drainAsyncFlush() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  const stubs = makeStubs();
  ({
    start,
    stop,
    enqueueSample,
    flushNow,
    onAppStateChange,
    getCumulativeDistance,
    getBufferSize,
  } = loadContestWalk(stubs));
});

afterEach(() => {
  stop();
  jest.useRealTimers();
});

describe('start / stop', () => {
  test('start activates producer; enqueue before start is no-op, after start updates buffer and distance', () => {
    const onResolved = jest.fn();
    const onWalkError = jest.fn();

    enqueueSample(sample({ distanceM: 999 }));
    expect(getBufferSize()).toBe(0);
    expect(getCumulativeDistance()).toBe(0);

    start(defaultStartOpts({ onResolved, onWalkError }));
    enqueueSample(sample({ distanceM: 42 }));

    expect(getBufferSize()).toBe(1);
    expect(getCumulativeDistance()).toBe(42);
    expect(postContestSamples).not.toHaveBeenCalled();
  });

  test('stop resets producer to inactive', () => {
    start(defaultStartOpts());
    enqueueSample(sample());
    expect(getBufferSize()).toBe(1);

    stop();
    enqueueSample(sample({ distanceM: 77 }));

    expect(getBufferSize()).toBe(0);
    expect(getCumulativeDistance()).toBe(0);
  });

  test('second start while active warns and no-ops', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    start(defaultStartOpts({ contestId: 'c1' }));
    enqueueSample(sample());
    start(defaultStartOpts({ contestId: 'c2' }));

    expect(warnSpy).toHaveBeenCalledWith('[contestWalk.producer] start ignored — already active');
    expect(getBufferSize()).toBe(1);

    warnSpy.mockRestore();
  });
});

describe('enqueueSample', () => {
  test('completion flush fires exactly once when cumulative crosses threshold', async () => {
    postContestSamples.mockResolvedValue({
      ok: true,
      data: { status: 'active' },
    });

    start(defaultStartOpts({ requiredWalkM: 100 }));
    enqueueSample(sample({ distanceM: 60, windowStartMs: 1_000_000, windowEndMs: 1_030_000 }));
    enqueueSample(sample({ distanceM: 50, windowStartMs: 2_000_000, windowEndMs: 2_030_000 }));

    await drainAsyncFlush();
    expect(postContestSamples).toHaveBeenCalledTimes(1);

    enqueueSample(sample({ distanceM: 50, windowStartMs: 3_000_000, windowEndMs: 3_030_000 }));
    await drainAsyncFlush();
    expect(postContestSamples).toHaveBeenCalledTimes(1);
  });
});

describe('flushNow', () => {
  test('success status active removes snapshot; onResolved not called', async () => {
    const onResolved = jest.fn();
    postContestSamples.mockResolvedValue({
      ok: true,
      data: { status: 'active' },
    });

    start(defaultStartOpts({ onResolved }));
    enqueueSample(sample());
    await flushNow();

    expect(getBufferSize()).toBe(0);
    expect(onResolved).not.toHaveBeenCalled();
    expect(postContestSamples).toHaveBeenCalledWith({
      clerkGetToken: expect.any(Function),
      contestId: 'c1',
      samples: [
        expect.objectContaining({
          source_id: EXPECTED_SOURCE_ID,
          steps: 10,
          distance_m: 100,
        }),
      ],
    });
  });

  test('success status resolved attacker_won calls onResolved and auto-stops', async () => {
    const envelope = {
      status: 'resolved',
      outcome: 'attacker_won',
      attacker_walked_m: 1000,
    };
    const onResolved = jest.fn();
    postContestSamples.mockResolvedValue({ ok: true, data: envelope });

    start(defaultStartOpts({ onResolved }));
    enqueueSample(sample());
    await flushNow();

    expect(onResolved).toHaveBeenCalledWith(envelope);
    enqueueSample(sample({ distanceM: 1 }));
    expect(getBufferSize()).toBe(0);
    expect(getCumulativeDistance()).toBe(0);
  });

  test('walk error contest_not_found calls onWalkError and auto-stops', async () => {
    const onWalkError = jest.fn();
    postContestSamples.mockResolvedValue({
      ok: false,
      status: 404,
      code: 'contest_not_found',
      context: {},
    });

    start(defaultStartOpts({ onWalkError }));
    enqueueSample(sample());
    await flushNow();

    expect(onWalkError).toHaveBeenCalledWith('contest_not_found', {});
    enqueueSample(sample({ distanceM: 1 }));
    expect(getBufferSize()).toBe(0);
  });

  test('invalid_body drops snapshot; producer stays active', async () => {
    postContestSamples.mockResolvedValue({
      ok: false,
      status: 400,
      code: 'invalid_body',
      context: { details: { samples: ['Required'] } },
    });

    start(defaultStartOpts());
    enqueueSample(sample());
    await flushNow();

    expect(getBufferSize()).toBe(0);
    enqueueSample(sample({ distanceM: 55 }));
    expect(getBufferSize()).toBe(1);
    expect(getCumulativeDistance()).toBe(155);
  });

  test('invalid_sample_timestamp drops only matching sample; others retained; producer active', async () => {
    postContestSamples.mockResolvedValue({
      ok: false,
      status: 400,
      code: 'invalid_sample_timestamp',
      context: { source_id: EXPECTED_SOURCE_ID },
    });

    start(defaultStartOpts());
    enqueueSample(sample({ windowStartMs: 1_000_000, windowEndMs: 1_030_000 }));
    enqueueSample(sample({ windowStartMs: 2_000_000, windowEndMs: 2_030_000, distanceM: 50 }));
    await flushNow();

    expect(getBufferSize()).toBe(1);
    expect(getCumulativeDistance()).toBe(150);
    enqueueSample(sample({ distanceM: 5 }));
    expect(getBufferSize()).toBe(2);
  });

  test('network_error keeps buffer intact; producer stays active', async () => {
    postContestSamples.mockResolvedValue({
      ok: false,
      status: 0,
      code: 'network_error',
      context: { message: 'socket hang up' },
    });

    start(defaultStartOpts());
    enqueueSample(sample({ distanceM: 80 }));
    await flushNow();

    expect(getBufferSize()).toBe(1);
    expect(getCumulativeDistance()).toBe(80);
    enqueueSample(sample({ distanceM: 12 }));
    expect(getBufferSize()).toBe(2);
  });
});
