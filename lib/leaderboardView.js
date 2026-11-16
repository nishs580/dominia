// lib/leaderboardView.js
// Figma Leaderboards (plan U17): pure view-model for the Territories /
// Distance boards with the SOLO / ALLIANCE toggle, the top-three podium and
// the pinned "Your position" row built from the response's `self` object.
//
// The screen fetches with apiParamsFor(board, scope), runs the envelope
// through parseLeaderboard (lib/leaderboardApi.js), then calls
// buildLeaderboardView. Copy comes back as { key, defaultValue, params } so
// the screen calls t(key, { defaultValue, ...params }).
//
// CJS, no React: jest-testable via plain require().

'use strict';

const { formatDistance } = require('./units');

const BOARDS = Object.freeze([
  Object.freeze({ key: 'territories', apiBoard: 'territory', labelKey: 'leaderboards.boardTerritories', labelDefault: 'Territories' }),
  Object.freeze({ key: 'distance', apiBoard: 'distance', labelKey: 'leaderboards.boardDistance', labelDefault: 'Distance' }),
]);

const SCOPES = Object.freeze([
  Object.freeze({ key: 'solo', subject: 'players', labelKey: 'leaderboards.scopeSolo', labelDefault: 'SOLO' }),
  Object.freeze({ key: 'alliance', subject: 'alliances', labelKey: 'leaderboards.scopeAlliance', labelDefault: 'ALLIANCE' }),
]);

const DEFAULT_BOARD = 'territories';
const DEFAULT_SCOPE = 'solo';

function boardFor(key) {
  return BOARDS.find((b) => b.key === key) || BOARDS[0];
}

function scopeFor(key) {
  return SCOPES.find((s) => s.key === key) || SCOPES[0];
}

/** Figma board + scope → the API's { board, subject }. Unknown keys fall back to the defaults. */
function apiParamsFor(boardKey, scopeKey) {
  return { board: boardFor(boardKey).apiBoard, subject: scopeFor(scopeKey).subject };
}

// ─── Copy ─────────────────────────────────────────────────────────────────

/** English ordinal: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 112th. */
function ordinal(n) {
  const v = Math.abs(Math.trunc(n));
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1: return `${v}st`;
    case 2: return `${v}nd`;
    case 3: return `${v}rd`;
    default: return `${v}th`;
  }
}

function placeCopy(rank) {
  return { key: 'leaderboards.place', defaultValue: '{{ordinal}} Place', params: { ordinal: ordinal(rank), rank } };
}

function toNumber(v) {
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return v;
}

