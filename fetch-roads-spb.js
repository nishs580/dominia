/**
 * fetch-roads-spb.js
 *
 * Queries Overpass for qualifying roads + railways inside the SPB KAD envelope
 * (read from `spb_envelope.geojson`) and writes `roads_spb.geojson`.
 *
 * Usage:
 *   node fetch-roads-spb.js
 *
 * Notes:
 *   - Pure Node — no deps. Uses built-in `fetch` (Node 18+).
 *   - Overpass headers match `fetch-spb-envelope.js`.
 */
/* eslint-disable no-console */

const fs = require('fs');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const HIGHWAY_TYPES = [
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'unclassified',
  'living_street',
];

function toFixed6(n) {
  return Number(n).toFixed(6);
}

function readKadOuterRingLngLat() {
  const raw = fs.readFileSync('spb_envelope.geojson', 'utf8');
  const json = JSON.parse(raw);

  const geom = json?.geometry || json?.features?.[0]?.geometry;
  if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) {
    throw new Error('spb_envelope.geojson: expected a GeoJSON Polygon geometry.');
  }

  const ring = geom.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error('spb_envelope.geojson: outer ring missing or too short.');
  }

  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) {
      throw new Error('spb_envelope.geojson: invalid coordinate encountered in outer ring.');
    }
  }

  return ring;
}

function lngLatRingToOverpassPoly(ringLngLat) {
  // Overpass poly expects: lat lng lat lng ...
  return ringLngLat
    .map(([lng, lat]) => `${toFixed6(lat)} ${toFixed6(lng)}`)
    .join(' ');
}

function buildOverpassQuery(polyString) {
  return `
[out:json][timeout:600];
(
  way["highway"~"^(${HIGHWAY_TYPES.join('|')})$"](poly:"${polyString}");
  way["railway"~"^(rail|light_rail)$"](poly:"${polyString}");
);
out geom;
`.trim();
}

function asNullableString(v) {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

async function fetchOverpass(query) {
  const controller = new AbortController();
  const timeoutMs = 900 * 1000;
  const t = setTimeout(() => controller.abort(new Error('Overpass request timed out')), timeoutMs);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'dominia-territory-seeder/1.0',
      },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const start = process.hrtime.bigint();

  const ringLngLat = readKadOuterRingLngLat();
  const poly = lngLatRingToOverpassPoly(ringLngLat);
  const query = buildOverpassQuery(poly);

  console.log('[overpass] querying roads + railways inside SPB KAD envelope...');

  let res;
  try {
    res = await fetchOverpass(query);
  } catch (e) {
    const isAbort = e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('timed out');
    if (isAbort) {
      console.error('[overpass] timeout after 900s');
      process.exit(1);
    }
    throw e;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '<failed to read response body>');
    console.error(`[overpass] HTTP ${res.status}`);
    console.error(body);
    process.exit(1);
  }

  const data = await res.json().catch(async () => {
    const body = await res.text().catch(() => '<failed to read response body>');
    console.error('[overpass] failed to parse JSON response');
    console.error(body);
    process.exit(1);
  });

  const elements = Array.isArray(data?.elements) ? data.elements : [];
  if (elements.length === 0) {
    console.error('[overpass] empty elements array');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const highwayCounts = Object.fromEntries(HIGHWAY_TYPES.map((t) => [t, 0]));
  let railwayWays = 0;
  let totalPoints = 0;

  const features = [];
  for (const el of elements) {
    if (el?.type !== 'way' || typeof el.id !== 'number' || !Array.isArray(el.geometry)) continue;
    if (el.geometry.length < 2) continue;

    const tags = el.tags || {};
    const highway = asNullableString(tags.highway);
    const railway = asNullableString(tags.railway);
    const name = asNullableString(tags.name);

    if (highway && Object.prototype.hasOwnProperty.call(highwayCounts, highway)) highwayCounts[highway]++;
    if (railway && (railway === 'rail' || railway === 'light_rail')) railwayWays++;

    totalPoints += el.geometry.length;

    const coords = el.geometry.map((p) => [p.lon, p.lat]); // GeoJSON [lng, lat]

    features.push({
      type: 'Feature',
      properties: {
        osm_id: el.id,
        highway: highway || null,
        railway: railway || null,
        name: name || null,
      },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });
  }

  if (features.length === 0) {
    console.error('[overpass] no way geometries returned');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const fc = {
    type: 'FeatureCollection',
    features,
  };

  fs.writeFileSync('roads_spb.geojson', JSON.stringify(fc) + '\n', 'utf8');

  const stat = fs.statSync('roads_spb.geojson');
  const sizeMb = stat.size / (1024 * 1024);

  const end = process.hrtime.bigint();
  const elapsedSec = Number(end - start) / 1e9;

  console.log(`[stats] ways fetched: ${features.length}`);
  console.log('[stats] highway breakdown:');
  for (const t of HIGHWAY_TYPES) {
    console.log(`  - ${t}: ${highwayCounts[t]}`);
  }
  console.log(`[stats] railway ways: ${railwayWays}`);
  console.log(`[stats] total points: ${totalPoints}`);
  console.log(`[write] roads_spb.geojson (${sizeMb.toFixed(2)} MB)`);
  console.log(`[time] elapsed: ${elapsedSec.toFixed(2)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

