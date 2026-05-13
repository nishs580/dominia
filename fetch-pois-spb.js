/**
 * fetch-pois-spb.js
 *
 * Queries Overpass for OSM place features + named POIs inside the SPB KAD envelope
 * (read from `spb_envelope.geojson`) and writes `pois_spb.geojson`.
 *
 * Usage:
 *   node fetch-pois-spb.js
 *
 * Notes:
 *   - Pure Node — no deps. Uses built-in `fetch` (Node 18+).
 *   - `out center;` is used to get a representative point for ways/relations.
 */
/* eslint-disable no-console */

const fs = require('fs');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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
  node["place"="quarter"](poly:"${polyString}");
  way["place"="quarter"](poly:"${polyString}");
  relation["place"="quarter"](poly:"${polyString}");
  node["addr:quarter"](poly:"${polyString}");
  way["addr:quarter"](poly:"${polyString}");

  node["place"~"^(neighbourhood|suburb)$"]["name"](poly:"${polyString}");
  way["place"~"^(neighbourhood|suburb)$"]["name"](poly:"${polyString}");
  relation["place"~"^(neighbourhood|suburb)$"]["name"](poly:"${polyString}");

  node["leisure"="park"]["name"](poly:"${polyString}");
  way["leisure"="park"]["name"](poly:"${polyString}");
  relation["leisure"="park"]["name"](poly:"${polyString}");

  node["amenity"~"^(university|hospital|cathedral)$"]["name"](poly:"${polyString}");
  way["amenity"~"^(university|hospital|cathedral)$"]["name"](poly:"${polyString}");

  node["tourism"~"^(museum|attraction)$"]["name"](poly:"${polyString}");
  way["tourism"~"^(museum|attraction)$"]["name"](poly:"${polyString}");

  node["railway"="station"]["name"](poly:"${polyString}");
  node["public_transport"="station"]["name"](poly:"${polyString}");
);
out center;
`.trim();
}

function asNullableString(v) {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function getPointForElement(el) {
  if (el?.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon };
  }
  if ((el?.type === 'way' || el?.type === 'relation')
      && typeof el.center?.lat === 'number'
      && typeof el.center?.lon === 'number') {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function inc(counts, key) {
  if (!Object.prototype.hasOwnProperty.call(counts, key)) counts[key] = 0;
  counts[key]++;
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

  console.log('[overpass] querying POIs inside SPB KAD envelope...');

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

  const counts = {
    place_quarter: 0,
    addr_quarter: 0,
    neighbourhood: 0,
    suburb: 0,
    park: 0,
    university: 0,
    hospital: 0,
    cathedral: 0,
    museum: 0,
    attraction: 0,
    station: 0,
    public_transport: 0,
  };

  let skippedNoCentroid = 0;
  const features = [];

  for (const el of elements) {
    if (!el || (el.type !== 'node' && el.type !== 'way' && el.type !== 'relation')) continue;
    if (typeof el.id !== 'number') continue;

    const point = getPointForElement(el);
    if (!point) {
      skippedNoCentroid++;
      continue;
    }

    const tags = el.tags || {};
    const place = asNullableString(tags.place);
    const leisure = asNullableString(tags.leisure);
    const amenity = asNullableString(tags.amenity);
    const tourism = asNullableString(tags.tourism);
    const railway = asNullableString(tags.railway);
    const publicTransport = asNullableString(tags.public_transport);

    const tagName = asNullableString(tags.name);
    const addrQuarter = asNullableString(tags['addr:quarter']);

    const name = tagName || addrQuarter || null;
    const nameQuarter = place === 'quarter' ? (tagName || null) : (addrQuarter || null);

    if (place === 'quarter') counts.place_quarter++;
    if (addrQuarter) counts.addr_quarter++;
    if (place === 'neighbourhood') counts.neighbourhood++;
    if (place === 'suburb') counts.suburb++;
    if (leisure === 'park') counts.park++;
    if (amenity === 'university') counts.university++;
    if (amenity === 'hospital') counts.hospital++;
    if (amenity === 'cathedral') counts.cathedral++;
    if (tourism === 'museum') counts.museum++;
    if (tourism === 'attraction') counts.attraction++;
    if (railway === 'station') counts.station++;
    if (publicTransport === 'station') counts.public_transport++;

    features.push({
      type: 'Feature',
      properties: {
        osm_type: el.type,
        osm_id: el.id,
        name,
        name_quarter: nameQuarter,
        place,
        leisure,
        amenity,
        tourism,
        railway,
        public_transport: publicTransport,
      },
      geometry: {
        type: 'Point',
        coordinates: [point.lon, point.lat], // GeoJSON [lng, lat]
      },
    });
  }

  const fc = {
    type: 'FeatureCollection',
    features,
  };

  fs.writeFileSync('pois_spb.geojson', JSON.stringify(fc) + '\n', 'utf8');

  const stat = fs.statSync('pois_spb.geojson');
  const sizeMb = stat.size / (1024 * 1024);

  const end = process.hrtime.bigint();
  const elapsedSec = Number(end - start) / 1e9;

  console.log(`[stats] total elements fetched: ${elements.length}`);
  console.log('[stats] breakdown:');
  console.log(`  - place=quarter: ${counts.place_quarter}`);
  console.log(`  - addr:quarter: ${counts.addr_quarter}`);
  console.log(`  - neighbourhood: ${counts.neighbourhood}`);
  console.log(`  - suburb: ${counts.suburb}`);
  console.log(`  - park: ${counts.park}`);
  console.log(`  - university: ${counts.university}`);
  console.log(`  - hospital: ${counts.hospital}`);
  console.log(`  - cathedral: ${counts.cathedral}`);
  console.log(`  - museum: ${counts.museum}`);
  console.log(`  - attraction: ${counts.attraction}`);
  console.log(`  - station (railway=station): ${counts.station}`);
  console.log(`  - public_transport=station: ${counts.public_transport}`);
  console.log(`[stats] skipped (no centroid): ${skippedNoCentroid}`);
  console.log(`[write] pois_spb.geojson (${sizeMb.toFixed(2)} MB)`);
  console.log(`[time] elapsed: ${elapsedSec.toFixed(2)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

