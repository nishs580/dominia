/**
 * lib/__tests__/slantGeometry.test.js
 *
 * U2: polygon maths behind the slanted and cut-corner primitives.
 */

const {
  parallelogramPoints,
  cutCornerPoints,
  buttonState,
  parsePoints,
  slantInset,
} = require('../slantGeometry');

const EXPECTED_INSET = 56 * Math.tan((14 * Math.PI) / 180); // ≈ 13.96

describe('parallelogramPoints', () => {
  it('insets the top-left and bottom-right by h·tan(14°) for a 400×56 button', () => {
    const pts = parsePoints(parallelogramPoints(400, 56, 14));
    expect(pts).toHaveLength(4);
    const [tl, tr, br, bl] = pts;
    expect(tl[0]).toBeCloseTo(EXPECTED_INSET, 1);
    expect(tl[0]).toBeCloseTo(13.96, 1);
    expect(tl[1]).toBe(0);
    expect(tr).toEqual([400, 0]);
    expect(400 - br[0]).toBeCloseTo(EXPECTED_INSET, 1);
    expect(br[1]).toBe(56);
    expect(bl).toEqual([0, 56]);
  });

  it('defaults to a 14° slant', () => {
    expect(parallelogramPoints(400, 56)).toBe(parallelogramPoints(400, 56, 14));
    expect(slantInset(56)).toBeCloseTo(EXPECTED_INSET, 5);
  });

  it('keeps the slant angle constant as width changes', () => {
    const narrow = parsePoints(parallelogramPoints(120, 56));
    expect(narrow[0][0]).toBeCloseTo(EXPECTED_INSET, 1);
  });

  it('shrinks the shape by pad on every side', () => {
    const [tl, tr, br, bl] = parsePoints(parallelogramPoints(100, 40, 14, 1));
    expect(tl[1]).toBe(1);
    expect(tr).toEqual([99, 1]);
    expect(br[1]).toBe(39);
    expect(bl).toEqual([1, 39]);
  });

  it('returns an empty polygon before layout', () => {
    expect(parallelogramPoints(0, 56)).toBe('');
    expect(parallelogramPoints(400, 0)).toBe('');
    expect(parallelogramPoints(NaN, 56)).toBe('');
    expect(parallelogramPoints(400, NaN)).toBe('');
    expect(parallelogramPoints(undefined, undefined)).toBe('');
  });

  it('never emits NaN', () => {
    expect(parallelogramPoints(10, 56)).not.toMatch(/NaN/);
  });
});

describe('cutCornerPoints', () => {
  it('cuts the bottom-right corner of a 400×54 field with 5 points that close', () => {
    const str = cutCornerPoints(400, 54, 8);
    const pts = parsePoints(str);
    expect(pts).toEqual([[0, 0], [400, 0], [400, 46], [392, 54], [0, 54]]);
    expect(pts).toHaveLength(5);
    // Every edge, including the closing one (last → first), is axis-aligned
    // or the 45° cut, so the polygon closes back onto its start.
    for (let i = 0; i < pts.length; i += 1) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      const dx = Math.abs(bx - ax);
      const dy = Math.abs(by - ay);
      expect(dx === 0 || dy === 0 || dx === dy).toBe(true);
    }
    const last = pts[pts.length - 1];
    expect(last[0]).toBe(pts[0][0]); // closing edge is the vertical left side
    expect(str).not.toMatch(/NaN/);
  });

  it('supports other corners', () => {
    expect(parsePoints(cutCornerPoints(100, 50, 8, 'tl'))[0]).toEqual([8, 0]);
    expect(parsePoints(cutCornerPoints(100, 50, 8, 'tr'))[1]).toEqual([92, 0]);
  });

  it('returns an empty polygon before layout', () => {
    expect(cutCornerPoints(0, 54)).toBe('');
    expect(cutCornerPoints(NaN, 54)).toBe('');
    expect(cutCornerPoints(400, NaN)).toBe('');
  });
});

describe('buttonState', () => {
  it('blocks presses and reports busy while loading', () => {
    expect(buttonState({ loading: true })).toEqual({ pressable: false, busy: true });
  });

  it('blocks presses without busy when disabled', () => {
    expect(buttonState({ disabled: true })).toEqual({ pressable: false, busy: false });
  });

  it('is pressable by default', () => {
    expect(buttonState({})).toEqual({ pressable: true, busy: false });
    expect(buttonState()).toEqual({ pressable: true, busy: false });
  });
});
