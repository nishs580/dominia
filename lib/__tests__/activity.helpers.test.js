/**
 * lib/__tests__/activity.helpers.test.js
 */

const H = require('../activity.helpers');

const VALID_BUCKET = {
  result: { COUNT_TOTAL: 100 },
  startTime: '2024-12-01T16:00:00.000Z',
  endTime: '2024-12-01T16:01:00.000Z',
};

describe('formatHexAsUuid', () => {
  test('64-char hex input → correct 8-4-4-4-12 shape', () => {
    const hex = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
    const uuid = H.formatHexAsUuid(hex);
    expect(uuid).toBe('a1b2c3d4-e5f6-7890-1234-567890123456');
    expect(uuid.length).toBe(36);
  });

  test('exactly 32 chars → works (uses all 32)', () => {
    const hex = '0123456789abcdef0123456789abcdef';
    expect(H.formatHexAsUuid(hex)).toBe('01234567-89ab-cdef-0123-456789abcdef');
  });

  test('31 chars → throws Error', () => {
    expect(() => H.formatHexAsUuid('0123456789abcdef0123456789abcde')).toThrow(Error);
  });

  test('non-string (number) → throws TypeError', () => {
    expect(() => H.formatHexAsUuid(123)).toThrow(TypeError);
  });

  test('null → throws TypeError', () => {
    expect(() => H.formatHexAsUuid(null)).toThrow(TypeError);
  });

  test('undefined → throws TypeError', () => {
    expect(() => H.formatHexAsUuid(undefined)).toThrow(TypeError);
  });

  test('object → throws TypeError', () => {
    expect(() => H.formatHexAsUuid({})).toThrow(TypeError);
  });

  test('dashes are at positions 8, 13, 18, 23', () => {
    const uuid = H.formatHexAsUuid('0123456789abcdef0123456789abcdef');
    expect(uuid[8]).toBe('-');
    expect(uuid[13]).toBe('-');
    expect(uuid[18]).toBe('-');
    expect(uuid[23]).toBe('-');
  });
});

describe('alignToMinute', () => {
  test('exact minute boundary (60_000 multiple) → unchanged', () => {
    expect(H.alignToMinute(120_000)).toBe(120_000);
  });

  test('mid-minute floors to previous minute', () => {
    expect(H.alignToMinute(1733059230000)).toBe(1733059200000);
  });

  test('epoch 0 → returns 0', () => {
    expect(H.alignToMinute(0)).toBe(0);
  });

  test('negative ms floors (e.g. -30000 → -60000)', () => {
    expect(H.alignToMinute(-30_000)).toBe(-60_000);
  });

  test('NaN → throws TypeError', () => {
    expect(() => H.alignToMinute(NaN)).toThrow(TypeError);
  });

  test('Infinity → throws TypeError', () => {
    expect(() => H.alignToMinute(Infinity)).toThrow(TypeError);
  });

  test('string → throws TypeError', () => {
    expect(() => H.alignToMinute('1733059200000')).toThrow(TypeError);
  });
});

