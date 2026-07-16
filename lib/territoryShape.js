// lib/territoryShape.js
// Pure helpers that turn a territory's GeoJSON geometry into a normalised SVG
// path for silhouette rendering (ClaimSuccess / ContestResult reveal marks).
// CJS like formulas.js — no React, no I/O — jest-testable via plain require().

/**
 * Shoelace area of a lng/lat ring (absolute value, degrees² — only used to
 * compare rings against each other, never as a real-world area).
 */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

function isValidRing(ring) {
  return (
    Array.isArray(ring) &&
    ring.length >= 3 &&
    ring.every(
      (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    )
  );
}

/**
 * Extract the outer ring to silhouette from a GeoJSON geometry.
 * Polygon → its outer ring. MultiPolygon → the outer ring of its largest
 * member (a territory split by a river should read as its main body).
 * Returns null for anything unusable — callers fall back to the square mark.
 */
function outerRingFromGeojson(geojson) {
  if (!geojson || typeof geojson !== 'object') return null;
  if (geojson.type === 'Polygon') {
    const ring = geojson.coordinates?.[0];
    return isValidRing(ring) ? ring : null;
  }
  if (geojson.type === 'MultiPolygon') {
    let best = null;
    let bestArea = 0;
    for (const poly of geojson.coordinates ?? []) {
      const ring = poly?.[0];
      if (!isValidRing(ring)) continue;
      const area = ringArea(ring);
      if (area > bestArea) {
        bestArea = area;
        best = ring;
      }
    }
    return best;
  }
  return null;
}

/**
 * Normalise a lng/lat ring into an SVG path inside a size×size viewBox.
 * Longitude is corrected by cos(mid-latitude) so shapes keep their real aspect
 * at high latitudes (Saint Petersburg sits at 60°N). Y is inverted (north up).
 * Returns null when the ring is degenerate (zero extent).
 */
function ringToSvgPath(ring, size = 100, pad = 4) {
  if (!isValidRing(ring) || !(size > 0)) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const midLat = (minLat + maxLat) / 2;
  const xScaleCorrection = Math.max(0.05, Math.cos((midLat * Math.PI) / 180));

  const spanX = (maxLng - minLng) * xScaleCorrection;
  const spanY = maxLat - minLat;
  const maxSpan = Math.max(spanX, spanY);
  if (!(maxSpan > 0)) return null;

  const inner = size - pad * 2;
  const scale = inner / maxSpan;
  // Centre the shape on the unused axis.
  const offsetX = pad + (inner - spanX * scale) / 2;
  const offsetY = pad + (inner - spanY * scale) / 2;

  const pts = ring.map(([lng, lat]) => {
    const x = offsetX + (lng - minLng) * xScaleCorrection * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`;
  });

  return `M${pts.join('L')}Z`;
}

/**
 * One-step convenience: geometry → path, or null when a silhouette cannot be
 * drawn and the caller should keep the legacy square mark.
 */
function territorySvgPath(geojson, size = 100, pad = 4) {
  const ring = outerRingFromGeojson(geojson);
  if (!ring) return null;
  return ringToSvgPath(ring, size, pad);
}

/**
 * Bounding-box centre of a geometry as [lng, lat] — camera target for the
 * map capture celebration. Null when the geometry is unusable.
 */
function geojsonBboxCenter(geojson) {
  const ring = outerRingFromGeojson(geojson);
  if (!ring) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

module.exports = {
  outerRingFromGeojson,
  ringToSvgPath,
  territorySvgPath,
  geojsonBboxCenter,
};
