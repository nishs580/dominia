/**
 * lib/relocate.js
 *
 * View-model for the map's Relocate sheet (Updated UX C9/C10, plan U8): the
 * player's own territories, nearest to the home pin first, each with how
 * long it has been held and how far away it is ("HELD 6 DAYS · 2.1 KM
 * AWAY"), or the empty state when the player holds none. Client-only: GO
 * flies the camera there with lib/mapFlight.js centredFlightCamera.
 *
 * Pure and CommonJS so the plain-node jest suite can test it.
 *
 * Input rows (supabase `territories` owned by the player, optionally merged
 * with the open territory_history row):
 *   { id, territory_name | name, latitude, longitude, geojson?, claimed_at? }
 */

'use strict';

const DAY_MS = 86400000;
const EARTH_RADIUS_M = 6371000;

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Great-circle distance in metres between [lng, lat] and lat/lng. */
function haversineM(lng1, lat1, lng2, lat2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 2140 -> "2.1" (km, one decimal). */
function formatKm(metres) {
  if (metres == null || !Number.isFinite(metres)) return null;
  return (Math.round(metres / 100) / 10).toFixed(1);
}

function heldDaysFrom(claimedAt, now) {
  if (claimedAt == null) return null;
  const ms = typeof claimedAt === 'number' ? claimedAt : Date.parse(claimedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((now - ms) / DAY_MS));
}

/**
 * @param {object} opts
 * @param {Array}  opts.territories  the player's own territories
 * @param {Array|null} opts.homePin  [lng, lat] or null
 * @param {number} [opts.now]        Date.now()
 * @returns {{ empty: boolean, rows: Array }}
 */
function relocateModel({ territories, homePin = null, now = Date.now() } = {}) {
  const list = Array.isArray(territories) ? territories : [];
  const homeLng = Array.isArray(homePin) ? num(homePin[0]) : null;
  const homeLat = Array.isArray(homePin) ? num(homePin[1]) : null;
  const hasHome = homeLng != null && homeLat != null;

  const seen = new Set();
  const rows = [];
  for (const t of list) {
    if (!t || t.id == null || seen.has(String(t.id))) continue;
    const latitude = num(t.latitude);
    const longitude = num(t.longitude);
    if (latitude == null || longitude == null) continue;
    seen.add(String(t.id));
    const distanceM = hasHome ? haversineM(homeLng, homeLat, longitude, latitude) : null;
    rows.push({
      id: t.id,
      name: t.territory_name ?? t.name ?? '',
      latitude,
      longitude,
      geojson: t.geojson ?? null,
      heldDays: heldDaysFrom(t.claimed_at, now),
      distanceM,
      distanceKm: formatKm(distanceM),
    });
  }

  rows.sort((a, b) => {
    if (a.distanceM != null && b.distanceM != null && a.distanceM !== b.distanceM) {
      return a.distanceM - b.distanceM;
    }
    if (a.distanceM == null && b.distanceM != null) return 1;
    if (b.distanceM == null && a.distanceM != null) return -1;
    return String(a.name).localeCompare(String(b.name));
  });

  return { empty: rows.length === 0, rows };
}

/** Camera target for centredFlightCamera. */
function relocateTarget(row) {
  if (!row) return null;
  return { longitude: row.longitude, latitude: row.latitude, geojson: row.geojson ?? null };
}

/**
 * Merges open territory_history rows ({ territory_id, claimed_at }) into the
 * owned territories so each carries claimed_at.
 */
function withClaimedAt(territories, historyRows) {
  const since = new Map();
  for (const h of Array.isArray(historyRows) ? historyRows : []) {
    if (h?.territory_id == null || h.claimed_at == null) continue;
    const key = String(h.territory_id);
    const prev = since.get(key);
    // The most recent open claim wins.
    if (!prev || Date.parse(h.claimed_at) > Date.parse(prev)) since.set(key, h.claimed_at);
  }
  return (Array.isArray(territories) ? territories : []).map((t) => (
    t && since.has(String(t.id)) ? { ...t, claimed_at: since.get(String(t.id)) } : t
  ));
}

module.exports = { relocateModel, relocateTarget, withClaimedAt, haversineM, formatKm };
