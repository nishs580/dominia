// lib/activityHistory.js
// Figma History (G8, plan 2026-11-27 U13, R-F4): pure view-model for the
// player's activity log in Figma mode.
//
//   - Groups entries under TODAY, YESTERDAY and dated headers ("21 NOV").
//   - Maps the backend event types (PLAYER_FEED_EVENT_TYPES in the
//     backend's shared/constants/activityLog.ts) onto the six Final event
//     labels, each with its icon tile and tone.
//   - Hides the rows the Figma doesn't draw (streak, level, influence, and the
//     non-terminal "defence started" row) in Figma mode.
//
// Copy comes back as { key, defaultValue } so the screen calls
// t(key, { defaultValue }). CJS, no React: jest-testable via plain require().

'use strict';

// The six Final event types. `icon` picks the tile glyph, `tone` the colour
// pair (self = green, alliance = blue, enemy = red) as drawn in G8.
const FINAL_TYPES = Object.freeze({
  EMPTY_CLAIMED: Object.freeze({
    key: 'activityLog.typeEmptyClaimed', defaultValue: 'EMPTY TERRITORY CLAIMED', icon: 'flag', tone: 'self',
  }),
  ENEMY_CLAIMED: Object.freeze({
    key: 'activityLog.typeEnemyClaimed', defaultValue: 'ENEMY TERRITORY CLAIMED', icon: 'swords', tone: 'enemy',
  }),
  DEFENDED: Object.freeze({
    key: 'activityLog.typeDefended', defaultValue: 'TERRITORY DEFENDED', icon: 'shield', tone: 'alliance',
  }),
  DEFEND_FAILED: Object.freeze({
    key: 'activityLog.typeDefendFailed', defaultValue: 'TERRITORY DEFENDING FAILED', icon: 'swords', tone: 'enemy',
  }),
  EMPTY_CLAIM_FAILED: Object.freeze({
    key: 'activityLog.typeEmptyClaimFailed', defaultValue: 'EMPTY TERRITORY CLAIM FAILED', icon: 'flag', tone: 'self',
  }),
  ENEMY_CLAIM_FAILED: Object.freeze({
    key: 'activityLog.typeEnemyClaimFailed', defaultValue: 'ENEMY TERRITORY CLAIM FAILED', icon: 'shield', tone: 'alliance',
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

function localDayKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Short month in the app language, upper-cased, trailing dot dropped ("NOV", "НОЯБ"). */
function shortMonth(d, locale) {
  let text;
  try {
    text = d.toLocaleDateString(locale || 'en', { month: 'short' });
  } catch (_) {
    text = d.toLocaleDateString('en', { month: 'short' });
  }
  return String(text).replace(/\.$/, '').toUpperCase();
}

/**
 * Group header for a timestamp relative to `now` (both local time):
 *   same day   → { kind: 'today', key: 'activityLog.today' }
 *   day before → { kind: 'yesterday', key: 'activityLog.yesterday' }
 *   older      → { kind: 'date', text: '21 NOV' } ('21 NOV 2025' in another year)
 */
function dayGroupLabel(occurredAt, now, locale) {
  const d = toDate(occurredAt);
  const n = toDate(now) || new Date();
  if (!d) return { kind: 'date', dayKey: 'unknown', key: null, text: '—' };
  const dayKey = localDayKey(d);
  if (dayKey === localDayKey(n)) {
    return { kind: 'today', dayKey, key: 'activityLog.today', defaultValue: 'TODAY' };
  }
  const yesterday = new Date(startOfDay(n).getTime());
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === localDayKey(yesterday)) {
    return { kind: 'yesterday', dayKey, key: 'activityLog.yesterday', defaultValue: 'YESTERDAY' };
  }
  const year = d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return { kind: 'date', dayKey, key: null, text: `${d.getDate()} ${shortMonth(d, locale)}${year}` };
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

/** One row's view-model. */
function historyItem(event) {
  return {
    id: String(event.id),
    event,
    label: historyLabel(event),
    headline: headlineOf(event),
    time: formatTime(event.occurred_at),
  };
}

/**
 * Feed events (newest first, as the API returns them) → SectionList sections.
 *
 * @param {object[]} events
 * @param {object} [opts]
 * @param {Date} [opts.now]          defaults to the current time
 * @param {string} [opts.locale]     app language for dated headers
 * @param {boolean} [opts.figma=true] hide the types Figma doesn't draw
 * @returns {{ key: string, title: object, data: object[] }[]}
 */
function buildHistorySections(events, { now, locale, figma = true } = {}) {
  const list = (Array.isArray(events) ? events : [])
    .filter((e) => e && typeof e === 'object')
    .filter((e) => !figma || isVisibleInFigma(e));
  const sections = [];
  const byDay = new Map();
  for (const e of list) {
    const title = dayGroupLabel(e.occurred_at, now, locale);
    let section = byDay.get(title.dayKey);
    if (!section) {
      section = { key: title.dayKey, title, data: [] };
      byDay.set(title.dayKey, section);
      sections.push(section);
    }
    section.data.push(historyItem(e));
  }
  return sections;
}

module.exports = {
  FINAL_TYPES,
  FIGMA_HIDDEN_TYPES,
  finalTypeOf,
  historyLabel,
  isVisibleInFigma,
  dayGroupLabel,
  formatTime,
  headlineOf,
  historyItem,
  buildHistorySections,
};
