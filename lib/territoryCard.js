/**
 * lib/territoryCard.js
 *
 * What the compact territory card (components/TerritoryCard.js, Figma parity
 * plan U11) shows for a selected territory: ownership, owner, walk distance,
 * time limit and the one priced CTA. Pure and CommonJS so the plain-node jest
 * suite can test it; prices come from the economy parameter (lib/flags.js).
 *
 *   unclaimed            -> START CLAIMING, claim_gold_cost by tier
 *   another player's     -> CONTEST TERRITORY, attack_gold_cost by tier
 *                           (contest_iron_cost in Iron while
 *                           multi_resource_economy is on)
 *   yours / alliance's   -> no spend action
 *
 * Updated UX (plan U8) adds the presentation pieces: a tag chip row
 * (ENEMY + SOLO/[TAG], ALLIANCE + [TAG], YOURS, UNCLAIMED or FIRST CLAIM),
 * an owner title, the enemy "held for N days" subline, an explainer, the
 * single mono meta line ("1,094 M · 30 MIN LIMIT"), the priced CTA text
 * ("8 GOLD · CONTEST TERRITORY") and VIEW ALLIANCE on an ally's ground.
 *
 * A balance below the price disables the CTA and reports the shortfall. An
 * unknown balance (player still loading) leaves it enabled: the backend is
 * the authority on spend and answers insufficient_gold itself.
 */

'use strict';

const F = require('./formulas');
const { getEconomy } = require('./flags');

// Territory colours, mirrored from lib/theme.js colors.self / colors.alliance
// (theme.js is an ES module and this file stays CommonJS for the plain-node
// jest suite). Only used as a fallback for features without `ownership`.
const COLOR_YOURS = '#84FF44'; // = colors.self
const COLOR_ALLIANCE = '#5B7BF5'; // = colors.alliance
// Pre-Dominia-Temp values, so features cached before the palette change
// still classify.
const LEGACY_COLOR_YOURS = '#22D65E';
const LEGACY_COLOR_ALLIANCE = '#3155FF';

const OWNERSHIPS = Object.freeze(['yours', 'alliance', 'enemy', 'unclaimed']);

/**
 * Who holds a territory feature: 'yours' | 'alliance' | 'enemy' | 'unclaimed'.
 * Reads the explicit `ownership` property MapScreen stamps on each feature.
 * Only when that is missing does it fall back to the old fill-colour
 * comparison (current and pre-redesign hexes).
 */
function territoryOwnership(properties) {
  const p = properties || {};
  if (OWNERSHIPS.includes(p.ownership)) return p.ownership;
  const ownerRaw = p.owner;
  if (ownerRaw == null || ownerRaw === 'Unclaimed') return 'unclaimed';
  const colour = typeof p.color === 'string' ? p.color.toUpperCase() : '';
  if (colour === COLOR_YOURS || colour === LEGACY_COLOR_YOURS) return 'yours';
  if (colour === COLOR_ALLIANCE || colour === LEGACY_COLOR_ALLIANCE) return 'alliance';
  return 'enemy';
}

// Display mirror of the backend's TIER_WALK_WINDOW_MIN
// (backend:src/modules/territory/claim.costs.ts). The server returns the real
// window when the walk starts.
const WALK_WINDOW_MIN = Object.freeze({ small: 15, medium: 30, large: 60, epic: 90 });

const CTA_LABELS = Object.freeze({
  claim: Object.freeze({ key: 'map.card.startClaiming', defaultValue: 'START CLAIMING' }),
  contest: Object.freeze({ key: 'map.card.contestTerritory', defaultValue: 'CONTEST TERRITORY' }),
});

// Shown in the CTA while the start request is in flight (review comment:
// "once start is clicked, processing should be shown").
const BUSY_LABEL = Object.freeze({ key: 'map.card.processing', defaultValue: 'PROCESSING…' });

