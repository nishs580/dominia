/**
 * lib/__tests__/mapFlight.test.js
 *
 * First-claim flight camera: the legacy home+objective frame and the Figma
 * centred-objective camera.
 */

const { flightBounds, centredFlightCamera, CENTRED_ZOOM } = require('../mapFlight');

const square = {
  type: 'Polygon',
  coordinates: [[[30.30, 59.90], [30.32, 59.90], [30.32, 59.92], [30.30, 59.92], [30.30, 59.90]]],
};

describe('centredFlightCamera', () => {
  test('fits the outline alone, with equal top and bottom padding', () => {
    const cam = centredFlightCamera({ longitude: 30.31, latitude: 59.91, geojson: square });
    expect(cam.bounds).toEqual({ ne: [30.32, 59.92], sw: [30.30, 59.90] });
    expect(cam.padding.paddingTop).toBe(cam.padding.paddingBottom);
    expect(cam.padding.paddingLeft).toBe(cam.padding.paddingRight);
  });

  test('uses the first polygon of a MultiPolygon', () => {
    const multi = { type: 'MultiPolygon', coordinates: [square.coordinates] };
    const cam = centredFlightCamera({ longitude: 0, latitude: 0, geojson: multi });
    expect(cam.bounds).toEqual({ ne: [30.32, 59.92], sw: [30.30, 59.90] });
  });

  test('without an outline it centres on the point at zoom 15', () => {
    expect(centredFlightCamera({ longitude: 30.31, latitude: 59.91 })).toEqual({
      centerCoordinate: [30.31, 59.91],
      zoomLevel: CENTRED_ZOOM,
    });
  });

  test('an outline with no finite vertices falls back to the point', () => {
    const broken = { type: 'Polygon', coordinates: [[['x', 'y']]] };
    expect(centredFlightCamera({ longitude: 1, latitude: 2, geojson: broken }).centerCoordinate).toEqual([1, 2]);
  });

  test('no target, or no usable point, gives null', () => {
    expect(centredFlightCamera(null)).toBeNull();
    expect(centredFlightCamera({})).toBeNull();
    expect(centredFlightCamera({ longitude: NaN, latitude: 59.9 })).toBeNull();
  });
});

describe('flightBounds (legacy frame)', () => {
  test('frames the home pin and the objective outline together', () => {
    const b = flightBounds(30.25, 59.95, { longitude: 30.31, latitude: 59.91, geojson: square });
    expect(b).toEqual({ ne: [30.32, 59.95], sw: [30.25, 59.90] });
  });

  test('ignores a target with no coordinates', () => {
    expect(flightBounds(30.25, 59.95, null)).toEqual({ ne: [30.25, 59.95], sw: [30.25, 59.95] });
  });
});
