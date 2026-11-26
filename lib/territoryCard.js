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
 * A balance below the price disables the CTA and reports the shortfall. An
 * unknown balance (player still loading) leaves it enabled: the backend is
 * the authority on spend and answers insufficient_gold itself.
 */

'use strict';

const F = require('./formulas');
const { getEconomy } = require('./flags');

// Territory colours as MapScreen stamps them on feature properties.
const COLOR_YOURS = '#22D65E';
const COLOR_ALLIANCE = '#3155FF';

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
  economy = getEconomy(),
} = {}) {
  const p = properties || {};
  const tier = tierKey(p.tier);
  const ownerRaw = p.owner;
  const isUnclaimed = ownerRaw == null || ownerRaw === 'Unclaimed';

  let ownership = 'unclaimed';
  if (!isUnclaimed) {
    if (p.color === COLOR_YOURS) ownership = 'yours';
    else if (p.color === COLOR_ALLIANCE) ownership = 'alliance';
    else ownership = 'enemy';
  }

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

  return {
    name: p.name ?? null,
    tier,
    ownership,
    ownerName: isUnclaimed ? null : ownerRaw,
    distanceM,
    perimeterM,
    timeLimitMin: WALK_WINDOW_MIN[tier],
    action,
  };
}

module.exports = { WALK_WINDOW_MIN, CTA_LABELS, BUSY_LABEL, territoryCardModel };
