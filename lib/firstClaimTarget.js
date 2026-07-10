// First-claim target selection (client-side fallback for the D2 rule).
//
// The primary selector is the backend (GET /territories/first-claim-objective:
// realm-wide KNN over unclaimed small/medium territories from the home pin).
// This module re-implements the same rule over the viewport features the map
// has already loaded, for the case the server reports no claimable
// small/medium target — it adds the any-tier fallback the server does not
// have, using whatever land the player can currently see.
//
// Exclusions collapse to "unclaimed": solo-protected and alliance territory
// are by definition owned, so owner == null/'Unclaimed' rules them all out.
//
// CommonJS (like lib/formulas.js) so the plain-node jest suite can load it;
// Metro interops it into screen imports transparently.

// Mirrors FREE_CLAIM_TIERS in the backend claim gate (small/medium claims are
// the free ones, and the ones the first-claim objective targets first).
const PREFERRED_TIERS = ['small', 'medium'];

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres between two lng/lat points. */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Average of a polygon's outer-ring vertices — cheap centroid, close enough
 * for nearest-territory ranking at city scale. Returns [lng, lat] or null. */
function outerRingCentre(geometry) {
  const ring =
    geometry?.type === 'Polygon'
      ? geometry.coordinates?.[0]
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates?.[0]?.[0]
        : null;
  if (!Array.isArray(ring) || ring.length === 0) return null;
  // GeoJSON rings are closed (last vertex repeats the first) — skip the
  // closing vertex so it doesn't bias the mean.
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed =
    ring.length > 1 && last?.[0] === first?.[0] && last?.[1] === first?.[1];
  const upper = closed ? ring.length - 1 : ring.length;
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (let i = 0; i < upper; i += 1) {
    const lng = Number(ring[i]?.[0]);
    const lat = Number(ring[i]?.[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    sumLng += lng;
    sumLat += lat;
    count += 1;
  }
  if (count === 0) return null;
  return [sumLng / count, sumLat / count];
}

/** Unclaimed test matching the territory sheet's own rule. */
function isUnclaimedFeature(feature) {
  const owner = feature?.properties?.owner;
  return owner == null || owner === 'Unclaimed';
}

/**
 * Nearest unclaimed territory to the home pin among the given map features.
 * Preference order: small/medium first (the free-claim tiers), then any tier.
 * Returns { feature, longitude, latitude, distance_m } or null when no
 * unclaimed territory exists in the supplied set.
 */
function selectFirstClaimTarget({ homeLat, homeLng, features }) {
  if (!Number.isFinite(homeLat) || !Number.isFinite(homeLng)) return null;
  if (!Array.isArray(features)) return null;

  let bestPreferred = null;
  let bestAny = null;

  for (const feature of features) {
    if (!feature || !isUnclaimedFeature(feature)) continue;
    const centre = outerRingCentre(feature.geometry);
    if (!centre) continue;
    const distanceM = haversineMetres(homeLat, homeLng, centre[1], centre[0]);
    const candidate = {
      feature,
      longitude: centre[0],
      latitude: centre[1],
      distance_m: Math.round(distanceM),
    };
    const tier = String(feature.properties?.tier ?? '').toLowerCase();
    if (PREFERRED_TIERS.includes(tier)) {
      if (!bestPreferred || candidate.distance_m < bestPreferred.distance_m) {
        bestPreferred = candidate;
      }
    }
    if (!bestAny || candidate.distance_m < bestAny.distance_m) {
      bestAny = candidate;
    }
  }

  return bestPreferred ?? bestAny;
}

module.exports = {
  PREFERRED_TIERS,
  haversineMetres,
  outerRingCentre,
  isUnclaimedFeature,
  selectFirstClaimTarget,
};
