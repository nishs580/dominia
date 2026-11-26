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
 *   defended_by set, ally's territory    -> D7 "defence underway", disabled
 *   defended_by set, own territory       -> D8 "ally defending", GOT IT
 *   can_defend false                   -> no action, window-closed note
 *   multi_resource_economy off           -> mandatory defence_gold_cost fee;
 *                                           below it the action is disabled
 *                                           with the shortfall
 *
 * Feed shape (GET /me/active-attacks, plan U8):
 *   { contest_id, territory_id, territory_name, attacker_username, started_at,
 *     scope: 'own'|'alliance', owner_username, defend_window_ends_at,
 *     can_defend, defended_by: null|username }
 * plus, from plan U5: window_ends_at (preferred over defend_window_ends_at)
 * and, when present, alliance_name and defence_ends_at.
 */

'use strict';

const F = require('./formulas');

// Poll cadence while the map is focused, and the backend's per-player rate
// limit on the feed (one call per 10 s).
const POLL_INTERVAL_MS = 30000;
const MIN_FETCH_GAP_MS = 10000;

const COPY = Object.freeze({
  // Eyebrows (Figma D1, D6, D7, D8).
  underAttack: Object.freeze({ key: 'defendPopup.underAttack', defaultValue: 'Under attack by {{attacker}}' }),
  allyEyebrow: Object.freeze({ key: 'defendPopup.allyEyebrow', defaultValue: '{{alliance}} · {{territory}}' }),
  defendedBy: Object.freeze({ key: 'defendPopup.defendedBy', defaultValue: 'Defended by {{defender}}' }),
  allyDefendingEyebrow: Object.freeze({ key: 'defendPopup.allyDefendingEyebrow', defaultValue: 'Ally defending · {{territory}}' }),
  // Titles.
  soloTitle: Object.freeze({ key: 'defendPopup.soloTitle', defaultValue: 'Defend {{territory}}' }),
  allyTitle: Object.freeze({ key: 'defendPopup.allyTitle', defaultValue: 'ALLY UNDER ATTACK' }),
  underwayTitle: Object.freeze({ key: 'defendPopup.underwayTitle', defaultValue: 'DEFENCE UNDERWAY' }),
  allyDefendingTitle: Object.freeze({ key: 'defendPopup.allyDefendingTitle', defaultValue: '{{defender}} is on it' }),
  // Bodies.
  soloBody: Object.freeze({
    key: 'defendPopup.soloBody',
    defaultValue: '{{attacker}} started walking your territory. Walk it faster to keep it.',
  }),
  allianceBody: Object.freeze({
    key: 'defendPopup.allianceBody',
    defaultValue: "{{attacker}} is claiming {{owner}}'s territory. Any alliance member can defend it.",
  }),
  alreadyStarted: Object.freeze({
    key: 'defendPopup.alreadyStarted',
    defaultValue: '{{defender}} is already defending {{territory}}. Only one member can defend at a time.',
  }),
  allyDefendingBody: Object.freeze({
    key: 'defendPopup.allyDefendingBody',
    defaultValue: '{{attacker}} attacked your territory. {{defender}} from your alliance started defending it for you.',
  }),
  windowClosed: Object.freeze({
    key: 'defendPopup.windowClosed',
    defaultValue: 'The defence window for this attack has closed.',
  }),
  // Countdown row labels.
  timeToRespond: Object.freeze({ key: 'defendPopup.timeToRespond', defaultValue: 'TIME TO RESPOND' }),
  defenceEndsIn: Object.freeze({ key: 'defendPopup.defenceEndsIn', defaultValue: 'DEFENCE ENDS IN' }),
  // Buttons.
  defend: Object.freeze({ key: 'defendPopup.defend', defaultValue: 'DEFEND TERRITORY' }),
  defendForAlly: Object.freeze({ key: 'defendPopup.defendForAlly', defaultValue: 'DEFEND FOR ALLY' }),
  inProgress: Object.freeze({ key: 'defendPopup.inProgress', defaultValue: 'DEFENCE IN PROGRESS' }),
  letItGo: Object.freeze({ key: 'defendPopup.letItGo', defaultValue: 'LET IT GO' }),
  notNow: Object.freeze({ key: 'defendPopup.notNow', defaultValue: 'NOT NOW' }),
  gotIt: Object.freeze({ key: 'defendPopup.gotIt', defaultValue: 'GOT IT' }),
  shortfall: Object.freeze({ key: 'defendPopup.shortfall', defaultValue: '{{n}} Gold short' }),
  more: Object.freeze({ key: 'defendPopup.more', defaultValue: '+{{n}} more' }),
});

