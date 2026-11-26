// lib/mapFlight.js
// Camera targets for the first-claim flight (Beat 1) and the one-shot
// objective framing on the map.
//
//   flightBounds        legacy: frame the home pin and the objective together.
//   centredFlightCamera Figma mode: put the objective territory in the middle
//                       of the map, fitted to its own outline (review comment:
//                       "first territory shown should always be in the
//                       center").
//
// CommonJS (like lib/firstClaimTarget.js) so the plain-node jest suite can
// load it.

'use strict';

function outerRing(geojson) {
  if (geojson?.type === 'Polygon') return geojson.coordinates?.[0] ?? null;
  if (geojson?.type === 'MultiPolygon') return geojson.coordinates?.[0]?.[0] ?? null;
  return null;
}

// Bounding box framing the home pin and the objective territory's polygon,
// for the single flyTo of Beat 1.
function flightBounds(homeLng, homeLat, target) {
  let minLng = homeLng;
  let maxLng = homeLng;
  let minLat = homeLat;
  let maxLat = homeLat;
  const extend = (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  };
  extend(Number(target?.longitude), Number(target?.latitude));
  const ring = outerRing(target?.geojson);
  if (Array.isArray(ring)) {
    for (const vertex of ring) extend(Number(vertex?.[0]), Number(vertex?.[1]));
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

const CENTRED_ZOOM = 15;
// Equal top and bottom padding keeps the territory's centre on the map's
// centre; the larger horizontal value leaves room for the side rail.
const CENTRED_PADDING = Object.freeze({ paddingTop: 160, paddingBottom: 160, paddingLeft: 72, paddingRight: 72 });

/**
 * Camera settings that centre the objective territory.
 * With an outline: bounds of the outline alone (centred and fitted).
 * Without one: its point at zoom 15. No usable target → null.
 */
function centredFlightCamera(target) {
  if (!target) return null;
  const ring = outerRing(target.geojson);
  if (Array.isArray(ring) && ring.length > 0) {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const vertex of ring) {
      const lng = Number(vertex?.[0]);
      const lat = Number(vertex?.[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    if (Number.isFinite(minLng)) {
      return { bounds: { ne: [maxLng, maxLat], sw: [minLng, minLat] }, padding: { ...CENTRED_PADDING } };
    }
  }
  const lng = Number(target.longitude);
  const lat = Number(target.latitude);
  if (target.longitude == null || target.latitude == null) return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { centerCoordinate: [lng, lat], zoomLevel: CENTRED_ZOOM };
}

module.exports = { flightBounds, centredFlightCamera, CENTRED_ZOOM };
