/**
 * lib/defendPopup.js
 *
 * Decision logic for the map's defend pop-up (Figma parity plan U12): which
 * active attack to show, in which variant, whether DEFEND TERRITORY is
 * available, and the Gold gate shared with DefenderAcceptScreen. Pure and
 * CommonJS so the plain-node jest suite can test it; components/DefendPopup.js
 * only renders what defendPopupModel() returns.
 *
 *   legacy_tabs on (today's app)         -> never shown
 *   an active challenge (ActiveClaim)    -> never shown; shown once it ends
 *   dismissed contest                    -> hidden until the next app launch
 *   one pop-up at a time                 -> actionable attacks first, then the
 *                                           soonest-closing defend window;
 *                                           "+N more" counts the rest
 *   defended_by set                      -> "already started", no action
 *   can_defend false                     -> no action, window-closed note
 *   multi_resource_economy off           -> mandatory defence_gold_cost fee;
 *                                           below it the action is disabled
 *                                           with the shortfall
 *
 * Feed shape (GET /me/active-attacks, plan U8):
 *   { contest_id, territory_id, territory_name, attacker_username, started_at,
 *     scope: 'own'|'alliance', owner_username, defend_window_ends_at,
 *     can_defend, defended_by: null|username }
 */

'use strict';

const F = require('./formulas');

// Poll cadence while the map is focused, and the backend's per-player rate
// limit on the feed (one call per 10 s).
const POLL_INTERVAL_MS = 30000;
const MIN_FETCH_GAP_MS = 10000;

const COPY = Object.freeze({
  underAttack: Object.freeze({ key: 'defendPopup.underAttack', defaultValue: 'Under attack by {{attacker}}' }),
  soloBody: Object.freeze({
    key: 'defendPopup.soloBody',
    defaultValue: '{{attacker}} started the attack {{minutes}} min ago. Start defending and protect your territory.',
  }),
  soloBodyJustNow: Object.freeze({
    key: 'defendPopup.soloBodyJustNow',
    defaultValue: '{{attacker}} started the attack just now. Start defending and protect your territory.',
  }),
  allianceBody: Object.freeze({
    key: 'defendPopup.allianceBody',
    defaultValue: "Your Alliance member's ({{owner}}) territory is under attack, defend their territory for them",
  }),
  alreadyStarted: Object.freeze({
    key: 'defendPopup.alreadyStarted',
    defaultValue: '{{defender}} has already started defending this territory.',
  }),
  windowClosed: Object.freeze({
    key: 'defendPopup.windowClosed',
    defaultValue: 'The defence window for this attack has closed.',
  }),
  defend: Object.freeze({ key: 'defendPopup.defend', defaultValue: 'DEFEND TERRITORY' }),
  shortfall: Object.freeze({ key: 'defendPopup.shortfall', defaultValue: '{{n}} Gold short' }),
  more: Object.freeze({ key: 'defendPopup.more', defaultValue: '+{{n}} more' }),
});

// ── Suppression (per app launch) ─────────────────────────────────────────────
// Module state lives as long as the JS runtime, i.e. until the next launch.
const suppressed = new Set();

function dismissContest(contestId) {
  if (contestId != null) suppressed.add(String(contestId));
}

function isDismissed(contestId) {
  return contestId != null && suppressed.has(String(contestId));
}

function _resetForTests() {
  suppressed.clear();
}

// ── Feed handling ────────────────────────────────────────────────────────────

