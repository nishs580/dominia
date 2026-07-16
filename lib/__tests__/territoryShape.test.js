const {
  outerRingFromGeojson,
  ringToSvgPath,
  territorySvgPath,
  geojsonBboxCenter,
} = require('../territoryShape');

// A ~1km square near Saint Petersburg (60°N) — lng span doubled because a
// degree of longitude is half a degree of latitude up there.
const SPB_SQUARE = [
  [30.30, 59.930],
  [30.32, 59.930],
  [30.32, 59.940],
  [30.30, 59.940],
  [30.30, 59.930],
];

describe('outerRingFromGeojson', () => {
  test('Polygon → outer ring', () => {
    const g = { type: 'Polygon', coordinates: [SPB_SQUARE, [[0, 0], [1, 0], [0, 1]]] };
    expect(outerRingFromGeojson(g)).toBe(SPB_SQUARE);
  });

  test('MultiPolygon → outer ring of the largest member', () => {
    const small = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]];
    const g = { type: 'MultiPolygon', coordinates: [[small], [SPB_SQUARE]] };
    expect(outerRingFromGeojson(g)).toBe(SPB_SQUARE);
  });

  test('rejects junk', () => {
    expect(outerRingFromGeojson(null)).toBeNull();
    expect(outerRingFromGeojson({})).toBeNull();
    expect(outerRingFromGeojson({ type: 'Point', coordinates: [1, 2] })).toBeNull();
    expect(outerRingFromGeojson({ type: 'Polygon', coordinates: [[[1, 2], [3, 4]]] })).toBeNull();
    expect(outerRingFromGeojson({ type: 'Polygon', coordinates: [[[1, NaN], [3, 4], [5, 6]]] })).toBeNull();
  });
});

describe('ringToSvgPath', () => {
  test('produces a closed path within the padded viewBox', () => {
    const d = ringToSvgPath(SPB_SQUARE, 100, 4);
    expect(d).toMatch(/^M/);
    expect(d).toMatch(/Z$/);
    const coords = d
      .slice(1, -1)
      .split('L')
      .map((pair) => pair.split(' ').map(Number));
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(x).toBeLessThanOrEqual(96);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y).toBeLessThanOrEqual(96);
    }
  });

  test('cos-latitude correction keeps a real-world square roughly square', () => {
    const d = ringToSvgPath(SPB_SQUARE, 100, 4);
    const coords = d
      .slice(1, -1)
      .split('L')
      .map((pair) => pair.split(' ').map(Number));
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    // 0.02° lng at 59.935°N ≈ 1.114 km; 0.01° lat ≈ 1.112 km → near 1:1
    expect(spanX / spanY).toBeGreaterThan(0.9);
    expect(spanX / spanY).toBeLessThan(1.1);
  });

  test('north is up: higher latitude maps to smaller y', () => {
    const d = ringToSvgPath(SPB_SQUARE, 100, 4);
    const coords = d
      .slice(1, -1)
      .split('L')
      .map((pair) => pair.split(' ').map(Number));
    // First point is the south-west corner, third is the north-east corner.
    expect(coords[2][1]).toBeLessThan(coords[0][1]);
  });

  test('degenerate ring (zero extent) → null', () => {
    expect(ringToSvgPath([[1, 1], [1, 1], [1, 1]], 100, 4)).toBeNull();
  });
});

describe('geojsonBboxCenter', () => {
  test('returns the bbox midpoint as [lng, lat]', () => {
    const g = { type: 'Polygon', coordinates: [SPB_SQUARE] };
    const centre = geojsonBboxCenter(g);
    expect(centre[0]).toBeCloseTo(30.31, 10);
    expect(centre[1]).toBeCloseTo(59.935, 10);
  });

  test('unusable geometry → null', () => {
    expect(geojsonBboxCenter(null)).toBeNull();
    expect(geojsonBboxCenter({ type: 'Point', coordinates: [1, 2] })).toBeNull();
  });
});

describe('territorySvgPath', () => {
  test('geometry in, path out', () => {
    const g = { type: 'Polygon', coordinates: [SPB_SQUARE] };
    expect(territorySvgPath(g, 100, 4)).toMatch(/^M.*Z$/);
  });

  test('unusable geometry → null (caller falls back to square mark)', () => {
    expect(territorySvgPath(undefined)).toBeNull();
  });
});
