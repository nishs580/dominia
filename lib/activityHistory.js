// lib/activityHistory.js
// Dominia-Temp History (board 40, plan 2026-11-28 U11; first built as G8 in
// plan 2026-11-27 U13): pure view-model for the player's activity log.
//
//   - Flat rows, each stamped with its day ("27th Oct") and time ("06:56 PM").
//   - Maps the backend event types (PLAYER_FEED_EVENT_TYPES in the
//     backend's shared/constants/activityLog.ts) onto the six Final event
//     labels, each with its icon (flag / swords / shield) and tone
//     (success lime / failure red).
//   - Hides the rows the board doesn't draw (streak, level, influence, and the
//     non-terminal "defence started" row) in Figma mode.
//
// Copy comes back as { key, defaultValue } so the screen calls
// t(key, { defaultValue }). CJS, no React: jest-testable via plain require().

'use strict';

// The six Final event types (board 40). `icon` picks the tile glyph; `tone`
// is 'success' (lime) or 'failure' (red). Keys are new for the sentence-case
// Dominia-Temp copy (the older activityLog.type* keys hold the caps copy).
const FINAL_TYPES = Object.freeze({
  EMPTY_CLAIMED: Object.freeze({
    key: 'activityLog.eventEmptyClaimed', defaultValue: 'Empty territory claimed', icon: 'flag', tone: 'success',
  }),
  EMPTY_CLAIM_FAILED: Object.freeze({
    key: 'activityLog.eventEmptyClaimFailed', defaultValue: 'Empty territory claim failed', icon: 'flag', tone: 'failure',
  }),
  ENEMY_CLAIMED: Object.freeze({
    key: 'activityLog.eventEnemyClaimed', defaultValue: 'Enemy territory claimed', icon: 'swords', tone: 'success',
  }),
  ENEMY_CLAIM_FAILED: Object.freeze({
    key: 'activityLog.eventEnemyClaimFailed', defaultValue: 'Enemy territory claim failed', icon: 'swords', tone: 'failure',
  }),
  DEFENDED: Object.freeze({
    key: 'activityLog.eventDefended', defaultValue: 'Territory defended', icon: 'shield', tone: 'success',
  }),
  DEFEND_FAILED: Object.freeze({
    key: 'activityLog.eventDefendFailed', defaultValue: 'Territory defending failed', icon: 'shield', tone: 'failure',
  }),
});

// Rows the Figma history doesn't list. contest_defended is written when the
// defender starts a defence walk; the outcome row (contest_held /
// contest_lost / contest_expired) follows, so showing both would double up.
const FIGMA_HIDDEN_TYPES = Object.freeze([
  'streak_milestone',
  'streak_broken',
  'leveled_up',
  'influence_milestone',
  'contest_defended',
]);

function meta(event, ...keys) {
  const m = event && event.metadata;
  if (!m || typeof m !== 'object') return null;
  for (const k of keys) {
    if (m[k] !== undefined && m[k] !== null) return m[k];
  }
  return null;
}

/**
 * The Final type for a backend event, or null when it has none.
 *
 *   territory_claimed                      → EMPTY_CLAIMED
 *   contest_won (attacker)                 → ENEMY_CLAIMED
 *   contest_held, defence_held (defender)  → DEFENDED
 *   contest_lost, outcome attacker_won     → DEFEND_FAILED (you were the defender)
 *   contest_lost, outcome defender_won     → ENEMY_CLAIM_FAILED (you were the attacker)
 *   contest_expired, attacker row          → ENEMY_CLAIM_FAILED
 *   contest_expired, defender row          → DEFENDED (the attack ran out)
 *   claim_failed / claim_expired           → EMPTY_CLAIM_FAILED (not emitted yet)
 */
function finalTypeOf(event) {
  switch (event && event.event_type) {
    case 'territory_claimed':
      return 'EMPTY_CLAIMED';
    case 'contest_won':
      return 'ENEMY_CLAIMED';
    case 'contest_held':
    case 'defence_held':
      return 'DEFENDED';
    case 'contest_lost':
      return meta(event, 'outcome') === 'defender_won' ? 'ENEMY_CLAIM_FAILED' : 'DEFEND_FAILED';
    case 'contest_expired': {
      // The expiry writes one row per side: the attacker's carries the
      // attacker's walk, the defender's only the defender's.
      const attackerSide = meta(event, 'attackerWalkedM', 'attacker_walked_m', 'requiredWalkM', 'required_walk_m') != null;
      const defenderSide = meta(event, 'defenderWalkedM', 'defender_walked_m') != null;
      return defenderSide && !attackerSide ? 'DEFENDED' : 'ENEMY_CLAIM_FAILED';
    }
    case 'claim_failed':
    case 'claim_expired':
      return 'EMPTY_CLAIM_FAILED';
    default:
      return null;
  }
}