describe('buildSampleFromBucket', () => {
  test('valid bucket, 100 steps, stride 0.75 → distanceM=75', () => {
    const sample = H.buildSampleFromBucket(VALID_BUCKET, 'src-1', 0.75);
    expect(sample).toEqual({
      sourceId: 'src-1',
      windowStartMs: Date.parse(VALID_BUCKET.startTime),
      windowEndMs: Date.parse(VALID_BUCKET.endTime),
      steps: 100,
      distanceM: 75,
    });
  });

  test('zero-step bucket → returns null', () => {
    expect(
      H.buildSampleFromBucket({ ...VALID_BUCKET, result: { COUNT_TOTAL: 0 } }, 'src-1', 0.75),
    ).toBeNull();
  });

  test('negative COUNT_TOTAL → returns null', () => {
    expect(
      H.buildSampleFromBucket({ ...VALID_BUCKET, result: { COUNT_TOTAL: -1 } }, 'src-1', 0.75),
    ).toBeNull();
  });

  test('missing result field → returns null', () => {
    expect(H.buildSampleFromBucket({ startTime: VALID_BUCKET.startTime, endTime: VALID_BUCKET.endTime }, 'src-1', 0.75)).toBeNull();
  });

  test('empty sourceId → throws', () => {
    expect(() => H.buildSampleFromBucket(VALID_BUCKET, '', 0.75)).toThrow();
  });

  test('zero strideM → throws', () => {
    expect(() => H.buildSampleFromBucket(VALID_BUCKET, 'src-1', 0)).toThrow();
  });

  test('negative strideM → throws', () => {
    expect(() => H.buildSampleFromBucket(VALID_BUCKET, 'src-1', -0.75)).toThrow();
  });

  test('invalid startTime → throws', () => {
    expect(() =>
      H.buildSampleFromBucket(
        { ...VALID_BUCKET, startTime: 'not-a-date' },
        'src-1',
        0.75,
      ),
    ).toThrow();
  });

  test('distanceM is integer-floored (87 × 0.75 = 65)', () => {
    const sample = H.buildSampleFromBucket(
      { ...VALID_BUCKET, result: { COUNT_TOTAL: 87 } },
      'src-1',
      0.75,
    );
    expect(sample.distanceM).toBe(65);
  });
});

describe('evictOldestIfOverCap', () => {
  test('length below cap → kept original, dropped 0', () => {
    const samples = [{ id: 1 }, { id: 2 }];
    expect(H.evictOldestIfOverCap(samples, 5)).toEqual({ kept: samples, dropped: 0 });
  });

  test('length equal to cap → unchanged', () => {
    const samples = [{ id: 1 }, { id: 2 }];
    expect(H.evictOldestIfOverCap(samples, 2)).toEqual({ kept: samples, dropped: 0 });
  });

  test('length above cap → drops oldest, kept.length === cap', () => {
    const samples = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const result = H.evictOldestIfOverCap(samples, 2);
    expect(result.kept).toEqual([{ id: 3 }, { id: 4 }]);
    expect(result.dropped).toBe(2);
  });

  test('cap=0 → all dropped, kept=[]', () => {
    const samples = [{ id: 1 }];
    expect(H.evictOldestIfOverCap(samples, 0)).toEqual({ kept: [], dropped: 1 });
  });

  test('empty samples → unchanged', () => {
    expect(H.evictOldestIfOverCap([], 10)).toEqual({ kept: [], dropped: 0 });
  });

  test('non-array → throws', () => {
    expect(() => H.evictOldestIfOverCap(null, 10)).toThrow(TypeError);
  });
});

