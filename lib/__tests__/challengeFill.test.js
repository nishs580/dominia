/**
 * lib/__tests__/challengeFill.test.js — plan U13 fill geometry.
 */

const { challengeFill, geometryArea, geometryBounds } = require('../challengeFill');

const SQUARE = {
  type: 'Polygon',
  coordinates: [[[30.30, 59.930], [30.32, 59.930], [30.32, 59.940], [30.30, 59.940], [30.30, 59.930]]],
};

// An L-shape: half the bbox height is not half the area.
const L_SHAPE = {
  type: 'Polygon',
  coordinates: [[[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3], [0, 0]]],
};

const area = (g) => geometryArea(g);

describe('challengeFill', () => {
  test('0% → empty', () => {
    expect(challengeFill(SQUARE, 0)).toBeNull();
  });

  test('50% → half the area, starting from the south edge', () => {
    const fill = challengeFill(SQUARE, 0.5);
    expect(fill.type).toBe('Polygon');
    expect(area(fill) / area(SQUARE)).toBeCloseTo(0.5, 6);
    const [[, minLat], [, maxLat]] = geometryBounds(fill);
    expect(minLat).toBeCloseTo(59.930, 9);
    expect(maxLat).toBeCloseTo(59.935, 6);
  });

  test('100% → full geometry', () => {
    expect(challengeFill(SQUARE, 1)).toBe(SQUARE);
  });

  test('above 100% clamps to full', () => {
    expect(challengeFill(SQUARE, 1.7)).toBe(SQUARE);
  });

  test('negative and non-finite progress → empty', () => {
    expect(challengeFill(SQUARE, -0.2)).toBeNull();
    expect(challengeFill(SQUARE, NaN)).toBeNull();
    expect(challengeFill(SQUARE, undefined)).toBeNull();
  });

  test('area-proportional on irregular shapes', () => {
    for (const f of [0.25, 0.5, 0.75]) {
      expect(area(challengeFill(L_SHAPE, f)) / area(L_SHAPE)).toBeCloseTo(f, 6);
    }
  });

  test('fill grows monotonically with progress', () => {
    let prev = 0;
    for (let f = 0.1; f < 1; f += 0.1) {
      const a = area(challengeFill(L_SHAPE, f));
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });

  test('deterministic', () => {
    expect(challengeFill(L_SHAPE, 0.42)).toEqual(challengeFill(L_SHAPE, 0.42));
  });

  test('MultiPolygon is filled across members', () => {
    const multi = {
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        [[[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]]],
      ],
    };
    const fill = challengeFill(multi, 0.5);
    expect(fill.type).toBe('MultiPolygon');
    expect(area(fill) / area(multi)).toBeCloseTo(0.5, 6);
  });

  test('invalid geometry → empty', () => {
    expect(challengeFill(null, 0.5)).toBeNull();
    expect(challengeFill({ type: 'Point', coordinates: [0, 0] }, 0.5)).toBeNull();
  });
});
