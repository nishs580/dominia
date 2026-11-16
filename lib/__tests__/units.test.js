const units = require('../units');

const { formatDistance, normalizeUnit, saveUnits, getUnits, setUnits, subscribe } = units;

beforeEach(() => units._resetForTests());

describe('formatDistance', () => {
  test('plan scenarios', () => {
    expect(formatDistance(1609, 'mi')).toBe('1.0 mi');
    expect(formatDistance(1000, 'km')).toBe('1.0 km');
  });

  test('unknown or missing unit falls back to km', () => {
    expect(formatDistance(1000, 'furlongs')).toBe('1.0 km');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1000, null)).toBe('1.0 km');
    expect(normalizeUnit('MI')).toBe('km');
  });

  test('one decimal, rounding', () => {
    expect(formatDistance(0, 'km')).toBe('0.0 km');
    expect(formatDistance(2345, 'km')).toBe('2.3 km');
    expect(formatDistance(2350, 'km')).toBe('2.4 km');
    expect(formatDistance(16093.44, 'mi')).toBe('10.0 mi');
    expect(formatDistance('1500', 'km')).toBe('1.5 km');
  });

  test('no negative zero', () => {
    expect(formatDistance(-10, 'km')).toBe('0.0 km');
  });

  test('non-numeric renders an em dash', () => {
    expect(formatDistance(null, 'km')).toBe('—');
    expect(formatDistance(undefined, 'mi')).toBe('—');
    expect(formatDistance(NaN, 'km')).toBe('—');
    expect(formatDistance('', 'km')).toBe('—');
  });
});

describe('units store', () => {
  test('defaults to km and normalises writes', () => {
    expect(getUnits()).toBe('km');
    setUnits('mi');
    expect(getUnits()).toBe('mi');
    setUnits('bogus');
    expect(getUnits()).toBe('km');
  });

  test('notifies subscribers only on change', () => {
    const fn = jest.fn();
    const unsub = subscribe(fn);
    setUnits('km');
    expect(fn).not.toHaveBeenCalled();
    setUnits('mi');
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    setUnits('km');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('saveUnits', () => {
  test('applies optimistically and keeps the unit on success', async () => {
    let seenDuring;
    const patch = jest.fn(async (u) => {
      seenDuring = getUnits();
      return { ok: true };
    });
    const res = await saveUnits('mi', patch);
    expect(patch).toHaveBeenCalledWith('mi');
    expect(seenDuring).toBe('mi');
    expect(res).toEqual({ ok: true, unit: 'mi' });
    expect(getUnits()).toBe('mi');
  });

  test('reverts when the backend rejects (PATCH /me { units } not built yet)', async () => {
    const res = await saveUnits('mi', async () => ({ ok: false, status: 400 }));
    expect(res).toEqual({ ok: false, unit: 'km' });
    expect(getUnits()).toBe('km');
  });

  test('reverts when patch throws', async () => {
    const res = await saveUnits('mi', async () => { throw new Error('boom'); });
    expect(res.ok).toBe(false);
    expect(getUnits()).toBe('km');
  });

  test('no request when the unit is unchanged', async () => {
    const patch = jest.fn();
    const res = await saveUnits('km', patch);
    expect(patch).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, unit: 'km' });
  });

  test('a failed save does not clobber a newer unit', async () => {
    let rejectFirst;
    const first = saveUnits('mi', () => new Promise((r) => { rejectFirst = () => r({ ok: false }); }));
    setUnits('km'); // a later change lands before the first save fails
    setUnits('mi');
    setUnits('km');
    rejectFirst();
    await first;
    expect(getUnits()).toBe('km');
  });
});