describe('shouldFlush', () => {
  const basePass = {
    bufferSize: 3,
    isConnected: true,
    flushInProgress: false,
    lastFlushAt: 1_000_000,
    now: 1_000_000,
  };

  test('flushInProgress=true overrides all → in-progress', () => {
    expect(
      H.shouldFlush({ ...basePass, flushInProgress: true }, 'periodic'),
    ).toEqual({ shouldFlush: false, reason: 'in-progress' });
  });

  test('bufferSize=0 → empty', () => {
    expect(
      H.shouldFlush({ ...basePass, bufferSize: 0 }, 'periodic'),
    ).toEqual({ shouldFlush: false, reason: 'empty' });
  });

  test('bufferSize>0 + isConnected=false → offline', () => {
    expect(
      H.shouldFlush({ ...basePass, isConnected: false }, 'periodic'),
    ).toEqual({ shouldFlush: false, reason: 'offline' });
  });

  test('foreground + lastFlushAt=null → foreground-first', () => {
    expect(
      H.shouldFlush({ ...basePass, lastFlushAt: null }, 'foreground'),
    ).toEqual({ shouldFlush: true, reason: 'foreground-first' });
  });

  test('foreground + 4min since last flush → foreground-too-recent', () => {
    expect(
      H.shouldFlush(
        { ...basePass, lastFlushAt: 1_000_000, now: 1_000_000 + 4 * 60_000 },
        'foreground',
      ),
    ).toEqual({ shouldFlush: false, reason: 'foreground-too-recent' });
  });

  test('foreground + 5min exact → foreground-inactive', () => {
    expect(
      H.shouldFlush(
        { ...basePass, lastFlushAt: 1_000_000, now: 1_000_000 + 300_000 },
        'foreground',
      ),
    ).toEqual({ shouldFlush: true, reason: 'foreground-inactive' });
  });

  test('foreground + 10min → foreground-inactive', () => {
    expect(
      H.shouldFlush(
        { ...basePass, lastFlushAt: 1_000_000, now: 1_000_000 + 10 * 60_000 },
        'foreground',
      ),
    ).toEqual({ shouldFlush: true, reason: 'foreground-inactive' });
  });

  test('trigger=periodic + base gates pass → periodic', () => {
    expect(H.shouldFlush(basePass, 'periodic')).toEqual({
      shouldFlush: true,
      reason: 'periodic',
    });
  });

  test('trigger=background → background', () => {
    expect(H.shouldFlush(basePass, 'background')).toEqual({
      shouldFlush: true,
      reason: 'background',
    });
  });

  test('trigger=network → network', () => {
    expect(H.shouldFlush(basePass, 'network')).toEqual({
      shouldFlush: true,
      reason: 'network',
    });
  });

  test('trigger=buffer-full → buffer-full', () => {
    expect(H.shouldFlush(basePass, 'buffer-full')).toEqual({
      shouldFlush: true,
      reason: 'buffer-full',
    });
  });

  test('trigger=startup-drain → startup-drain', () => {
    expect(H.shouldFlush(basePass, 'startup-drain')).toEqual({
      shouldFlush: true,
      reason: 'startup-drain',
    });
  });

  test('trigger=manual → manual', () => {
    expect(H.shouldFlush(basePass, 'manual')).toEqual({
      shouldFlush: true,
      reason: 'manual',
    });
  });
});

describe('buildPostBody', () => {
  // ms values chosen so toISOString() yields exact UTC strings (Q-H.7)
  const baseSample = {
    sourceId: 'abc',
    windowStartMs: 1733068800000, // 2024-12-01T16:00:00.000Z
    windowEndMs: 1733068860000, // 2024-12-01T16:01:00.000Z
    steps: 100,
  };

  test('distanceM=65 → wire body includes distanceM and ISO strings', () => {
    const body = H.buildPostBody([{ ...baseSample, distanceM: 65 }]);
    expect(body.samples[0]).toEqual({
      sourceId: 'abc',
      windowStart: '2024-12-01T16:00:00.000Z',
      windowEnd: '2024-12-01T16:01:00.000Z',
      steps: 100,
      distanceM: 65,
    });
  });

  test('distanceM=null → omits distanceM', () => {
    const body = H.buildPostBody([{ ...baseSample, distanceM: null }]);
    expect(body.samples[0]).not.toHaveProperty('distanceM');
  });

  test('distanceM=undefined → omits distanceM', () => {
    const body = H.buildPostBody([{ ...baseSample, distanceM: undefined }]);
    expect(body.samples[0]).not.toHaveProperty('distanceM');
  });

  test('distanceM=0 → includes distanceM=0', () => {
    const body = H.buildPostBody([{ ...baseSample, distanceM: 0 }]);
    expect(body.samples[0].distanceM).toBe(0);
  });

  test('empty array → { samples: [] }', () => {
    expect(H.buildPostBody([])).toEqual({ samples: [] });
  });

  test('150 samples → only first 100 in body', () => {
    const samples = Array.from({ length: 150 }, (_, i) => ({
      ...baseSample,
      sourceId: `s-${i}`,
    }));
    const body = H.buildPostBody(samples);
    expect(body.samples).toHaveLength(100);
    expect(body.samples[0].sourceId).toBe('s-0');
    expect(body.samples[99].sourceId).toBe('s-99');
  });

  test('ms-int → exact windowStart ISO string', () => {
    const body = H.buildPostBody([
      { ...baseSample, windowStartMs: 1733068800000 },
    ]);
    expect(body.samples[0].windowStart).toBe('2024-12-01T16:00:00.000Z');
    expect(new Date(1733068800000).toISOString()).toBe('2024-12-01T16:00:00.000Z');
  });

  test('no kcal or avgGpsSpeedMs in output even if present in input', () => {
    const body = H.buildPostBody([
      { ...baseSample, distanceM: 10, kcal: 500, avgGpsSpeedMs: 1.2 },
    ]);
    expect(body.samples[0]).not.toHaveProperty('kcal');
    expect(body.samples[0]).not.toHaveProperty('avgGpsSpeedMs');
    expect(body.samples[0].distanceM).toBe(10);
  });

  test('non-array → throws TypeError', () => {
    expect(() => H.buildPostBody(null)).toThrow(TypeError);
  });
});

