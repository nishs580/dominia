/**
 * fetch-spb-envelope.js
 *
 * OSM relation 1861646: the outer carriageway of the Saint Petersburg Ring Road
 * (КАД, А-118). Used as the city play envelope for territory seeding.
 *
 * Queries Overpass for Saint Petersburg KAD ring road (A-118),
 * stitches all relation way members into a single closed polygon ring,
 * and writes `spb_envelope.geojson`.
 *
 * Usage:
 *   node fetch-spb-envelope.js
 *
 * Notes:
 *   - Pure Node — no deps. Uses built-in `fetch` (Node 18+).
 *   - Overpass headers match `fetch-spb-candidates.js`.
 */
/* eslint-disable no-console */

const fs = require('fs');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const OVERPASS_QUERY = `
[out:json][timeout:180];
relation(1861646);
out geom;
`.trim();

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function perimeterMeters(ring) {
  let p = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    p += haversineMeters(ring[i].lat, ring[i].lon, ring[i + 1].lat, ring[i + 1].lon);
  }
  return p;
}

function keyOfPoint(p) {
  // Round to 1e-6 deg to avoid float noise while still matching endpoints tightly.
  // 1e-6 deg lat ≈ 0.11m.
  return `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
}

function pointsEqualKey(a, b) {
  return keyOfPoint(a) === keyOfPoint(b);
}

function closeRingIfNeeded(ring) {
  if (ring.length === 0) return ring;
  if (!pointsEqualKey(ring[0], ring[ring.length - 1])) {
    ring.push({ lat: ring[0].lat, lon: ring[0].lon });
  }
  return ring;
}

function stitchWaysIntoRing(ways) {
  // Each way: [{lat,lon}, ...]
  const unused = ways
    .filter((w) => Array.isArray(w) && w.length >= 2)
    .map((w) => w.map((p) => ({ lat: p.lat, lon: p.lon })));

  if (unused.length === 0) {
    return { ring: [], stitchedWays: 0, leftoverWays: 0, breaks: 0 };
  }

  const ring = unused.shift();
  let stitchedWays = 1;
  let breaks = 0;

  while (unused.length > 0) {
    const end = ring[ring.length - 1];
    const endKey = keyOfPoint(end);

    let foundIdx = -1;
    let reverse = false;

    for (let i = 0; i < unused.length; i++) {
      const w = unused[i];
      const s = w[0];
      const e = w[w.length - 1];
      if (keyOfPoint(s) === endKey) { foundIdx = i; reverse = false; break; }
      if (keyOfPoint(e) === endKey) { foundIdx = i; reverse = true; break; }
    }

    if (foundIdx === -1) {
      breaks++;
      break;
    }

    const next = unused.splice(foundIdx, 1)[0];
    if (reverse) next.reverse();

    // Avoid duplicating the shared endpoint.
    for (let i = 1; i < next.length; i++) ring.push(next[i]);
    stitchedWays++;
  }

  return { ring, stitchedWays, leftoverWays: unused.length, breaks };
}

async function main() {
  console.log('[overpass] querying A-118 (KAD) in Saint Petersburg area...');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'dominia-territory-seeder/1.0',
    },
    body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
  });

  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const elements = Array.isArray(data.elements) ? data.elements : [];

  const relations = elements.filter((e) => e?.type === 'relation' && Array.isArray(e.members));
  if (relations.length === 0) {
    throw new Error('No relation returned for A-118 in the SPB area (check Overpass query).');
  }

  // Prefer route_master if present; otherwise take the first relation.
  const rel = relations.find((r) => r.tags?.type === 'route_master') || relations[0];

  const wayById = new Map(
    elements
      .filter((e) => e?.type === 'way' && typeof e.id === 'number' && Array.isArray(e.geometry))
      .map((w) => [w.id, w])
  );

  const memberWays = (rel.members || [])
    .filter((m) => m?.type === 'way')
    .map((m) => {
      if (Array.isArray(m.geometry) && m.geometry.length >= 2) return m.geometry;
      const w = wayById.get(m.ref);
      return Array.isArray(w?.geometry) ? w.geometry : null;
    })
    .filter(Boolean);

  const wayCount = memberWays.length;
  console.log(`[overpass] way members fetched: ${wayCount}`);
  if (wayCount === 0) {
    throw new Error('Relation has zero way members with geometry.');
  }

  const { ring, stitchedWays, leftoverWays, breaks } = stitchWaysIntoRing(memberWays);
  const stitchedPoints = ring.length;

  if (breaks > 0 || leftoverWays > 0) {
    console.warn(`[stitch] warning: stitchedWays=${stitchedWays} leftoverWays=${leftoverWays} breaks=${breaks}`);
  } else {
    console.log(`[stitch] stitchedWays=${stitchedWays} (all members stitched)`);
  }

  if (ring.length < 3) {
    throw new Error(`Stitched ring too short (${ring.length} points).`);
  }

  const closureDistM = haversineMeters(ring[0].lat, ring[0].lon, ring[ring.length - 1].lat, ring[ring.length - 1].lon);
  const closedCleanly = closureDistM <= 10;

  if (!closedCleanly) {
    console.warn(`[closure] warning: ring endpoints are ${closureDistM.toFixed(2)}m apart (expected <= 10m). Will still write a closed GeoJSON ring.`);
  }

  closeRingIfNeeded(ring);

  const perimeterKm = perimeterMeters(ring) / 1000;
  console.log(`[stats] points=${ring.length} perimeter=${perimeterKm.toFixed(2)}km closed_cleanly=${closedCleanly}`);

  const coordinates = ring.map((p) => [p.lon, p.lat]); // GeoJSON [lng, lat]

  const feature = {
    type: 'Feature',
    properties: {
      name: rel.tags?.name || 'Saint Petersburg KAD (A-118)',
      ref: 'A-118',
      relation_id: rel.id,
      relation_type: rel.tags?.type || null,
      way_members: wayCount,
      stitched_ways: stitchedWays,
      stitched_points: ring.length,
      perimeter_km: Number(perimeterKm.toFixed(3)),
      closed_cleanly: closedCleanly,
      closure_gap_m: Number(closureDistM.toFixed(2)),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  };

  fs.writeFileSync('spb_envelope.geojson', JSON.stringify(feature, null, 2) + '\n', 'utf8');
  console.log('[write] spb_envelope.geojson');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