/** The ranked value of a row (or of `self`) on a board, or null. */
function rowValue(boardKey, row) {
  if (!row) return null;
  const candidates = boardKey === 'distance'
    ? [row.distance_m, row.weekly_distance_m, row.value]
    : [row.territory_count, row.value];
  for (const c of candidates) {
    const n = toNumber(c);
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return null;
}

/** "96 Territories" / "03 Territories" or "121.4 km" via lib/units formatDistance. */
function valueCopy(boardKey, value, unit) {
  if (boardKey === 'distance') {
    return { key: 'leaderboards.distanceValue', defaultValue: '{{distance}}', params: { distance: formatDistance(value, unit) } };
  }
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  return {
    key: 'leaderboards.territoriesValue',
    defaultValue: '{{n}} Territories',
    params: { n: n == null ? '—' : String(n).padStart(2, '0') },
  };
}

// ─── Entries ──────────────────────────────────────────────────────────────

function idsOf(row, subject) {
  if (subject === 'alliances') return { playerId: null, allianceId: row.alliance_id != null ? String(row.alliance_id) : null };
  return { playerId: row.player_id != null ? String(row.player_id) : null, allianceId: null };
}

/** True when `row` is the caller's own entry. Matches by id when `self` carries one, else by rank. */
function isSelfRow(row, self, subject) {
  if (!self || !row) return false;
  const selfId = subject === 'alliances' ? self.alliance_id : self.player_id;
  const rowId = subject === 'alliances' ? row.alliance_id : row.player_id;
  if (selfId != null && rowId != null) return String(selfId) === String(rowId);
  return toNumber(row.rank) === self.rank;
}

function nameOf(row, subject) {
  const raw = subject === 'alliances' ? row.alliance_name : row.username;
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

// Copy shape is { key, defaultValue, params } or { key: null, text } for
// server-provided text.
// Middle segment of the row line: "Solo" for a player in no alliance, the
// alliance tag for a player in one; the tag for an alliance row.
function tagCopy(row, subject) {
  const tag = row.alliance_short_name || null;
  if (subject === 'alliances') return tag ? { key: null, text: `[${tag}]` } : null;
  if (tag) return { key: null, text: `[${tag}]` };
  if (row.alliance_name) return { key: null, text: row.alliance_name };
  return { key: 'leaderboards.solo', defaultValue: 'Solo', params: {} };
}

function toEntry(row, { board, subject, unit, self }) {
  const rank = toNumber(row.rank);
  const value = rowValue(board, row);
  const ids = idsOf(row, subject);
  return {
    key: `${subject}:${ids.playerId || ids.allianceId || `rank-${rank}`}`,
    rank,
    name: nameOf(row, subject),
    tag: tagCopy(row, subject),
    value,
    valueCopy: valueCopy(board, value, unit),
    placeCopy: placeCopy(rank),
    playerId: ids.playerId,
    allianceId: ids.allianceId,
    avatarUrl: row.avatar_url || null,
    emblem: row.emblem || row.alliance_emblem || null,
    isSelf: isSelfRow(row, self, subject),
  };
}

function byRank(a, b) {
  const ra = Number.isFinite(toNumber(a.rank)) ? toNumber(a.rank) : Infinity;
  const rb = Number.isFinite(toNumber(b.rank)) ? toNumber(b.rank) : Infinity;
  return ra - rb;
}

/**
 * @param {object} args
 * @param {'loading'|'error'|'ready'} args.status  request state
 * @param {object[]} args.rows                      parsed rows
 * @param {object|null} args.self                   parsed self ({ rank, value, ... }) or null
 * @param {'territories'|'distance'} args.board
 * @param {'solo'|'alliance'} args.scope
 * @param {'km'|'mi'} args.unit
 * @returns {{
 *   state: 'loading'|'error'|'empty'|'ready',
 *   podium: object[],   // display order: 2nd, 1st, 3rd; only slots that exist
 *   list: object[],     // ranks after the top three
 *   pinned: object|null // the caller's row; null when self is null
 * }}
 */
function buildLeaderboardView({ status, rows, self, board, scope, unit } = {}) {
  const boardKey = boardFor(board).key;
  const subject = scopeFor(scope).subject;
  if (status === 'loading') return { state: 'loading', podium: [], list: [], pinned: null };
  if (status === 'error') return { state: 'error', podium: [], list: [], pinned: null };

  const ctx = { board: boardKey, subject, unit, self: self || null };
  const entries = (Array.isArray(rows) ? rows : [])
    .filter((r) => r != null && typeof r === 'object')
    .slice()
    .sort(byRank)
    .map((r) => toEntry(r, ctx));

  let pinned = null;
  if (self) {
    const own = entries.find((e) => e.isSelf);
    const fromSelf = toEntry(self, ctx);
    pinned = {
      ...fromSelf,
      key: 'self',
      rank: self.rank,
      tag: null, // Figma's pinned row reads "Name · value · place", no tag
      placeCopy: placeCopy(self.rank),
      // Prefer the board row's name/value when the caller is on the list.
      name: fromSelf.name || (own ? own.name : null),
      value: fromSelf.value != null ? fromSelf.value : own ? own.value : null,
      valueCopy: fromSelf.value != null ? fromSelf.valueCopy : own ? own.valueCopy : fromSelf.valueCopy,
      avatarUrl: fromSelf.avatarUrl || (own ? own.avatarUrl : null),
      emblem: fromSelf.emblem || (own ? own.emblem : null),
      isSelf: true,
    };
  }

  if (entries.length === 0) return { state: 'empty', podium: [], list: [], pinned };

  const top = entries.slice(0, 3).map((e, i) => ({ ...e, slot: i + 1 }));
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  return { state: 'ready', podium, list: entries.slice(3), pinned };
}

module.exports = {
  BOARDS,
  SCOPES,
  DEFAULT_BOARD,
  DEFAULT_SCOPE,
  apiParamsFor,
  ordinal,
  placeCopy,
  rowValue,
  valueCopy,
  isSelfRow,
  buildLeaderboardView,
};
