// lib/challengeFill.js
// Fill geometry for the challenge map: how much of the territory is painted
// for a given walk progress.
//
// APPROACH — a horizontal waterline rising from the territory's south edge.
//   The polygon is clipped to the half-plane south of a horizontal line
//   (latitude <= cut). The cut is placed by bisection so the clipped AREA is
//   the progress fraction of the territory's area: 50% walked paints half the
//   ground, not half the bounding box (which, for an irregular parcel, could be
//   almost none or almost all of it). Clipping a ring against a half-plane is
//   Sutherland–Hodgman with one edge, applied to every ring (outer and holes)
//   of every member polygon.
//
//   Deterministic: the same geometry and fraction always give the same shape.
//   Areas are planar in degrees²; a territory spans a few hundred metres, over
//   which cos(latitude) is effectively constant, so degree-space ratios equal
//   ground ratios to well under a percent.
//
// CONTRACT
//   challengeFill(geometry, fraction) ->
//     null                      fraction <= 0, non-finite, or invalid geometry
//     the input geometry        fraction >= 1 (clamped)
//     Polygon | MultiPolygon    otherwise
//
// CJS, no React, no I/O — jest-testable via plain require().

const BISECT_ITERATIONS = 40;

function isPoint(p) {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

function isRing(ring) {
  return Array.isArray(ring) && ring.length >= 3 && ring.every(isPoint);
}

// Normalise to an array of polygons, each an array of rings.
function polygonsOf(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  let polys;
  if (geometry.type === 'Polygon') polys = [geometry.coordinates];
  else if (geometry.type === 'MultiPolygon') polys = geometry.coordinates;
  else if (geometry.type === 'Feature') return polygonsOf(geometry.geometry);
  else return null;
  if (!Array.isArray(polys)) return null;
  const valid = polys.filter((rings) => Array.isArray(rings) && isRing(rings[0]));
  return valid.length > 0 ? valid.map((rings) => rings.filter(isRing)) : null;
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

function polygonArea(rings) {
  if (rings.length === 0) return 0;
  let area = ringArea(rings[0]);
  for (let i = 1; i < rings.length; i++) area -= ringArea(rings[i]);
  return Math.max(0, area);
}

function totalArea(polys) {
  return polys.reduce((sum, rings) => sum + polygonArea(rings), 0);
}

// Open ring (no repeated closing point).
function openRing(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring.slice();
}

// Sutherland–Hodgman against the half-plane lat <= cut. Returns a closed ring,
// or null when fewer than three vertices survive.
function clipRingBelow(ring, cut) {
  const pts = openRing(ring);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i + pts.length - 1) % pts.length];
    const curIn = cur[1] <= cut;
    const prevIn = prev[1] <= cut;
    if (curIn !== prevIn) {
      const t = (cut - prev[1]) / (cur[1] - prev[1]);
      out.push([prev[0] + t * (cur[0] - prev[0]), cut]);
    }
    if (curIn) out.push([cur[0], cur[1]]);
  }
  if (out.length < 3) return null;
  out.push([out[0][0], out[0][1]]);
  return out;
}

function clipPolygonsBelow(polys, cut) {
  const result = [];
  for (const rings of polys) {
    const outer = clipRingBelow(rings[0], cut);
    if (!outer) continue;
    const holes = [];
    for (let i = 1; i < rings.length; i++) {
      const hole = clipRingBelow(rings[i], cut);
      if (hole) holes.push(hole);
    }
    result.push([outer, ...holes]);
  }
  return result;
}

function latBounds(polys) {
  let min = Infinity;
  let max = -Infinity;
  for (const rings of polys) {
    for (const [, lat] of rings[0]) {
      if (lat < min) min = lat;
      if (lat > max) max = lat;
    }
  }
  return [min, max];
}

function clampFraction(fraction) {
  const f = Number(fraction);
  if (!Number.isFinite(f) || f <= 0) return 0;
  return f >= 1 ? 1 : f;
}

/**
 * Fill geometry for `fraction` of the walk (see file header).
 */
function challengeFill(geometry, fraction) {
  const f = clampFraction(fraction);
  if (f === 0) return null;
  const polys = polygonsOf(geometry);
  if (!polys) return null;
  if (f === 1) return geometry.type === 'Feature' ? geometry.geometry : geometry;

  const target = totalArea(polys) * f;
  const [minLat, maxLat] = latBounds(polys);
  if (!(maxLat > minLat) || target <= 0) return null;

  let lo = minLat;
  let hi = maxLat;
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (totalArea(clipPolygonsBelow(polys, mid)) < target) lo = mid;
    else hi = mid;
  }
  const clipped = clipPolygonsBelow(polys, hi);
  if (clipped.length === 0) return null;
  return clipped.length === 1
    ? { type: 'Polygon', coordinates: clipped[0] }
    : { type: 'MultiPolygon', coordinates: clipped };
}

/** Planar area of a Polygon/MultiPolygon in degrees² (exported for tests). */
function geometryArea(geometry) {
  const polys = polygonsOf(geometry);
  return polys ? totalArea(polys) : 0;
}

/** [[minLng, minLat], [maxLng, maxLat]] of the geometry's outer rings, or null. */
function geometryBounds(geometry) {
  const polys = polygonsOf(geometry);
  if (!polys) return null;
  let minLng = Infinity; let minLat = Infinity;
  let maxLng = -Infinity; let maxLat = -Infinity;
  for (const rings of polys) {
    for (const [lng, lat] of rings[0]) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

module.exports = { challengeFill, geometryArea, geometryBounds, clampFraction };