// Shown in place of the countdown when the window has passed (and in the
// "defence already started" pop-up, Figma D7).
const NO_COUNTDOWN = '—';

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
 * The attack list after a fetch. A transient failure (429 rate limit, a
 * network error or timeout with status 0, a 5xx) keeps what the map already
 * has, so a visible countdown survives one bad poll; every other failure (404
 * before the endpoint ships, auth) means no pop-up.
 */
function isTransientFailure(result) {
  const status = Number(result?.status);
  return status === 429 || status === 0 || status >= 500;
}

function nextAttacks(prev, result) {
  if (result?.ok) return normaliseAttacks(result.data);
  if (result && isTransientFailure(result)) return Array.isArray(prev) ? prev : [];
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

/** End of the defend window: `window_ends_at` (plan U5), else the older field. */
function windowEndMs(a) {
  return toMs(a?.window_ends_at ?? a?.defend_window_ends_at);
}

/**
 * "mm:ss" for the time left, "—" once it has passed, null when unknown (the
 * countdown row is then hidden). Minutes are not capped at 59.
 */
function formatCountdown(msLeft) {
  if (msLeft == null || !Number.isFinite(msLeft)) return null;
  if (msLeft <= 0) return NO_COUNTDOWN;
  const total = Math.ceil(msLeft / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function isActionable(a) {
  return a.can_defend !== false && !a.defended_by;
}

function compareAttacks(a, b) {
  const act = Number(isActionable(b)) - Number(isActionable(a));
  if (act !== 0) return act;
  const ea = windowEndMs(a);
  const eb = windowEndMs(b);
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
 * States (Figma frames):
 *   open             D1 (own) / D6 (ally): TIME TO RESPOND, "N GOLD · DEFEND
 *                    TERRITORY" / "· DEFEND FOR ALLY", LET IT GO / NOT NOW
 *   already_started  D7: an ally's territory someone else already defends;
 *                    disabled DEFENCE IN PROGRESS
 *   allyDefending    D8: your own territory and an ally accepted; DEFENCE
 *                    ENDS IN (only with defence_ends_at) and GOT IT
 *   closed           can_defend false: no action, window-closed note
 * A window that has already passed shows "—" and disables the CTA.
 *
 * @param {object} opts
 * @param {Array}  opts.attacks          normalised feed entries
 * @param {boolean} opts.figmaMode       !legacy_tabs
 * @param {boolean} opts.challengeActive ActiveClaim mounted
 * @param {number|null} opts.gold        player Gold, null while loading
 * @param {boolean} [opts.multiResource] multi_resource_economy flag
 * @param {number} [opts.fee]            override for the economy defence fee
 * @param {string} [opts.selfUsername]   hides attacks the player defends
 * @param {number} [opts.now]            Date.now()
 */
function defendPopupModel({
  attacks,
  figmaMode,
  challengeActive,
  gold = null,
  multiResource = false,
  fee,
  selfUsername = null,
  now = Date.now(),
} = {}) {
  if (!figmaMode || challengeActive) return null;
  const list = orderedAttacks(attacks)
    .filter((a) => !(selfUsername && a.defended_by && a.defended_by === selfUsername));
  if (list.length === 0) return null;

  const attack = list[0];
  const scope = attack.scope === 'alliance' ? 'alliance' : 'solo';
  let state = 'open';
  if (attack.defended_by) state = scope === 'solo' ? 'allyDefending' : 'already_started';
  else if (attack.can_defend === false) state = 'closed';

  const minutesAgo = minutesSince(attack.started_at, now);

  let eyebrow;
  let title;
  let body;
  if (state === 'allyDefending') {
    eyebrow = COPY.allyDefendingEyebrow;
    title = COPY.allyDefendingTitle;
    body = COPY.allyDefendingBody;
  } else if (state === 'already_started') {
    eyebrow = COPY.defendedBy;
    title = COPY.underwayTitle;
    body = COPY.alreadyStarted;
  } else if (scope === 'alliance') {
    eyebrow = attack.alliance_name ? COPY.allyEyebrow : COPY.underAttack;
    title = COPY.allyTitle;
    body = COPY.allianceBody;
  } else {
    eyebrow = COPY.underAttack;
    title = COPY.soloTitle;
    body = COPY.soloBody;
  }

  const note = state === 'closed' ? COPY.windowClosed : null;

  // Countdown: the defend window, or (D8) when the ally's defence ends.
  let countdown = null;
  if (state === 'allyDefending') {
    // Only the ally's defence end; the respond window is a different clock,
    // so with no defence_ends_at in the feed the row is hidden.
    const endsAt = toMs(attack.defence_ends_at);
    if (endsAt != null) {
      countdown = { label: COPY.defenceEndsIn, endsAt, text: formatCountdown(endsAt - now) };
    }
  } else if (state === 'already_started') {
    countdown = { label: COPY.timeToRespond, endsAt: null, text: NO_COUNTDOWN };
  } else {
    const endsAt = windowEndMs(attack);
    if (endsAt != null) {
      countdown = { label: COPY.timeToRespond, endsAt, text: formatCountdown(endsAt - now) };
    }
  }
  const expired = state === 'open' && countdown?.endsAt != null && countdown.endsAt <= now;

  let action = null;
  let secondary = null;
  if (state === 'open') {
    const gate = defenceGoldGate({ gold, multiResource, fee });
    action = {
      kind: 'defend',
      label: scope === 'alliance' ? COPY.defendForAlly : COPY.defend,
      price: gate.applies ? gate.price : null,
      currency: gate.applies ? 'gold' : null,
      disabled: gate.disabled || expired,
      expired,
      shortfall: gate.shortfall,
    };
    secondary = scope === 'alliance' ? COPY.notNow : COPY.letItGo;
  } else if (state === 'already_started') {
    action = {
      kind: 'inProgress',
      label: COPY.inProgress,
      price: null,
      currency: null,
      disabled: true,
      expired: false,
      shortfall: 0,
    };
  } else if (state === 'allyDefending') {
    action = {
      kind: 'gotIt',
      label: COPY.gotIt,
      price: null,
      currency: null,
      disabled: false,
      expired: false,
      shortfall: 0,
    };
  }

  return {
    contestId: String(attack.contest_id),
    territoryId: attack.territory_id ?? null,
    territoryName: attack.territory_name || '',
    attacker: attack.attacker_username || '',
    owner: attack.owner_username || '',
    alliance: attack.alliance_name || '',
    defender: attack.defended_by || null,
    scope,
    state,
    minutesAgo: minutesAgo ?? 0,
    eyebrow,
    title,
    body,
    note,
    countdown,
    action,
    secondary,
    moreCount: list.length - 1,
  };
}

/**
 * ActiveClaim params once POST /contests/:id/defend succeeds, built from the
 * defend preview exactly as DefenderAcceptScreen builds them. The Figma
 * pop-up starts the defence directly, without the Stone boost.
 */
function defendStartParams(preview, playerId, { goldSpent } = {}) {
  const p = preview || {};
  const ratio = Number(p.defender_response_ratio_without_stone) || 0;
  const walked = Number(p.attacker_walked_m) || 0;
  // The Gold the defence cost (POST response, else the preview's fee) so a
  // LOST result shows GOLD −n. Absent with the multi-resource economy on.
  const isNum = (v) => v != null && v !== '' && Number.isFinite(Number(v));
  const goldPaid = isNum(goldSpent)
    ? Number(goldSpent)
    : (isNum(p.gold_defence_cost) ? Number(p.gold_defence_cost) : undefined);
  return {
    mode: 'contest',
    role: 'defender',
    contestId: p.contest_id,
    territoryId: p.territory_id,
    territoryName: p.territory_name,
    playerId,
    requiredWalkM: Math.floor(ratio * walked),
    attackerUsername: p.attacker_username,
    spendStoneUsed: false,
    goldPaid,
  };
}

module.exports = {
  POLL_INTERVAL_MS,
  MIN_FETCH_GAP_MS,
  COPY,
  NO_COUNTDOWN,
  dismissContest,
  isDismissed,
  normaliseAttacks,
  nextAttacks,
  msUntilFetchAllowed,
  isRouteMounted,
  defenceGoldGate,
  orderedAttacks,
  formatCountdown,
  defendPopupModel,
  defendStartParams,
  _resetForTests,
};