// Updated UX card copy (Figma C4, C5, B3; plan U8).
const CARD_COPY = Object.freeze({
  tagYours: Object.freeze({ key: 'map.card.tagYours', defaultValue: 'YOURS' }),
  tagAlliance: Object.freeze({ key: 'map.card.tagAlliance', defaultValue: 'ALLIANCE' }),
  tagEnemy: Object.freeze({ key: 'map.card.tagEnemy', defaultValue: 'ENEMY' }),
  tagSolo: Object.freeze({ key: 'map.card.tagSolo', defaultValue: 'SOLO' }),
  tagUnclaimed: Object.freeze({ key: 'map.card.tagUnclaimed', defaultValue: 'UNCLAIMED' }),
  tagFirstClaim: Object.freeze({ key: 'firstClaim.kicker', defaultValue: 'FIRST CLAIM · FREE' }),
  ownerTitle: Object.freeze({ key: 'map.card.ownerTitle', defaultValue: "{{owner}}'s territory" }),
  heldFor: Object.freeze({ key: 'map.card.heldFor', defaultValue: '{{name}} · held for {{count}} days' }),
  metaLine: Object.freeze({ key: 'map.card.metaLine', defaultValue: '{{distance}} M · {{minutes}} MIN LIMIT' }),
  enemyExplainer: Object.freeze({
    key: 'map.card.enemyExplainer',
    defaultValue: '{{owner}} will get a chance to defend. Out-walk them before the timer ends to take it.',
  }),
  allianceExplainer: Object.freeze({
    key: 'map.card.allianceExplainer',
    defaultValue: "Held by your ally in {{alliance}}. You can't claim an ally's territory — help defend it when it's under attack.",
  }),
  allianceExplainerNoName: Object.freeze({
    key: 'map.card.allianceExplainerNoName',
    defaultValue: "Held by your ally. You can't claim an ally's territory — help defend it when it's under attack.",
  }),
  viewAlliance: Object.freeze({ key: 'map.card.viewAlliance', defaultValue: 'VIEW ALLIANCE' }),
  ctaPriced: Object.freeze({ key: 'map.card.ctaPriced', defaultValue: '{{price}} {{currency}} · {{label}}' }),
  gold: Object.freeze({ key: 'map.card.goldCaps', defaultValue: 'GOLD' }),
  iron: Object.freeze({ key: 'map.card.ironCaps', defaultValue: 'IRON' }),
});

/** 1094 -> "1,094" (locale-independent, so tests and devices agree). */
function groupThousands(n) {
  const v = Math.round(Number(n) || 0);
  return String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/^/, v < 0 ? '-' : '');
}

function fill(template, params) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] == null ? '' : String(params[k])));
}

function tierKey(tier) {
  const k = String(tier ?? '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(WALK_WINDOW_MIN, k) ? k : 'medium';
}

function toMetres(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  return Number(String(raw ?? '').replace(/[^\d.]/g, '')) || 0;
}

function finiteOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} opts
 * @param {object} opts.properties  feature.properties of the territory
 * @param {number|null} opts.gold   player Gold, null while loading
 * @param {number|null} [opts.iron] player Iron, null while loading
 * @param {boolean} [opts.multiResource] multi_resource_economy flag
 * @param {boolean} [opts.atCap]    player holds their territory cap
 * @param {number} [opts.attackerStreakDays]
 * @param {boolean} [opts.free]     first claim: no price on the CTA
 * @param {number|null} [opts.heldDays] days the current owner has held it
 *                                  (enemy "held for N days"), null = unknown
 * @param {object} [opts.economy]   economy parameter, defaults to getEconomy()
 */
