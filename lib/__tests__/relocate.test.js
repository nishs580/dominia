/**
 * lib/__tests__/relocate.test.js
 *
 * Relocate sheet model (Updated UX C9/C10, plan U8).
 */

const { relocateModel, relocateTarget, withClaimedAt, formatKm } = require('../relocate');
const { centredFlightCamera } = require('../mapFlight');

const NOW = Date.parse('2026-11-27T12:00:00Z');
// Bangalore-ish home pin, [lng, lat].
const HOME = [77.5946, 12.9716];

const near = { id: 'a', territory_name: 'Cubbon Park', latitude: 12.9763, longitude: 77.5929, claimed_at: '2026-11-26T10:00:00Z' };
const mid = { id: 'b', territory_name: 'Domlur Layout', latitude: 12.9610, longitude: 77.6387, claimed_at: '2026-11-24T10:00:00Z' };
const far = { id: 'c', territory_name: 'Indiranagar 100ft Rd', latitude: 12.9784, longitude: 77.6408 + 0.05, claimed_at: '2026-11-21T10:00:00Z' };

describe('relocateModel', () => {
  test('three territories are sorted nearest first', () => {
    const m = relocateModel({ territories: [far, near, mid], homePin: HOME, now: NOW });
    expect(m.empty).toBe(false);
    expect(m.rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(m.rows[0].distanceM).toBeLessThan(m.rows[1].distanceM);
    expect(m.rows[1].distanceM).toBeLessThan(m.rows[2].distanceM);
    expect(m.rows[0].name).toBe('Cubbon Park');
  });

  test('held days come from claimed_at', () => {
    const m = relocateModel({ territories: [near, mid, far], homePin: HOME, now: NOW });
    expect(m.rows.map((r) => r.heldDays)).toEqual([1, 3, 6]);
  });

  test('distance is formatted in km with one decimal', () => {
    const m = relocateModel({ territories: [mid], homePin: HOME, now: NOW });
    expect(m.rows[0].distanceKm).toMatch(/^\d+\.\d$/);
    expect(formatKm(2140)).toBe('2.1');
    expect(formatKm(null)).toBeNull();
  });

  test('no home pin: rows have no distance and sort by name', () => {
    const m = relocateModel({ territories: [mid, near], homePin: null, now: NOW });
    expect(m.rows.every((r) => r.distanceM === null && r.distanceKm === null)).toBe(true);
    expect(m.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('unknown claim time: heldDays is null', () => {
    const m = relocateModel({ territories: [{ ...near, claimed_at: undefined }], homePin: HOME, now: NOW });
    expect(m.rows[0].heldDays).toBeNull();
  });

  test('an empty list gives the empty state', () => {
    expect(relocateModel({ territories: [], homePin: HOME })).toEqual({ empty: true, rows: [] });
    expect(relocateModel({}).empty).toBe(true);
  });

  test('rows without coordinates and duplicates are dropped', () => {
    const m = relocateModel({ territories: [near, { ...near }, { id: 'x', latitude: null, longitude: 1 }], homePin: HOME });
    expect(m.rows).toHaveLength(1);
  });
});

describe('relocate helpers', () => {
  test('withClaimedAt merges the open history row', () => {
    const merged = withClaimedAt(
      [{ id: 't1', latitude: 1, longitude: 2 }, { id: 't2', latitude: 1, longitude: 2 }],
      [{ territory_id: 't1', claimed_at: '2026-11-20T00:00:00Z' }],
    );
    expect(merged[0].claimed_at).toBe('2026-11-20T00:00:00Z');
    expect(merged[1].claimed_at).toBeUndefined();
  });

  test('GO target feeds centredFlightCamera', () => {
    const m = relocateModel({ territories: [near], homePin: HOME });
    const cam = centredFlightCamera(relocateTarget(m.rows[0]));
    expect(cam).toEqual({ centerCoordinate: [near.longitude, near.latitude], zoomLevel: 15 });
    expect(relocateTarget(null)).toBeNull();
  });
});