describe('mergeRehydratedState', () => {
  test('stored=null + currentPlayerId=p1 → empty with playerId p1', () => {
    expect(H.mergeRehydratedState(null, 'p1')).toEqual({
      samples: [],
      lastFlushedWindowEndMs: null,
      lastFlushAt: null,
      lastFlushFailed: false,
      playerId: 'p1',
    });
  });

  test('stored=undefined → empty state', () => {
    expect(H.mergeRehydratedState(undefined, 'p1').playerId).toBe('p1');
    expect(H.mergeRehydratedState(undefined, 'p1').samples).toEqual([]);
  });

  test('stored=non-object (string) → empty state', () => {
    expect(H.mergeRehydratedState('bad', 'p1').samples).toEqual([]);
  });

  test('stored=number → empty state', () => {
    expect(H.mergeRehydratedState(42, 'p1').samples).toEqual([]);
  });

  test('stored.playerId !== currentPlayerId → empty (account switch)', () => {
    expect(
      H.mergeRehydratedState(
        { playerId: 'other', samples: [{ x: 1 }], lastFlushFailed: true },
        'p1',
      ),
    ).toEqual({
      samples: [],
      lastFlushedWindowEndMs: null,
      lastFlushAt: null,
      lastFlushFailed: false,
      playerId: 'p1',
    });
  });

  test('stored.playerId === currentPlayerId → merged', () => {
    expect(
      H.mergeRehydratedState(
        {
          playerId: 'p1',
          samples: [{ sourceId: 'a' }],
          lastFlushedWindowEndMs: 1000,
          lastFlushAt: 2000,
          lastFlushFailed: true,
        },
        'p1',
      ),
    ).toEqual({
      samples: [{ sourceId: 'a' }],
      lastFlushedWindowEndMs: 1000,
      lastFlushAt: 2000,
      lastFlushFailed: true,
      playerId: 'p1',
    });
  });

  test('non-array samples → samples becomes []', () => {
    expect(
      H.mergeRehydratedState({ playerId: 'p1', samples: 'nope' }, 'p1').samples,
    ).toEqual([]);
  });

  test('invalid lastFlushedWindowEndMs (string) → null', () => {
    expect(
      H.mergeRehydratedState(
        { playerId: 'p1', lastFlushedWindowEndMs: 'bad' },
        'p1',
      ).lastFlushedWindowEndMs,
    ).toBeNull();
  });

  test('invalid lastFlushedWindowEndMs (NaN) → null', () => {
    expect(
      H.mergeRehydratedState(
        { playerId: 'p1', lastFlushedWindowEndMs: NaN },
        'p1',
      ).lastFlushedWindowEndMs,
    ).toBeNull();
  });

  test('lastFlushFailed truthy-but-not-true → false', () => {
    expect(
      H.mergeRehydratedState({ playerId: 'p1', lastFlushFailed: 1 }, 'p1').lastFlushFailed,
    ).toBe(false);
    expect(
      H.mergeRehydratedState({ playerId: 'p1', lastFlushFailed: 'true' }, 'p1').lastFlushFailed,
    ).toBe(false);
  });

  test('empty currentPlayerId → throws', () => {
    expect(() => H.mergeRehydratedState(null, '')).toThrow();
  });
});
