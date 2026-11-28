// lib/leaderboardView.js
// Dominia-Temp Leaderboards (plan 2026-11-28 U11, board 39): pure view-model
// for the Territories / Distance boards with the SOLO / ALLIANCE tabs, the
// name search, the top-three podium (rank tones gold / bronze / silver) and
// the pinned "YOUR POSITION" row built from the response's `self` object.
//
// The screen fetches with apiParamsFor(board, scope), runs the envelope
// through parseLeaderboard (lib/leaderboardApi.js), then calls
// buildLeaderboardView. Copy comes back as { key, defaultValue, params } so
// the screen calls t(key, { defaultValue, ...params }).
//
// CJS, no React: jest-testable via plain require().

'use strict';

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

const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;

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

/** English ordinal: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 141st. */
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

/**
 * Rank tile tone (board 39): 1st gold, 2nd bronze, 3rd silver, the rest
 * neutral. The podium order on the board is 3rd · 1st · 2nd.
 */
function rankTone(rank) {
  const n = toNumber(rank);
  if (n === 1) return 'gold';
  if (n === 2) return 'bronze';
  if (n === 3) return 'silver';
  return 'neutral';
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

/** Board distance with two decimals: 121450 m → "121.45 km"; "—" when unknown. */
function formatBoardDistance(meters, unit) {
  const m = toNumber(meters);
  if (typeof m !== 'number' || !Number.isFinite(m)) return '—';
  const u = unit === 'mi' ? 'mi' : 'km';
  const value = u === 'mi' ? m / METERS_PER_MILE : m / METERS_PER_KM;
  const fixed = (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
  return `${fixed} ${u}`;
}

/** "96 Territories" / "03 Territories" or "121.45 km". */
function valueCopy(boardKey, value, unit) {
  if (boardKey === 'distance') {
    return { key: 'leaderboards.distanceValue', defaultValue: '{{distance}}', params: { distance: formatBoardDistance(value, unit) } };
  }
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  return {
    key: 'leaderboards.territoriesValue',
    defaultValue: '{{n}} Territories',
    params: { n: n == null ? '—' : String(n).padStart(2, '0') },
  };
}

/** Rank tile text: 1 → "1", 141 → "141", unknown → "—". */
function rankLabel(rank) {
  const n = toNumber(rank);
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return String(Math.trunc(n));
}

/** The Territories / Distance dropdown options, with the active one marked. */
function boardTabs(activeBoard) {
  const active = boardFor(activeBoard).key;
  return BOARDS.map((b) => ({
    key: b.key,
    active: b.key === active,
    label: { key: b.labelKey, defaultValue: b.labelDefault, params: {} },
  }));
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

/** Subtext under every name on the board: "Solo" on the SOLO tab, "Alliance" on ALLIANCE. */
function kindCopy(subject) {
  return subject === 'alliances'
    ? { key: 'leaderboards.kindAlliance', defaultValue: 'Alliance', params: {} }
    : { key: 'leaderboards.solo', defaultValue: 'Solo', params: {} };
}

function normalizeQuery(query) {
  return typeof query === 'string' ? query.trim().toLowerCase() : '';
}

/**
 * Rows whose name (alliances: name or short name) contains `query`
 * (case-insensitive, trimmed). An empty
 * query keeps every row. Runs on whatever the server returned, so it is a
 * no-op on a server-filtered response and correct on an old backend.
 */
function filterRowsByName(rows, query, subject) {
  const list = Array.isArray(rows) ? rows : [];
  const q = normalizeQuery(query);
  if (!q) return list;
  return list.filter((r) => {
    if (!r || typeof r !== 'object') return false;
    // Alliances match on name or short name (tag), like the backend's `q`.
    const candidates = subject === 'alliances'
      ? [r.alliance_name, r.alliance_short_name]
      : [r.username];
    return candidates.some((c) => typeof c === 'string' && c.toLowerCase().includes(q));
  });
}

function toEntry(row, { board, subject, unit, self }) {
  const rank = toNumber(row.rank);
  const value = rowValue(board, row);
  const ids = idsOf(row, subject);
  return {
    key: `${subject}:${ids.playerId || ids.allianceId || `rank-${rank}`}`,
    rank,
    tone: rankTone(rank),
    name: nameOf(row, subject),
    kind: kindCopy(subject),
    value,
    valueCopy: valueCopy(board, value, unit),
    rankLabel: rankLabel(rank),
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
 * @param {string} [args.selfName]                 caller's username, the pinned
 *                                                 solo row's name fallback
 * @param {string} [args.query]                    name search; non-empty hides
 *                                                 the podium and lists every
 *                                                 match with its global rank
 * @returns {{
 *   state: 'loading'|'error'|'empty'|'noResults'|'ready',
 *   podium: object[],   // display order: 3rd, 1st, 2nd; only slots that exist
 *   list: object[],     // every ranked row, 1st included (all matches when searching)
 *   pinned: object|null // the caller's row; null when self is null
 * }}
 */
function buildLeaderboardView({ status, rows, self, board, scope, unit, selfName, query } = {}) {
  const boardKey = boardFor(board).key;
  const subject = scopeFor(scope).subject;
  if (status === 'loading') return { state: 'loading', podium: [], list: [], pinned: null };
  if (status === 'error') return { state: 'error', podium: [], list: [], pinned: null };

  const ctx = { board: boardKey, subject, unit, self: self || null };
  const all = (Array.isArray(rows) ? rows : []).filter((r) => r != null && typeof r === 'object');
  const searching = normalizeQuery(query) !== '';
  const entries = filterRowsByName(all, query, subject)
    .slice()
    .sort(byRank)
    .map((r) => toEntry(r, ctx));

  let pinned = null;
  if (self) {
    const own = all.map((r) => toEntry(r, ctx)).find((e) => e.isSelf);
    const fromSelf = toEntry(self, ctx);
    const value = fromSelf.value != null ? fromSelf.value : own ? own.value : null;
    pinned = {
      ...fromSelf,
      key: 'self',
      rank: self.rank,
      tone: 'self',
      // Prefer the board row's name/value when the caller is on the list.
      name: fromSelf.name || (own ? own.name : null)
        || (subject === 'players' && typeof selfName === 'string' && selfName.trim() !== '' ? selfName : null),
      value,
      valueCopy: valueCopy(boardKey, value, unit),
      rankLabel: rankLabel(self.rank),
      placeCopy: placeCopy(self.rank),
      avatarUrl: fromSelf.avatarUrl || (own ? own.avatarUrl : null),
      emblem: fromSelf.emblem || (own ? own.emblem : null),
      isSelf: true,
    };
  }

  if (all.length === 0) return { state: 'empty', podium: [], list: [], pinned };
  if (entries.length === 0) return { state: 'noResults', podium: [], list: [], pinned };
  if (searching) return { state: 'ready', podium: [], list: entries, pinned };

  const top = entries.slice(0, 3).map((e, i) => ({ ...e, slot: i + 1 }));
  const podium = [top[2], top[0], top[1]].filter(Boolean);
  // Board 39 repeats the top three as rows under the podium.
  return { state: 'ready', podium, list: entries, pinned };
}

module.exports = {
  BOARDS,
  SCOPES,
  DEFAULT_BOARD,
  DEFAULT_SCOPE,
  apiParamsFor,
  ordinal,
  rankTone,
  placeCopy,
  rowValue,
  formatBoardDistance,
  valueCopy,
  rankLabel,
  boardTabs,
  isSelfRow,
  filterRowsByName,
  buildLeaderboardView,
};
