/**
 * lib/units.js
 *
 * The player's distance unit and the one distance formatter the app uses.
 *
 * USAGE
 *   import { formatDistance, useUnits, getUnits } from '../lib/units';
 *   const units = useUnits();                 // 'km' | 'mi', re-renders on change
 *   formatDistance(1609, units);              // "1.0 mi"
 *
 * The unit lives on the player (`players.units`, written by PATCH /me
 * { units }, plan U6). Profile loads it into this store on mount and the
 * App Settings row writes it through saveUnits, which reverts on failure.
 * Unknown or missing units fall back to km everywhere.
 *
 * CommonJS so it loads under jest's node environment without a Babel config.
 */

'use strict';

const { useSyncExternalStore } = require('react');

const UNITS = Object.freeze(['km', 'mi']);
const DEFAULT_UNIT = 'km';
const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;

function normalizeUnit(unit) {
  return unit === 'mi' ? 'mi' : DEFAULT_UNIT;
}

// "1.0 km" / "1.0 mi", one decimal. Non-numeric input renders as an em dash
// so a missing reading never shows as "0.0 km".
function formatDistance(meters, unit) {
  const m = typeof meters === 'string' && meters.trim() !== '' ? Number(meters) : meters;
  if (typeof m !== 'number' || !Number.isFinite(m)) return '—';
  const u = normalizeUnit(unit);
  const value = u === 'mi' ? m / METERS_PER_MILE : m / METERS_PER_KM;
  // Avoid "-0.0" for tiny negative noise.
  const fixed = (Math.abs(value) < 0.05 ? 0 : value).toFixed(1);
  return `${fixed} ${u}`;
}

// ─── Store ────────────────────────────────────────────────────────────────

let current = DEFAULT_UNIT;
const listeners = new Set();

function getUnits() {
  return current;
}

function setUnits(unit) {
  const next = normalizeUnit(unit);
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useUnits() {
  return useSyncExternalStore(subscribe, getUnits);
}

// Optimistically applies `next`, then persists it with `patch(unit)` (which
// resolves to { ok }). On failure, or if patch throws, the previous unit is
// restored. Resolves to { ok, unit } where unit is what is now applied.
async function saveUnits(next, patch) {
  const prev = current;
  const target = normalizeUnit(next);
  if (target === prev) return { ok: true, unit: prev };
  setUnits(target);
  let ok = false;
  try {
    const res = await patch(target);
    ok = !!(res && res.ok);
  } catch (_) {
    ok = false;
  }
  // A later save may have moved on; only revert our own change.
  if (!ok && current === target) setUnits(prev);
  return { ok, unit: current };
}

function _resetForTests() {
  current = DEFAULT_UNIT;
  listeners.clear();
}

module.exports = {
  UNITS,
  DEFAULT_UNIT,
  METERS_PER_MILE,
  normalizeUnit,
  formatDistance,
  getUnits,
  setUnits,
  subscribe,
  useUnits,
  saveUnits,
  _resetForTests,
};
