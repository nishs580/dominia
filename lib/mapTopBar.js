/**
 * lib/mapTopBar.js
 *
 * Pure formatting for the Dominia-Temp map header (plan U5): the two-letter
 * initials on the avatar tile and the level pill (hidden while /me is still
 * loading or reports no numeric level). CommonJS so the plain-node jest
 * suite can test it.
 */

'use strict';

/**
 * Two uppercase letters for the avatar tile.
 *   "moksh"          -> "MO"
 *   "Kaus Adhikari"  -> "KA"  (first letter of the first two words)
 *   "" / null        -> "?"
 */
function mapInitials(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) return '?';
  const words = n.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
  }
  return Array.from(words[0] || n).slice(0, 2).join('').toUpperCase();
}

/** The level as a whole number, or null when the pill should be hidden. */
function levelValue(level) {
  if (level == null || typeof level === 'boolean') return null;
  if (typeof level === 'string' && level.trim() === '') return null;
  const n = Number(level);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function showLevelPill(level) {
  return levelValue(level) != null;
}

/** Whole-number gold with thousands separators ("1,240"); null while loading. */
function formatGold(gold) {
  if (gold == null) return null;
  const n = Number(gold);
  if (!Number.isFinite(n)) return null;
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = { mapInitials, levelValue, showLevelPill, formatGold };