function territoryCardModel({
  properties,
  gold = null,
  iron = null,
  multiResource = false,
  atCap = false,
  attackerStreakDays = 0,
  free = false,
  heldDays = null,
  economy = getEconomy(),
} = {}) {
  const p = properties || {};
  const tier = tierKey(p.tier);
  const ownerRaw = p.owner;
  const ownership = territoryOwnership(p);
  const isUnclaimed = ownership === 'unclaimed' || ownerRaw == null || ownerRaw === 'Unclaimed';

  const perimeterM = toMetres(p.perimeterDistance ?? p.perimeter ?? 0);
  let distanceM = Math.round(perimeterM);
  if (ownership === 'enemy' && perimeterM > 0) {
    try {
      const devLevel = Number(p.developmentLevel) || 0;
      distanceM = F.calcRequiredContestWalk({
        territory: { tier: F.normaliseTier(tier), perimeterMeters: perimeterM, developmentLevel: devLevel },
        attacker: { streakDays: attackerStreakDays || 0, usedSiegeBoost: false, allianceBuffs: [] },
        defender: { streakDays: Number(p.ownerStreak) || 0 },
      });
    } catch (_) {
      distanceM = Math.round(perimeterM);
    }
  }

  let action = null;
  if (ownership === 'unclaimed' || ownership === 'enemy') {
    const kind = ownership === 'unclaimed' ? 'claim' : 'contest';
    const currency = kind === 'contest' && multiResource ? 'iron' : 'gold';
    const table = kind === 'claim'
      ? economy.claim_gold_cost
      : currency === 'iron' ? economy.contest_iron_cost : economy.attack_gold_cost;
    // The first claim is free: no price on the CTA and no balance check.
    const isFree = free === true && kind === 'claim';
    const price = isFree ? 0 : Number(table?.[tier]) || 0;
    const balance = finiteOrNull(currency === 'iron' ? iron : gold);
    const shortfall = balance != null && balance < price ? price - balance : 0;
    const capBlocked = kind === 'claim' && atCap;

    let reason = null;
    if (capBlocked) reason = 'cap';
    else if (shortfall > 0) reason = 'insufficient';

    action = {
      kind,
      label: CTA_LABELS[kind],
      price,
      currency,
      free: isFree,
      balance,
      shortfall,
      disabled: reason != null,
      reason,
    };
  }

  if (action) {
    const label = action.label.defaultValue;
    action.ctaText = action.free
      ? label
      : fill(CARD_COPY.ctaPriced.defaultValue, {
        price: action.price,
        currency: (action.currency === 'iron' ? CARD_COPY.iron : CARD_COPY.gold).defaultValue,
        label,
      });
  }

  const ownerName = isUnclaimed ? null : ownerRaw;
  const allianceTag = p.alliance ? String(p.alliance) : null;
  const allianceName = p.allianceName ? String(p.allianceName) : null;
  const name = p.name ?? null;

  // Tag chips (Figma C4/C5): kind drives the colour, label (copy) or text
  // (raw, e.g. "[JIC]") the content.
  const tags = [];
  if (ownership === 'unclaimed') {
    tags.push(action?.free
      ? { kind: 'firstClaim', label: CARD_COPY.tagFirstClaim, text: null }
      : { kind: 'unclaimed', label: CARD_COPY.tagUnclaimed, text: null });
  } else if (ownership === 'yours') {
    tags.push({ kind: 'yours', label: CARD_COPY.tagYours, text: null });
  } else if (ownership === 'alliance') {
    tags.push({ kind: 'alliance', label: CARD_COPY.tagAlliance, text: null });
    if (allianceTag) tags.push({ kind: 'allianceTag', label: null, text: `[${allianceTag}]` });
  } else {
    tags.push({ kind: 'enemy', label: CARD_COPY.tagEnemy, text: null });
    tags.push(allianceTag
      ? { kind: 'allianceTag', label: null, text: `[${allianceTag}]` }
      : { kind: 'solo', label: CARD_COPY.tagSolo, text: null });
  }

  // Title: "{OWNER}'S TERRITORY" on someone else's ground, else the name.
  const ownedByOther = (ownership === 'enemy' || ownership === 'alliance') && ownerName;
  const title = ownedByOther
    ? { copy: CARD_COPY.ownerTitle, params: { owner: ownerName } }
    : { copy: null, params: { name } };

  const days = finiteOrNull(heldDays);
  const heldFor = ownership === 'enemy' && days != null && days >= 0 ? { days: Math.floor(days) } : null;

  // Subline on enemy ground: "Domlur · held for 3 days" (name alone when the
  // holding time is unknown).
  let subline = null;
  if (ownership === 'enemy') {
    subline = heldFor
      ? { copy: CARD_COPY.heldFor, params: { name: name ?? '', count: heldFor.days } }
      : { copy: null, params: { name: name ?? '' } };
  }

  let explainer = null;
  if (ownership === 'enemy') {
    explainer = { copy: CARD_COPY.enemyExplainer, params: { owner: ownerName ?? '' } };
  } else if (ownership === 'alliance') {
    explainer = allianceName
      ? { copy: CARD_COPY.allianceExplainer, params: { alliance: allianceName } }
      : { copy: CARD_COPY.allianceExplainerNoName, params: {} };
  }

  const timeLimitMin = WALK_WINDOW_MIN[tier];
  const distanceText = groupThousands(distanceM);
  const metaLine = {
    copy: CARD_COPY.metaLine,
    params: { distance: distanceText, minutes: timeLimitMin },
    text: fill(CARD_COPY.metaLine.defaultValue, { distance: distanceText, minutes: timeLimitMin }),
  };

  const viewAlliance = ownership === 'alliance' ? { label: CARD_COPY.viewAlliance } : null;

  return {
    name,
    tier,
    ownership,
    ownerName,
    allianceTag,
    allianceName,
    distanceM,
    perimeterM,
    timeLimitMin,
    tags,
    title,
    subline,
    heldFor,
    explainer,
    metaLine,
    viewAlliance,
    action,
  };
}

module.exports = {
  WALK_WINDOW_MIN,
  CTA_LABELS,
  BUSY_LABEL,
  CARD_COPY,
  groupThousands,
  territoryCardModel,
  territoryOwnership,
};