function toMs(iso) {
  if (iso == null) return null;
  const ms = typeof iso === 'number' ? iso : Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function isValidAttack(a) {
  return !!a && typeof a === 'object'
    && (typeof a.contest_id === 'string' || typeof a.contest_id === 'number')
    && String(a.contest_id).length > 0;
}

/** Attacks out of a feed body; anything malformed is dropped. */
function normaliseAttacks(data) {
  const list = Array.isArray(data?.attacks) ? data.attacks : [];
  return list.filter(isValidAttack);
}

/**
 * The attack list after a fetch. A rate-limit answer (429) keeps what the map
 * already has; every other failure (404 before the endpoint ships, network,
 * auth) means no pop-up.
 */
function nextAttacks(prev, result) {
  if (result?.ok) return normaliseAttacks(result.data);
  if (result?.status === 429) return Array.isArray(prev) ? prev : [];
  return [];
}

/** Milliseconds to wait before the next fetch respects the 10 s limit. */
function msUntilFetchAllowed(lastFetchAt, now, minGap = MIN_FETCH_GAP_MS) {
  if (lastFetchAt == null) return 0;
  return Math.max(0, lastFetchAt + minGap - now);
}

/** True when a route with this name is mounted anywhere in a nav state. */
function isRouteMounted(state, name) {
  if (!state || !Array.isArray(state.routes)) return false;
  return state.routes.some((r) => r?.name === name || isRouteMounted(r?.state, name));
}

// ── Gold gate (pop-up and DefenderAccept) ────────────────────────────────────

/**
 * The mandatory Gold defence fee. Applies only with multi_resource_economy
 * off (with it on, today's optional Stone boost applies instead). An unknown
 * balance (still loading) leaves the action enabled; the backend answers
 * insufficient_gold itself.
 */
function defenceGoldGate({ gold, multiResource = false, fee } = {}) {
  if (multiResource) return { applies: false, price: 0, disabled: false, shortfall: 0 };
  const price = Number.isFinite(Number(fee)) && fee != null ? Number(fee) : F.DEFENCE_GOLD_COST;
  if (gold == null || !Number.isFinite(Number(gold))) {
    return { applies: true, price, disabled: false, shortfall: 0 };
  }
  const shortfall = Math.max(0, price - Math.floor(Number(gold)));
  return { applies: true, price, disabled: shortfall > 0, shortfall };
}

// ── Selection and model ──────────────────────────────────────────────────────

function isActionable(a) {
  return a.can_defend !== false && !a.defended_by;
}

function compareAttacks(a, b) {
  const act = Number(isActionable(b)) - Number(isActionable(a));
  if (act !== 0) return act;
  const ea = toMs(a.defend_window_ends_at);
  const eb = toMs(b.defend_window_ends_at);
  if (ea !== eb) {
    if (ea == null) return 1;
    if (eb == null) return -1;
    return ea - eb;
  }
  const sa = toMs(a.started_at) ?? Infinity;
  const sb = toMs(b.started_at) ?? Infinity;
  if (sa !== sb) return sa - sb;
  return String(a.contest_id).localeCompare(String(b.contest_id));
}

/** Visible attacks (not dismissed), in display order. */
function orderedAttacks(attacks) {
  return (Array.isArray(attacks) ? attacks : [])
    .filter(isValidAttack)
    .filter((a) => !isDismissed(a.contest_id))
    .slice()
    .sort(compareAttacks);
}

function minutesSince(iso, now) {
  const ms = toMs(iso);
  if (ms == null) return null;
  return Math.max(0, Math.floor((now - ms) / 60000));
}

/**
 * What the map should show, or null for nothing.
 *
 * @param {object} opts
 * @param {Array}  opts.attacks          normalised feed entries
 * @param {boolean} opts.figmaMode       !legacy_tabs
 * @param {boolean} opts.challengeActive ActiveClaim mounted
 * @param {number|null} opts.gold        player Gold, null while loading
 * @param {boolean} [opts.multiResource] multi_resource_economy flag
 * @param {number} [opts.fee]            override for the economy defence fee
 * @param {number} [opts.now]            Date.now()
 */
function defendPopupModel({
  attacks,
  figmaMode,
  challengeActive,
  gold = null,
  multiResource = false,
  fee,
  now = Date.now(),
} = {}) {
  if (!figmaMode || challengeActive) return null;
  const list = orderedAttacks(attacks);
  if (list.length === 0) return null;

  const attack = list[0];
  const scope = attack.scope === 'alliance' ? 'alliance' : 'solo';
  let state = 'open';
  if (attack.defended_by) state = 'already_started';
  else if (attack.can_defend === false) state = 'closed';

  const minutesAgo = minutesSince(attack.started_at, now);
  let body;
  if (scope === 'alliance') body = COPY.allianceBody;
  else body = minutesAgo != null && minutesAgo < 1 ? COPY.soloBodyJustNow : COPY.soloBody;

  let note = null;
  if (state === 'already_started') note = COPY.alreadyStarted;
  else if (state === 'closed') note = COPY.windowClosed;

  let action = null;
  if (state === 'open') {
    const gate = defenceGoldGate({ gold, multiResource, fee });
    action = {
      label: COPY.defend,
      price: gate.applies ? gate.price : null,
      currency: gate.applies ? 'gold' : null,
      disabled: gate.disabled,
      shortfall: gate.shortfall,
    };
  }

  return {
    contestId: String(attack.contest_id),
    territoryId: attack.territory_id ?? null,
    territoryName: attack.territory_name || '',
    attacker: attack.attacker_username || '',
    owner: attack.owner_username || '',
    defender: attack.defended_by || null,
    scope,
    state,
    minutesAgo: minutesAgo ?? 0,
    status: COPY.underAttack,
    body,
    note,
    action,
    moreCount: list.length - 1,
  };
}

module.exports = {
  POLL_INTERVAL_MS,
  MIN_FETCH_GAP_MS,
  COPY,
  dismissContest,
  isDismissed,
  normaliseAttacks,
  nextAttacks,
  msUntilFetchAllowed,
  isRouteMounted,
  defenceGoldGate,
  orderedAttacks,
  defendPopupModel,
  _resetForTests,
};