/**
 * Label, icon and tone for a row. Final types use the Figma labels; anything
 * else keeps its existing activityEvent.stub copy with a neutral tile.
 */
function historyLabel(event) {
  const finalType = finalTypeOf(event);
  if (finalType) {
    const f = FINAL_TYPES[finalType];
    return { finalType, key: f.key, defaultValue: f.defaultValue, icon: f.icon, tone: f.tone };
  }
  const type = String((event && event.event_type) || '');
  return {
    finalType: null,
    key: type ? `activityEvent.stub.${type}` : 'activityEvent.fallback',
    defaultValue: type ? type.replace(/_/g, ' ').toUpperCase() : 'ACTIVITY',
    icon: 'dot',
    tone: 'neutral',
  };
}

function isVisibleInFigma(event) {
  return !!event && FIGMA_HIDDEN_TYPES.indexOf(event.event_type) === -1;
}

// ─── Dates ────────────────────────────────────────────────────────────────

function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isEnglish(locale) {
  return !locale || String(locale).toLowerCase().startsWith('en');
}

/** English ordinal day: 1st, 2nd, 3rd, 11th, 12th, 13th, 21st, 22nd, 31st. */
function ordinalDay(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Short month in the app language, trailing dot dropped ("Oct", "окт"). */
function shortMonth(d, locale) {
  let text;
  try {
    text = d.toLocaleDateString(locale || 'en', { month: 'short' });
  } catch (_) {
    text = d.toLocaleDateString('en', { month: 'short' });
  }
  return String(text).replace(/\.$/, '');
}

/**
 * The row's day stamp in local time: "27th Oct" in English, "27 окт" in
 * other languages; the year is appended when it isn't `now`'s year. "" for a
 * missing timestamp.
 */
function formatDayStamp(occurredAt, { locale, now } = {}) {
  const d = toDate(occurredAt);
  if (!d) return '';
  const n = toDate(now) || new Date();
  const day = isEnglish(locale) ? ordinalDay(d.getDate()) : String(d.getDate());
  const year = d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${day} ${shortMonth(d, locale)}${year}`;
}

/** "06:56 PM" in English (12-hour, padded), "18:56" in other languages. "" when missing. */
function formatClock(occurredAt, locale) {
  const d = toDate(occurredAt);
  if (!d) return '';
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (!isEnglish(locale)) return `${String(d.getHours()).padStart(2, '0')}:${mm}`;
  const h = d.getHours() % 12 || 12;
  return `${String(h).padStart(2, '0')}:${mm} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "09:12" in local 24-hour time; "" for a missing timestamp. */
function formatTime(occurredAt) {
  const d = toDate(occurredAt);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Territory (or, for alliance rows, alliance) name for the row headline, or null. */
function headlineOf(event) {
  const name = meta(event, 'territory_name', 'territoryName', 'alliance_name', 'allianceName');
  return typeof name === 'string' && name.trim() !== '' ? name : null;
}

/**
 * One row's view-model. Safe as an Array#map callback (a numeric second
 * argument is ignored).
 */
function historyItem(event, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  return {
    id: String(event.id),
    event,
    label: historyLabel(event),
    headline: headlineOf(event),
    date: formatDayStamp(event.occurred_at, o),
    time: formatClock(event.occurred_at, o.locale),
  };
}

/**
 * Feed events (newest first, as the API returns them) → flat rows.
 *
 * @param {object[]} events
 * @param {object} [opts]
 * @param {string} [opts.locale]      app language for the day stamp and clock
 * @param {Date}   [opts.now]         defaults to the current time
 * @param {boolean} [opts.figma=true] hide the types the board doesn't draw
 */
function buildHistoryRows(events, { locale, now, figma = true } = {}) {
  return (Array.isArray(events) ? events : [])
    .filter((e) => e && typeof e === 'object')
    .filter((e) => !figma || isVisibleInFigma(e))
    .map((e) => historyItem(e, { locale, now }));
}

module.exports = {
  FINAL_TYPES,
  FIGMA_HIDDEN_TYPES,
  finalTypeOf,
  historyLabel,
  isVisibleInFigma,
  formatDayStamp,
  formatClock,
  formatTime,
  headlineOf,
  historyItem,
  buildHistoryRows,
};
