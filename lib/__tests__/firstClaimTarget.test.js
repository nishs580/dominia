const {
  PREFERRED_TIERS,
  haversineMetres,
  outerRingCentre,
  isUnclaimedFeature,
  selectFirstClaimTarget,
} = require('../firstClaimTarget');

// Small square polygon (~200m across) centred on [lng, lat].
function squareAt(lng, lat, d = 0.001) {
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - d, lat + d],
      [lng + d, lat + d],
      [lng + d, lat - d],
      [lng - d, lat - d],
      [lng - d, lat + d],
    ]],
  };
}

function feature(id, { lng, lat, tier = 'Small', owner = 'Unclaimed', name = id }) {
  return {
    type: 'Feature',
    id,
    properties: { id, name, tier, owner, perimeter: 800 },
    geometry: squareAt(lng, lat),
  };
}

// Home pin used throughout: central Saint Petersburg.
const HOME = { homeLat: 59.9343, homeLng: 30.3351 };

describe('haversineMetres', () => {
  test('zero distance for identical points', () => {
    expect(haversineMetres(59.9343, 30.3351, 59.9343, 30.3351)).toBe(0);
  });

  test('one degree of latitude is ~111km', () => {
    const d = haversineMetres(59, 30, 60, 30);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
});

describe('outerRingCentre', () => {
  test('returns the centre of a polygon ring', () => {
    const centre = outerRingCentre(squareAt(30.3, 59.9));
    expect(centre[0]).toBeCloseTo(30.3, 4);
    expect(centre[1]).toBeCloseTo(59.9, 4);
  });

  test('handles MultiPolygon via the first outer ring', () => {
    const centre = outerRingCentre({
      type: 'MultiPolygon',
      coordinates: [squareAt(30.3, 59.9).coordinates],
    });
    expect(centre[0]).toBeCloseTo(30.3, 4);
  });

  test('garbage geometry returns null, never throws', () => {
    expect(outerRingCentre(null)).toBeNull();
    expect(outerRingCentre({})).toBeNull();
    expect(outerRingCentre({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(outerRingCentre({ type: 'Point', coordinates: [30, 59] })).toBeNull();
    expect(outerRingCentre({ type: 'Polygon', coordinates: [[['x', 'y']]] })).toBeNull();
  });
});

describe('isUnclaimedFeature', () => {
  test('matches the territory sheet rule', () => {
    expect(isUnclaimedFeature(feature('a', { lng: 30, lat: 59 }))).toBe(true);
    expect(isUnclaimedFeature(feature('a', { lng: 30, lat: 59, owner: null }))).toBe(true);
    expect(isUnclaimedFeature(feature('a', { lng: 30, lat: 59, owner: 'ivan' }))).toBe(false);
  });
});

describe('selectFirstClaimTarget', () => {
  test('nearest unclaimed small/medium wins', () => {
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [
        feature('far-small', { lng: 30.40, lat: 59.9343, tier: 'Small' }),
        feature('near-medium', { lng: 30.34, lat: 59.9343, tier: 'Medium' }),
        feature('mid-small', { lng: 30.36, lat: 59.9343, tier: 'Small' }),
      ],
    });
    expect(result.feature.id).toBe('near-medium');
    expect(result.distance_m).toBeGreaterThan(0);
  });

  test('tier match is case-insensitive', () => {
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [feature('a', { lng: 30.34, lat: 59.9343, tier: 'small' })],
    });
    expect(result.feature.id).toBe('a');
  });

  test('claimed territories are excluded even when nearest', () => {
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [
        feature('owned-near', { lng: 30.336, lat: 59.9343, owner: 'ivan' }),
        feature('free-far', { lng: 30.40, lat: 59.9343 }),
      ],
    });
    expect(result.feature.id).toBe('free-far');
  });

  test('a nearer large territory loses to a farther small/medium one', () => {
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [
        feature('large-near', { lng: 30.336, lat: 59.9343, tier: 'Large' }),
        feature('small-far', { lng: 30.42, lat: 59.9343, tier: 'Small' }),
      ],
    });
    expect(result.feature.id).toBe('small-far');
  });

  test('fallback: no unclaimed small/medium → nearest unclaimed of any tier', () => {
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [
        feature('epic-far', { lng: 30.44, lat: 59.9343, tier: 'Epic' }),
        feature('large-near', { lng: 30.35, lat: 59.9343, tier: 'Large' }),
        feature('small-owned', { lng: 30.336, lat: 59.9343, tier: 'Small', owner: 'ivan' }),
      ],
    });
    expect(result.feature.id).toBe('large-near');
  });

  test('fallback: nothing unclaimed at all → null', () => {
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [
        feature('a', { lng: 30.34, lat: 59.9343, owner: 'ivan' }),
        feature('b', { lng: 30.35, lat: 59.9343, owner: 'olga' }),
      ],
    });
    expect(result).toBeNull();
  });

  test('features without usable geometry are skipped', () => {
    const broken = feature('broken', { lng: 30.336, lat: 59.9343 });
    broken.geometry = { type: 'Polygon', coordinates: [] };
    const result = selectFirstClaimTarget({
      ...HOME,
      features: [broken, feature('good', { lng: 30.36, lat: 59.9343 })],
    });
    expect(result.feature.id).toBe('good');
  });

  test('garbage input returns null, never throws', () => {
    expect(selectFirstClaimTarget({ homeLat: NaN, homeLng: 30, features: [] })).toBeNull();
    expect(selectFirstClaimTarget({ homeLat: 59, homeLng: 30, features: null })).toBeNull();
    expect(selectFirstClaimTarget({ homeLat: 59, homeLng: 30, features: [null, undefined] })).toBeNull();
  });

  test('preferred tiers mirror the backend free-claim tiers', () => {
    expect(PREFERRED_TIERS).toEqual(['small', 'medium']);
  });
});
