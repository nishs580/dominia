/**
 * lib/formulas.js
 *
 * Dominia game engine — single source of truth for all calculations.
 *
 * USAGE
 *   const F = require('./lib/formulas');
 *   const xp = F.calcChallengeXp({ tier: 'medium', streakDays: 14 });
 *   const power = F.calcTotalPower(playerData);
 *
 * PRINCIPLES
 *   - Pure functions. No I/O, no DB calls, no side effects.
 *   - All inputs validated. All outputs deterministic.
 *   - Influence stored as integer fixed-point (×10) — see calcDailyInfluence.
 *   - Every constant exported so you can tune without forking the file.
 *   - If a function returns null or throws, the caller has passed bad data.
 *
 * EARN MODEL
 *   All earn events (XP and resources) flow through the Canonical Earn
 *   Calculation: final = round(base × cap_factor × bonus_product), with
 *   bonus_product hard-capped at BONUS_PRODUCT_CAP (3.0). Caps apply to
 *   base earn before bonuses. See calcCanonicalEarn.
 *
 * MISSION REWARD POOLS
 *   The MISSION_REWARDS values are alliance-wide pools, not per-member
 *   values. They are distributed across members via the 50/35/15 hybrid
 *   model. See distributeMissionMorale and distributeMissionGold.
 *
 * ALIGNED WITH: dominia_mechanics_v6.10.md
 */

'use strict';

// =============================================================================
// CONSTANTS — all tunable values live here. Edit in one place.
// =============================================================================

const TIERS = Object.freeze(['Small', 'Medium', 'Large', 'Epic']);
const TIER_NORMALISER = Object.freeze({
  small: 'Small', medium: 'Medium', large: 'Large', epic: 'Epic',
  Small: 'Small', Medium: 'Medium', Large: 'Large', Epic: 'Epic',
});
const DEV_LEVELS = Object.freeze([0, 1, 2, 3, 4]);
const LEGACY_RANKS = Object.freeze([1, 2, 3, 4, 5]);
const CHALLENGE_TIERS = Object.freeze(['easy', 'medium', 'hard']);
const STREAK_TIERS = Object.freeze([
  'newcomer', 'committed', 'proven', 'reliable',
  'iron_guard', 'unbroken', 'legendary'
]);

// Canonical Earn Calculation — applies to all XP and resource earn events.
// final_earn = round(base_earn × cap_factor × bonus_product)
// bonus_product is hard-capped at this value to prevent pathological stacking.
const BONUS_PRODUCT_CAP = 3.0;

// ---- 1. SIEGE XP ------------------------------------------------------------

const XP_PER_CHALLENGE = Object.freeze({
  easy: 50,
  medium: 150,
  hard: 400,
  weekly_bonus: 600,
});

const XP_PER_DEFENCE_WIN = Object.freeze({
  Small: 200,
  Medium: 250,
  Large: 350,
  Epic: 500,
});

const XP_RECONQUEST = 400;
const XP_PER_DEV_TIER_REACHED = 500;
const XP_ALLIANCE_MISSION = 250;
const XP_STREAK_MILESTONE = 250;

// Cumulative XP floors required for each level
const LEVEL_XP_FLOORS = Object.freeze([
  0,        // Level 1 — Scout
  600,      // Level 2 — Pathfinder
  2_000,    // Level 3 — Claimer
  5_500,    // Level 4 — Defender
  12_000,   // Level 5 — Commander
  30_000,   // Level 6 — Warlord
  70_000,   // Level 7 — Strategist
  140_000,  // Level 8 — Conqueror
  250_000,  // Level 9 — Sovereign
  420_000,  // Level 10 — Dominator
]);

const LEVEL_TITLES = Object.freeze([
  'Scout', 'Pathfinder', 'Claimer', 'Defender', 'Commander',
  'Warlord', 'Strategist', 'Conqueror', 'Sovereign', 'Dominator'
]);

// ---- 2. STREAKS -------------------------------------------------------------

const STREAK_TIER_THRESHOLDS = Object.freeze([
  { days: 60, tier: 'legendary',  multiplier: 1.50 },
  { days: 30, tier: 'unbroken',   multiplier: 1.40 },
  { days: 21, tier: 'iron_guard', multiplier: 1.30 },
  { days: 14, tier: 'reliable',   multiplier: 1.20 },
  { days: 7,  tier: 'proven',     multiplier: 1.15 },
  { days: 3,  tier: 'committed',  multiplier: 1.10 },
  { days: 0,  tier: 'newcomer',   multiplier: 1.00 },
]);

// Tier caps for Large/Epic territories — keeps contests achievable
const STREAK_MULT_TIER_CAP = Object.freeze({
  Small:  1.50,
  Medium: 1.50,
  Large:  1.25,
  Epic:   1.15,
});

const GRACE_DAY_BANK_CAP = 3;

// Days at which Grace Days are auto-banked
const GRACE_DAY_MILESTONES = Object.freeze([7, 30, 60]);

// ---- 3. RESOURCES -----------------------------------------------------------

// Resource earn events. Step and calorie tiers are split because Easy calorie
// pays Iron (not Stone) and Easy step pays Stone (not Iron).
const RESOURCE_EARN = Object.freeze({
  // Step challenges — pay Stone, no Iron
  easy_step_challenge:     { iron: 0,  stone: 15, gold: 5,  morale: 3  },
  medium_step_challenge:   { iron: 0,  stone: 35, gold: 10, morale: 5  },
  hard_step_challenge:     { iron: 0,  stone: 65, gold: 20, morale: 10 },

  // Calorie challenges — pay Iron, no Stone
  easy_calorie_challenge:   { iron: 9,  stone: 0,  gold: 5,  morale: 3  },
  medium_calorie_challenge: { iron: 20, stone: 0,  gold: 10, morale: 5  },
  hard_calorie_challenge:   { iron: 45, stone: 0,  gold: 20, morale: 10 },

  // Distance (Range) challenges — volume axis, pay Stone like steps
  easy_distance_challenge:   { iron: 0,  stone: 15, gold: 5,  morale: 3  },
  medium_distance_challenge: { iron: 0,  stone: 35, gold: 10, morale: 5  },
  hard_distance_challenge:   { iron: 0,  stone: 65, gold: 20, morale: 10 },

  // Tempo challenges — intensity axis, pay Iron like calories
  easy_tempo_challenge:   { iron: 9,  stone: 0,  gold: 5,  morale: 3  },
  medium_tempo_challenge: { iron: 20, stone: 0,  gold: 10, morale: 5  },
  hard_tempo_challenge:   { iron: 45, stone: 0,  gold: 20, morale: 10 },

  // Other earn events
  weekly_bonus:       { iron: 50, stone: 50, gold: 30, morale: 20 },
  contest_win:        { iron: 15, stone: 0,  gold: 25, morale: 8  },
  defence_win:        { iron: 0,  stone: 20, gold: 15, morale: 8  },
  reconquest:         { iron: 15, stone: 20, gold: 40, morale: 15 },
  alliance_mission:   { iron: 10, stone: 10, gold: 30, morale: 40 },
  war_chest_donation: { iron: 0,  stone: 0,  gold: 0,  morale: 5  }, // first/day only
});

const CLAIM_GOLD_COST = Object.freeze({
  Small: 10, Medium: 25, Large: 60, Epic: 120,
});

const CLAIM_GOLD_REWARD = Object.freeze({
  Small: 10, Medium: 20, Large: 50, Epic: 100,
});

const CONTEST_IRON_COST = Object.freeze({
  Small: 8, Medium: 20, Large: 45, Epic: 80,
});

const CLAIM_XP = Object.freeze({
  Small: 40, Medium: 80, Large: 200, Epic: 500,
});

const CONTEST_WIN_XP = Object.freeze({
  Small: 300, Medium: 350, Large: 450, Epic: 600,
});

const SIEGE_BOOST_IRON_COST = 35;
const SIEGE_BOOST_DISTANCE_FACTOR = 0.75;
const DEFENCE_ACTIVATION_STONE_COST = 10;
const FREE_DEFENCE_RATIO = 1.25;

// Gold conversion rates (lossy, asymmetric)
const GOLD_CONVERSION = Object.freeze({
  iron:   0.50,
  stone:  0.60,
  morale: 0.40, // Level 6+ only — caller enforces gate
});

// Morale decay applied weekly to PERSONAL wallet (not war chest).
// Continues to apply even when the player is unaffiliated with any alliance.
const MORALE_PERSONAL_DECAY_PER_WEEK = 0.05;

// ---- 4. TERRITORY -----------------------------------------------------------

const TERRITORY_BASE_POWER = Object.freeze({
  Small: 10, Medium: 25, Large: 60, Epic: 120,
});

const TERRITORY_BASE_INFLUENCE = Object.freeze({
  Small: 2, Medium: 5, Large: 12, Epic: 25,
});

// Influence multiplier — tier-specific (per v6.10 §5.8.1).
// Distinct from the Territory Power multiplier and the Contest multiplier.
const DEV_INFLUENCE_MULT = Object.freeze({
  Small:  { 0: 1.0, 1: 1.3,  2: 1.6, 3: 2.0,  4: 2.5  },
  Medium: { 0: 1.0, 1: 1.3,  2: 1.6, 3: 2.0,  4: 2.5  },
  Large:  { 0: 1.0, 1: 1.3,  2: 1.5, 3: 1.75, 4: 2.0  },
  Epic:   { 0: 1.0, 1: 1.25, 2: 1.4, 3: 1.6,  4: 1.75 },
});

// Territory Power multiplier — tier-blind (per v6.10 §10.1.2).
// Used only in Territory Power calculation.
const DEV_POWER_MULT = Object.freeze({
  0: 1.0, 1: 1.3, 2: 1.6, 3: 2.0, 4: 2.5,
});

// Contest multiplier — tier-blind, conservative (per v6.10 §4.2.1).
// Applies only to attacker's required walk distance in contests.
const DEV_CONTEST_MULT = Object.freeze({
  0: 1.00, 1: 1.05, 2: 1.10, 3: 1.15, 4: 1.20,
});

const LEGACY_RANK_INFLUENCE_MULT = Object.freeze({
  1: 1.00, 2: 1.25, 3: 1.50, 4: 2.00, 5: 3.00,
});

const LEGACY_RANK_POWER_MULT = Object.freeze({
  1: 1.00, 2: 1.15, 3: 1.30, 4: 1.50, 5: 1.80,
});

// Cumulative resource cost to REACH each development level
const DEV_COST = Object.freeze({
  0: { stone: 0,     iron: 0,     gold: 0,   influence: 0    },
  1: { stone: 150,   iron: 80,    gold: 40,  influence: 60   },
  2: { stone: 450,   iron: 240,   gold: 120, influence: 200  },
  3: { stone: 1_000, iron: 550,   gold: 280, influence: 500  },
  4: { stone: 2_200, iron: 1_200, gold: 600, influence: 1_300 },
});

// Territory upkeep was removed with the Territory Development ship
// (mechanics §5.3.1 retired). Influence is never halved; there is no
// weekly Stone obligation. The territories.upkeep_overdue column is kept
// dormant (always false) — see backend migration 20260706.

// Influence is stored as fixed-point ×10 to avoid float drift
const INFLUENCE_FIXED_POINT_SCALE = 10;

// ---- 5. CONTESTS ------------------------------------------------------------

const RALLY_CRY_FACTOR = 0.80;
const STEADFAST_DEF_FACTOR = 0.80;        // Modifies defender response ratio (not in attacker formula)
const REQUIRED_WALK_HARD_CAP = 2.0;       // Contest can never require more than 2× perimeter
const CONTEST_WALK_ROUNDING_M = 10;

// ---- 6. ALLIANCE ABILITIES --------------------------------------------------

const ALLIANCE_ABILITY = Object.freeze({
  war_surge:     { type: 'offensive', cost: 80,  durationHours: 6,  effect: 'iron_cost_minus_40' },
  iron_bulwark:  { type: 'defensive', cost: 80,  durationHours: 6,  effect: 'iron_cost_plus_40'  },
  rally_cry:     { type: 'offensive', cost: 60,  durationHours: 12, effect: 'attacker_walk_80'   },
  steadfast:     { type: 'defensive', cost: 60,  durationHours: 12, effect: 'defender_walk_80'   },
  supply_line:   { type: 'utility',   cost: 40,  durationHours: 24, effect: 'resource_earn_plus_20' },
  unified_front: { type: 'utility',   cost: 100, durationHours: 48, effect: 'streak_break_immune' },
});

const ALLIANCE_MORALE_WEEKLY_SPEND_CAP = 200;
const MAX_ACTIVE_ABILITIES_PER_ALLIANCE = 2;

// Bonus multipliers for active alliance abilities (used in canonical earn calc)
const SUPPLY_LINE_BONUS_MULT = 1.20;

// ---- 7. CHALLENGE EFFECTIVENESS (wellbeing caps) ----------------------------

// Daily caps
const STEP_BANDS = Object.freeze([
  { max: 15_000, effectiveness: 1.00 },
  { max: 17_500, effectiveness: 0.75 },
  { max: 20_000, effectiveness: 0.40 },
  { max: Infinity, effectiveness: 0.00 },
]);

const CALORIE_BANDS = Object.freeze([
  { max: 700, effectiveness: 1.00 },
  { max: 800, effectiveness: 0.75 },
  { max: 900, effectiveness: 0.40 },
  { max: Infinity, effectiveness: 0.00 },
]);

const SESSION_BANDS = Object.freeze([
  { max: 90,  effectiveness: 1.00 },
  { max: 110, effectiveness: 0.60 },
  { max: 130, effectiveness: 0.25 },
  { max: Infinity, effectiveness: 0.00 },
]);

// Weekly cap — past this, all step-derived rewards halve
const WEEKLY_STEP_CAP = 100_000;
const WEEKLY_OVER_CAP_FACTOR = 0.5;

// Idle threshold defining a "session" boundary.
// Unified at 15 minutes across session cap, contest continuity, and defender lapse.
const SESSION_IDLE_THRESHOLD_MIN = 15;

// Velocity guard — minutes where speed exceeds this are discarded entirely
const MAX_PLAUSIBLE_KMH = 25;

// Default stride length for uncalibrated players
const DEFAULT_STRIDE_M = 0.75;

// ---- 8. POWER FORMULA -------------------------------------------------------

const ACTIVITY_POWER_WEIGHTS = Object.freeze({
  xp_30d:        0.5,
  km_30d:        3,
  challenges_30d: 10,
  contests_30d:  25,
});

const LEGACY_POWER_WEIGHTS = Object.freeze({
  per_title:        200,
  per_championship: 500,
  per_contest_win:  5,
  per_defence_win:  5,
  per_streak_day:   10,
  xp_divisor:       1_000,
});

// Honor / Legacy Medal Power — the medal system replaces the ad-hoc legacy
// inputs (contest wins / streak / xp) it used to proxy. A tiered medal scores
// its highest earned tier; a x N medal scores per count (capped); a one-off is
// flat. Bar-count is the real channel, so values rise sharply with tier.
// Max ~6.7k at full completion — a contributor to Total Power, not a dominator.
const MEDAL_POWER_WEIGHTS = Object.freeze({
  bronze:    50,
  silver:    100,
  gold:      200,
  claim:     400,
  per_count: 50,    // singular x N: 50 per count
  count_cap: 500,   // ...capped
  one_off:   500,   // singular one-off (ETERNAL)
});

// Alliance coordination — applied to sum of member Power
const ALLIANCE_PARTICIPATION_THRESHOLD_POWER = 500; // member must have ≥ this Activity Power
const ALLIANCE_COORD_BASE = 1.0;
const ALLIANCE_COORD_MAX_BONUS = 0.3; // 1.0 → 1.3 at 100% participation

// ---- 9. FULL-VALUE TERRITORY CAP --------------------------------------------

const FULL_VALUE_CAP_BASE = 2;
const FULL_VALUE_CAP_PER_LEVEL = 3;
const FULL_VALUE_CAP_UNBROKEN_BONUS = 1;          // 30–59 day streak (mutually exclusive with Legendary)
const FULL_VALUE_CAP_LEGENDARY_BONUS = 2;         // 60+ day streak
const FULL_VALUE_CAP_DOMINATOR_BONUS = 3;         // Level 10
const FULL_VALUE_CAP_CHAMPIONSHIP_BONUS = 2;      // Alliance has won an annual championship
const FULL_VALUE_CAP_UNBROKEN_TOGETHER_BONUS = 1; // Alliance at "Unbroken Together" mission tier or higher (30+ weeks)
const ABOVE_CAP_VALUE_FACTOR = 0.5;

// ---- 10. ALLIANCE MISSIONS --------------------------------------------------

// Eligibility threshold — same as alliance coordination threshold for consistency
const MISSION_ELIGIBILITY_ACTIVITY_POWER = 500;

// Mission categories
const MISSION_CATEGORIES = Object.freeze(['endurance', 'conquest', 'coordination']);

// Mission catalog — all alliance-initiated, no opponent dependency
const MISSION_CATALOG = Object.freeze({
  // Endurance
  long_march:        { category: 'endurance',    base_per_member: 25,        unit: 'km' },
  the_forge:         { category: 'endurance',    base_per_member: 2_500,     unit: 'kcal' },
  the_step_wall:     { category: 'endurance',    base_per_member: 50_000,    unit: 'steps' },
  hard_days:         { category: 'endurance',    base_per_member: 2,         unit: 'hard_challenges' },
  streak_wall:       { category: 'endurance',    base_per_member: 1.0,       unit: 'boolean' },

  // Conquest
  the_push:          { category: 'conquest',     base_per_member: 0.40,      unit: 'contest_wins' },
  land_grab:         { category: 'conquest',     base_per_member: 0.50,      unit: 'claims' },
  ground_up:         { category: 'conquest',     base_per_member: 0.25,      unit: 'dev_tiers' },
  iron_investment:   { category: 'conquest',     base_per_member: 30,        unit: 'iron_spent' },
  the_long_walk:     { category: 'conquest',     base_per_member: 1.5,       unit: 'contest_km' },

  // Coordination
  all_hands:         { category: 'coordination', base_occurrences: 2, participation_pct: 1.00, participation_min: null },
  show_of_force:     { category: 'coordination', base_occurrences: 1, participation_pct: 0.50, participation_min: 5 },
  evening_march:     { category: 'coordination', base_occurrences: 2, participation_pct: 0.33, participation_min: 4 },
  sunrise_run:       { category: 'coordination', base_occurrences: 3, participation_pct: 0.50, participation_min: 6 },
  synchronised:      { category: 'coordination', base_occurrences: 3, participation_pct: 1.00, participation_min: null },
});

// Conquest mission floor — every conquest mission has at least this target
const CONQUEST_TARGET_FLOOR = 2;

// Difficulty multiplier based on last-4-mission completion count
const DIFFICULTY_MULT = Object.freeze({
  4: 1.10,  // 4 of 4 — raise the bar
  3: 1.00,  // 3 of 4 — status quo
  2: 0.95,  // 2 of 4 — gentle ease
  1: 0.90,  // 1 of 4 — recovery
  0: 0.90,  // 0 of 4 — recovery
});

// Activity factor — based on alliance composition (average Activity Power across active members).
// Replaces the previous archetype-based factor: archetype is now descriptive prose only.
const ACTIVITY_FACTOR_LOW = 0.85;
const ACTIVITY_FACTOR_MIXED = 1.00;
const ACTIVITY_FACTOR_HIGH = 1.15;
const ACTIVITY_FACTOR_LOW_THRESHOLD = 1500;
const ACTIVITY_FACTOR_HIGH_THRESHOLD = 4000;

// Contribution Points (CP) — value per unit of contribution
const CP_PER_UNIT = Object.freeze({
  long_march:      1,           // 1 km = 1 CP
  the_forge:       1 / 25,      // 25 kcal = 1 CP
  the_step_wall:   1 / 500,     // 500 steps = 1 CP
  hard_days:       30,          // 1 Hard challenge = 30 CP
  streak_wall:     100,         // boolean — 100 CP if held
  the_push:        25,          // 1 contest win = 25 CP
  land_grab:       20,          // 1 claim = 20 CP
  ground_up:       50,          // 1 dev tier = 50 CP
  iron_investment: 0.5,         // 2 Iron spent = 1 CP
  the_long_walk:   5,           // 1 km = 5 CP
  // coordination missions credit 100 CP per qualifying participation
  coordination:    100,
});

// Reward base values per mission category — these are alliance-wide pools,
// not per-member values. Distributed via the 50/35/15 hybrid model.
const MISSION_REWARDS = Object.freeze({
  endurance:    { morale: 480, gold: 360, xp: 250 },
  conquest:     { morale: 600, gold: 500, xp: 350 },
  coordination: { morale: 720, gold: 400, xp: 300 },
});

// Reward distribution split — must sum to 1.0
const REWARD_SPLIT = Object.freeze({
  participation: 0.50,
  contribution:  0.35,
  hero:          0.15,
});

// Hero bonus distribution among top 3 (must sum to REWARD_SPLIT.hero)
const HERO_RANK_SPLIT = Object.freeze({
  1: 0.07,  // 7% of total pool
  2: 0.05,
  3: 0.03,
});

// Completion factor based on % of target achieved
const COMPLETION_BANDS = Object.freeze([
  { minPct: 1.00, factor: 1.00 },
  { minPct: 0.80, factor: 0.60 },
  { minPct: 0.60, factor: 0.30 },
  { minPct: 0.00, factor: 0.00 },
]);

// Failure compensation — % of participation share paid even on full failure
const FAILURE_PARTICIPATION_FACTOR = 0.50;

// War chest deposit — % of total Morale pool deposited to chest on top of distributions
const WAR_CHEST_DEPOSIT_PCT = 0.30;

// Mission streak tiers — week thresholds and bonuses.
// capBonus is the +full-value-cap bonus to all members while at this tier.
const MISSION_STREAK_TIERS = Object.freeze([
  { minWeeks: 52, tier: 'eternal_bond',       rewardBonusPct: 0.25, capBonus: 1 },
  { minWeeks: 30, tier: 'unbroken_together',  rewardBonusPct: 0.20, capBonus: 1 },
  { minWeeks: 16, tier: 'iron_forged',        rewardBonusPct: 0.15, capBonus: 0 },
  { minWeeks: 8,  tier: 'synchronised',       rewardBonusPct: 0.10, capBonus: 0 },
  { minWeeks: 4,  tier: 'aligned',            rewardBonusPct: 0.05, capBonus: 0 },
  { minWeeks: 1,  tier: 'forming',            rewardBonusPct: 0.00, capBonus: 0 },
  { minWeeks: 0,  tier: 'none',               rewardBonusPct: 0.00, capBonus: 0 },
]);

// Mission Grace Week — earned every N weeks of streak, max stored.
// If alliance has a stored Grace Week at a milestone, the new grant is suppressed.
const GRACE_WEEK_EARN_INTERVAL = 12;
const GRACE_WEEK_BANK_CAP = 1;

// Streak completion threshold — mission counts as completed for streak purposes
const STREAK_COMPLETION_THRESHOLD_PCT = 0.60;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function _assertTier(tier) {
  if (!TIERS.includes(tier)) {
    throw new Error(`Invalid tier: ${tier}. Must be one of ${TIERS.join(', ')}.`);
  }
}

/**
 * Normalises a tier string from any case to strict title-case.
 * DB stores tiers as lowercase (check constraint enforced); formulas.js requires
 * strict title-case (Small/Medium/Large/Epic). Use this at every boundary
 * between the DB layer and formulas.js lookups.
 *
 * @param {string} tier — 'small' | 'medium' | 'large' | 'epic' (any case)
 * @returns {string} 'Small' | 'Medium' | 'Large' | 'Epic'
 * @throws if input is not a recognised tier
 */
function normaliseTier(tier) {
  const out = TIER_NORMALISER[tier];
  if (!out) throw new Error(`Invalid tier: ${tier}`);
  return out;
}

function _assertChallengeTier(tier) {
  if (!CHALLENGE_TIERS.includes(tier)) {
    throw new Error(`Invalid challenge tier: ${tier}. Must be one of ${CHALLENGE_TIERS.join(', ')}.`);
  }
}

function _assertDevLevel(level) {
  if (!DEV_LEVELS.includes(level)) {
    throw new Error(`Invalid dev level: ${level}. Must be 0–4.`);
  }
}

function _assertLegacyRank(rank) {
  if (!LEGACY_RANKS.includes(rank)) {
    throw new Error(`Invalid legacy rank: ${rank}. Must be 1–5.`);
  }
}

function _assertNonNegInt(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer. Got: ${value}`);
  }
}

function _assertNonNegNumber(value, name) {
  if (typeof value !== 'number' || value < 0 || Number.isNaN(value)) {
    throw new Error(`${name} must be a non-negative number. Got: ${value}`);
  }
}

// =============================================================================
// 1. CANONICAL EARN CALCULATION
// =============================================================================

/**
 * Canonical Earn Calculation — applies caps and bonuses in the correct order.
 * All earn modifiers (XP and resources) follow this formula.
 *
 *   final_earn = round(base_earn × cap_factor × bonus_product)
 *
 * Where bonus_product is the product of all active bonus multipliers, hard-capped
 * at BONUS_PRODUCT_CAP (3.0) to prevent pathological stacking.
 *
 * Order of operations:
 *   1. Determine base earn for the action.
 *   2. Apply cap_factor for the matching activity type (caps reduce base before bonuses).
 *   3. Multiply by bonus_product (computed from all active bonuses, capped at 3.0).
 *   4. Round to integer.
 *
 * @param {Object} opts
 * @param {number} opts.baseEarn — the source value of the earn event
 * @param {number} opts.capFactor — health/wellbeing cap effectiveness, default 1.0
 * @param {Array<number>} opts.bonusMultipliers — e.g. [1.10, 1.20, 2.0]
 * @returns {number} integer final earn
 */
function calcCanonicalEarn(opts) {
  const { baseEarn, capFactor = 1.0, bonusMultipliers = [] } = opts;
  _assertNonNegNumber(baseEarn, 'baseEarn');
  _assertNonNegNumber(capFactor, 'capFactor');
  if (!Array.isArray(bonusMultipliers)) {
    throw new Error('bonusMultipliers must be an array');
  }

  const rawProduct = bonusMultipliers.reduce((acc, m) => acc * m, 1.0);
  const cappedProduct = Math.min(rawProduct, BONUS_PRODUCT_CAP);
  return Math.round(baseEarn * capFactor * cappedProduct);
}

// =============================================================================
// 2. LEVEL & XP
// =============================================================================

/**
 * Returns the player's current level (1–10) given cumulative Siege XP.
 */
function calcLevel(cumulativeXp) {
  _assertNonNegInt(cumulativeXp, 'cumulativeXp');
  for (let i = LEVEL_XP_FLOORS.length - 1; i >= 0; i--) {
    if (cumulativeXp >= LEVEL_XP_FLOORS[i]) return i + 1;
  }
  return 1;
}

/**
 * Returns the player's progress through the current level as a 0–1 value.
 * Returns 1.0 at Level 10 (no further progression).
 */
function calcLevelProgress(cumulativeXp) {
  _assertNonNegInt(cumulativeXp, 'cumulativeXp');
  const level = calcLevel(cumulativeXp);
  if (level >= 10) return 1.0;
  const floor = LEVEL_XP_FLOORS[level - 1];
  const ceiling = LEVEL_XP_FLOORS[level];
  return (cumulativeXp - floor) / (ceiling - floor);
}

function getLevelTitle(level) {
  if (level < 1 || level > 10) throw new Error(`Invalid level: ${level}`);
  return LEVEL_TITLES[level - 1];
}

/**
 * Returns the streak tier and multiplier for a given streak length.
 */
function getStreakTier(streakDays) {
  _assertNonNegInt(streakDays, 'streakDays');
  for (const t of STREAK_TIER_THRESHOLDS) {
    if (streakDays >= t.days) return { tier: t.tier, multiplier: t.multiplier };
  }
  return { tier: 'newcomer', multiplier: 1.00 };
}

/**
 * Streak multiplier applied to defence and attack — same function for both.
 * Capped per territory tier for Large/Epic.
 */
function calcStreakMultiplier(streakDays, territoryTier) {
  _assertTier(territoryTier);
  const base = getStreakTier(streakDays).multiplier;
  return Math.min(base, STREAK_MULT_TIER_CAP[territoryTier]);
}

/**
 * Calculates final XP for a challenge completion.
 * Routes through calcCanonicalEarn — modifiers stack multiplicatively, capped at 3.0.
 *
 * @param {Object} opts
 * @param {string} opts.tier — 'easy' | 'medium' | 'hard'
 * @param {number} opts.streakDays
 * @param {boolean} opts.isCityEvent
 * @param {boolean} opts.isSupplyLineActive — alliance has Supply Line ability active
 * @param {number} opts.capFactor — 0.0 to 1.0, default 1.0 (no cap reduction)
 * @returns {number} integer XP awarded
 */
function calcChallengeXp(opts) {
  const {
    tier,
    streakDays = 0,
    isCityEvent = false,
    isSupplyLineActive = false,
    capFactor = 1.0,
  } = opts;
  _assertChallengeTier(tier);
  _assertNonNegInt(streakDays, 'streakDays');

  const baseXp = XP_PER_CHALLENGE[tier];
  const streakMult = getStreakTier(streakDays).multiplier;
  const eventMult = isCityEvent ? 1.5 : 1.0;
  const supplyMult = isSupplyLineActive ? SUPPLY_LINE_BONUS_MULT : 1.0;

  return calcCanonicalEarn({
    baseEarn: baseXp,
    capFactor,
    bonusMultipliers: [streakMult, eventMult, supplyMult],
  });
}

function calcDefenceWinXp(tier) { _assertTier(tier); return XP_PER_DEFENCE_WIN[tier]; }
function calcReconquestXp() { return XP_RECONQUEST; }
function calcDevTierReachedXp() { return XP_PER_DEV_TIER_REACHED; }
function calcAllianceMissionXp() { return XP_ALLIANCE_MISSION; }
function calcStreakMilestoneXp() { return XP_STREAK_MILESTONE; }

/**
 * Returns the full-value territory cap for a player.
 *
 * Per v6.10 §2.1 — base cap plus optional bonuses:
 *   + 1 if Unbroken streak (30–59 days) — mutually exclusive with Legendary
 *   + 2 if Legendary streak (60+ days)
 *   + 3 if at Level 10 (Dominator)
 *   + 2 if alliance has won an annual championship
 *   + 1 if alliance at "Unbroken Together" mission streak tier or higher (30+ weeks)
 *
 * @param {Object} opts
 * @param {number} opts.level — 1–10
 * @param {boolean} opts.isUnbrokenStreak — 30–59 day streak (mutually exclusive with Legendary)
 * @param {boolean} opts.isLegendaryStreak — 60+ day streak (mutually exclusive with Unbroken)
 * @param {boolean} opts.isAllianceChampion — alliance has won an annual championship
 * @param {boolean} opts.isUnbrokenTogetherTier — alliance at Unbroken Together (30+ weeks) or Eternal Bond (52+ weeks)
 * @returns {number} integer full-value cap
 */
function calcFullValueCap(opts) {
  const {
    level,
    isUnbrokenStreak = false,
    isLegendaryStreak = false,
    isAllianceChampion = false,
    isUnbrokenTogetherTier = false,
  } = opts;
  if (level < 1 || level > 10) throw new Error(`Invalid level: ${level}`);

  let cap = FULL_VALUE_CAP_BASE + level * FULL_VALUE_CAP_PER_LEVEL;

  if (level === 10) cap += FULL_VALUE_CAP_DOMINATOR_BONUS;

  // Streak bonuses don't stack — Unbroken OR Legendary, not both
  if (isLegendaryStreak) {
    cap += FULL_VALUE_CAP_LEGENDARY_BONUS;
  } else if (isUnbrokenStreak) {
    cap += FULL_VALUE_CAP_UNBROKEN_BONUS;
  }

  if (isAllianceChampion) cap += FULL_VALUE_CAP_CHAMPIONSHIP_BONUS;
  if (isUnbrokenTogetherTier) cap += FULL_VALUE_CAP_UNBROKEN_TOGETHER_BONUS;

  return cap;
}

/**
 * Returns the full-value territory cap for a player at the given level,
 * with no streak or championship bonuses applied.
 *
 * Use this for display and cap-check logic in screens where bonus inputs
 * are not yet wired. When streak and championship state are available,
 * call calcFullValueCap() directly with the full opts object.
 *
 * @param {number} level — player level 1–10
 * @returns {number} territory cap
 */
function calcTerritoryCapForLevel(level) {
  return calcFullValueCap({ level });
}

// =============================================================================
// 3. RESOURCE EARN
// =============================================================================

/**
 * Returns the resources earned for a single event (challenge, contest, etc).
 * Returns a clone of the static reward record. For final earn after caps and
 * bonuses, route the resource value through calcCanonicalEarn.
 *
 * @param {string} eventKey — one of RESOURCE_EARN keys
 * @returns {Object} { iron, stone, gold, morale }
 */
function calcResourceEarn(eventKey) {
  if (!RESOURCE_EARN[eventKey]) {
    throw new Error(`Unknown resource event: ${eventKey}`);
  }
  return { ...RESOURCE_EARN[eventKey] };
}

/**
 * Returns Siege XP awarded for claiming a territory of the given tier.
 * Base value only — modifiers (streak, supply line, city event) deferred.
 */
function calcClaimXp(tier) {
  _assertTier(tier);
  return CLAIM_XP[tier];
}

/**
 * Returns Siege XP awarded for winning a contest of the given tier.
 * Base value only — modifiers (streak, supply line, city event) deferred.
 */
function calcContestWinXp(tier) {
  _assertTier(tier);
  return CONTEST_WIN_XP[tier];
}

/**
 * Converts Gold to another resource. Returns the integer amount received.
 *
 * Per v6.10 §5.1.1: Gold is the only convertible source resource.
 * - Gold→Iron: 50%, Level 1+
 * - Gold→Stone: 60%, Level 1+
 * - Gold→Morale: 40%, Level 6+ (caller enforces gate)
 *
 * Converted resources land in the player's personal wallet.
 */
function convertGold(goldAmount, targetResource) {
  _assertNonNegInt(goldAmount, 'goldAmount');
  if (!GOLD_CONVERSION[targetResource]) {
    throw new Error(`Cannot convert Gold to: ${targetResource}`);
  }
  return Math.floor(goldAmount * GOLD_CONVERSION[targetResource]);
}

/**
 * Applies weekly Morale decay to a personal wallet balance.
 *
 * Per v6.10 §3.8 and §5.5: decay applies regardless of alliance membership status.
 * A player who has left their alliance and remains unaffiliated will continue to
 * see their personal Morale decay 5%/week.
 *
 * War chest balances do NOT decay — do not call this on them.
 */
function applyMoraleDecay(currentMorale) {
  _assertNonNegNumber(currentMorale, 'currentMorale');
  return Math.floor(currentMorale * (1 - MORALE_PERSONAL_DECAY_PER_WEEK));
}

// =============================================================================
// 4. CHALLENGE EFFECTIVENESS (wellbeing)
// =============================================================================

function _bandLookup(value, bands) {
  for (const b of bands) {
    if (value <= b.max) return b.effectiveness;
  }
  return 0;
}

function stepEffectiveness(stepsToday) {
  _assertNonNegInt(stepsToday, 'stepsToday');
  return _bandLookup(stepsToday, STEP_BANDS);
}

function calorieEffectiveness(kcalToday) {
  _assertNonNegNumber(kcalToday, 'kcalToday');
  return _bandLookup(kcalToday, CALORIE_BANDS);
}

function sessionEffectiveness(activeMinutes) {
  _assertNonNegNumber(activeMinutes, 'activeMinutes');
  return _bandLookup(activeMinutes, SESSION_BANDS);
}

/**
 * Returns the weekly step cap multiplier — 1.0 normally, 0.5 once over cap.
 */
function weeklyStepFactor(weeklyStepsTotal) {
  _assertNonNegInt(weeklyStepsTotal, 'weeklyStepsTotal');
  return weeklyStepsTotal <= WEEKLY_STEP_CAP ? 1.0 : WEEKLY_OVER_CAP_FACTOR;
}

/**
 * Returns the appropriate effectiveness multiplier for a given challenge type.
 * Each cap applies only to its matching challenge type (per v6.10 §13.6).
 *
 * Returned value can be passed directly as capFactor to calcCanonicalEarn.
 */
function effectivenessForChallenge(challengeType, playerDailyStats) {
  const { stepsToday = 0, kcalToday = 0, longestSessionMin = 0,
          weeklyStepsTotal = 0 } = playerDailyStats;
  let eff;
  switch (challengeType) {
    case 'steps':
      eff = stepEffectiveness(stepsToday) * weeklyStepFactor(weeklyStepsTotal);
      break;
    case 'calories':
      eff = calorieEffectiveness(kcalToday);
      break;
    case 'distance':
    case 'session':
      eff = sessionEffectiveness(longestSessionMin);
      break;
    default:
      throw new Error(`Unknown challenge type: ${challengeType}`);
  }
  return eff;
}

// =============================================================================
// 5. INFLUENCE
// =============================================================================

/**
 * Computes daily Influence generation for a single territory.
 * Returns INTEGER fixed-point value (×10) to avoid float drift.
 *
 * Uses the tier-specific Influence multiplier (DEV_INFLUENCE_MULT) — distinct
 * from the Territory Power multiplier and the Contest multiplier.
 *
 * @param {Object} territory
 * @param {string} territory.tier
 * @param {number} territory.developmentLevel — 0–4
 * @param {number} territory.legacyRank — 1–5
 * @returns {number} integer Influence × 10
 */
function calcDailyInfluenceFixedPoint(territory) {
  const { tier, developmentLevel, legacyRank } = territory;
  _assertTier(tier);
  _assertDevLevel(developmentLevel);
  _assertLegacyRank(legacyRank);

  const base = TERRITORY_BASE_INFLUENCE[tier];
  const rankMult = LEGACY_RANK_INFLUENCE_MULT[legacyRank];
  const devMult = DEV_INFLUENCE_MULT[tier][developmentLevel];

  const raw = base * rankMult * devMult;
  return Math.round(raw * INFLUENCE_FIXED_POINT_SCALE);
}

/**
 * Convenience: returns daily Influence as a display number (float).
 * Use calcDailyInfluenceFixedPoint for storage/accumulation.
 */
function calcDailyInfluence(territory) {
  return calcDailyInfluenceFixedPoint(territory) / INFLUENCE_FIXED_POINT_SCALE;
}

/**
 * Converts a fixed-point Influence value back to display number (1 decimal place).
 */
function influenceToDisplay(fixedPoint) {
  return fixedPoint / INFLUENCE_FIXED_POINT_SCALE;
}

// =============================================================================
// 6. TERRITORY DEVELOPMENT
// =============================================================================

/**
 * Returns the resource cost to advance from one dev level to another.
 * Caller is responsible for ensuring current player+territory state can pay.
 *
 * @returns {Object} { stone, iron, gold, influence }
 */
function calcDevCost(fromLevel, toLevel) {
  _assertDevLevel(fromLevel);
  _assertDevLevel(toLevel);
  if (toLevel <= fromLevel) {
    throw new Error(`toLevel (${toLevel}) must be greater than fromLevel (${fromLevel})`);
  }
  const from = DEV_COST[fromLevel];
  const to = DEV_COST[toLevel];
  return {
    stone:     to.stone - from.stone,
    iron:      to.iron - from.iron,
    gold:      to.gold - from.gold,
    influence: to.influence - from.influence,
  };
}

/**
 * Returns the cumulative cost to reach a given dev level from D0.
 */
function getCumulativeDevCost(level) {
  _assertDevLevel(level);
  return { ...DEV_COST[level] };
}

// =============================================================================
// 7. CONTEST DISTANCE
// =============================================================================

/**
 * Computes the required walk distance (metres) for a contest.
 *
 * Canonical formula per v6.10 §4.2.1:
 *
 *   required_walk = perimeter
 *                 × (defender_streak_mult / attacker_streak_mult)
 *                 × development_mult
 *                 × rally_cry_mult
 *                 × siege_boost_mult
 *
 * Steadfast does not enter this formula — it modifies the defender response
 * ratio in calcRequiredDefenderWalk.
 *
 * Result capped at 2.0 × perimeter (sanity cap), rounded to nearest 10m.
 *
 * @param {Object} opts
 * @param {Object} opts.territory — { tier, perimeterMeters, developmentLevel }
 * @param {Object} opts.attacker — { streakDays, usedSiegeBoost, allianceBuffs[] }
 * @param {Object} opts.defender — { streakDays }
 * @returns {number} required metres, rounded to nearest CONTEST_WALK_ROUNDING_M
 */
function calcRequiredContestWalk(opts) {
  const { territory, attacker, defender } = opts;
  _assertTier(territory.tier);
  _assertNonNegNumber(territory.perimeterMeters, 'territory.perimeterMeters');
  _assertDevLevel(territory.developmentLevel);

  const attackerBuffs = attacker.allianceBuffs || [];

  const atkMult = calcStreakMultiplier(attacker.streakDays, territory.tier);
  const defMult = calcStreakMultiplier(defender.streakDays, territory.tier);
  const streakRatio = defMult / atkMult;

  const devFactor = DEV_CONTEST_MULT[territory.developmentLevel];
  const rallyCryFactor = attackerBuffs.includes('rally_cry') ? RALLY_CRY_FACTOR : 1.0;
  const siegeFactor = attacker.usedSiegeBoost ? SIEGE_BOOST_DISTANCE_FACTOR : 1.0;

  let required = territory.perimeterMeters
    * streakRatio
    * devFactor
    * rallyCryFactor
    * siegeFactor;

  // Sanity cap — no contest can ever require more than 2× perimeter
  required = Math.min(required, territory.perimeterMeters * REQUIRED_WALK_HARD_CAP);

  // Round to nearest 10m for clean display and locking
  return Math.round(required / CONTEST_WALK_ROUNDING_M) * CONTEST_WALK_ROUNDING_M;
}

/**
 * Computes the defender's required walk based on the attacker's actual walked distance.
 *
 * Per v6.10 §3.6:
 *   - With Stone activation (10 Stone): 1:1 ratio (defender matches attacker walk)
 *   - Without Stone: 1.25:1 ratio (defender walks 25% more)
 *   - With Steadfast active: response ratio reduced to 0.8 of the above
 *     (so 0.8:1 with Stone, 1.0:1 without — Steadfast turns the disadvantage into parity)
 */
function calcRequiredDefenderWalk(opts) {
  const { attackerActualWalked, defenderPaidActivation, defenderHasSteadfast = false } = opts;
  _assertNonNegNumber(attackerActualWalked, 'attackerActualWalked');

  let ratio = defenderPaidActivation ? 1.0 : FREE_DEFENCE_RATIO;
  if (defenderHasSteadfast) ratio *= STEADFAST_DEF_FACTOR;
  return Math.round(attackerActualWalked * ratio);
}

// =============================================================================
// 8. TERRITORY ARMOUR (priced in Stone)
// =============================================================================

const ARMOUR_COSTS = Object.freeze({
  Small:  { 6: 10,  12: 20,  24: 40,  48: 80   },
  Medium: { 6: 20,  12: 40,  24: 80,  48: 160  },
  Large:  { 6: 35,  12: 70,  24: 140, 48: null },
  Epic:   { 6: 50,  12: 100, 24: 200, 48: null },
});

function calcArmourCost(tier, durationHours) {
  _assertTier(tier);
  const cost = ARMOUR_COSTS[tier][durationHours];
  if (cost === undefined) {
    throw new Error(`Invalid armour duration ${durationHours}h. Use 6, 12, 24, or 48.`);
  }
  if (cost === null) {
    throw new Error(`${durationHours}h armour not available for ${tier} tier.`);
  }
  return cost;
}

// =============================================================================
// 9. POWER (the unifying metric)
// =============================================================================

/**
 * Activity Power — rolling 30-day commitment metric.
 *
 * @param {Object} stats — rolling 30-day totals
 * @returns {number} integer Activity Power
 */
function calcActivityPower(stats) {
  const { xp30d = 0, km30d = 0, challenges30d = 0, contests30d = 0 } = stats;
  const w = ACTIVITY_POWER_WEIGHTS;
  const power = xp30d * w.xp_30d
              + km30d * w.km_30d
              + challenges30d * w.challenges_30d
              + contests30d * w.contests_30d;
  return Math.round(power);
}

/**
 * Power contribution from a single territory.
 * Uses the tier-blind Territory Power multiplier (DEV_POWER_MULT).
 */
function calcTerritoryPowerSingle(territory, isAboveCap) {
  const { tier, developmentLevel, legacyRank } = territory;
  _assertTier(tier);
  _assertDevLevel(developmentLevel);
  _assertLegacyRank(legacyRank);

  const base = TERRITORY_BASE_POWER[tier];
  const devMult = DEV_POWER_MULT[developmentLevel];
  const rankMult = LEGACY_RANK_POWER_MULT[legacyRank];
  const capFactor = isAboveCap ? ABOVE_CAP_VALUE_FACTOR : 1.0;
  return base * devMult * rankMult * capFactor;
}

/**
 * Computes Territory Power across all owned territories.
 *
 * @param {Array} territories — array of territory objects
 * @param {number} fullValueCap — player's full-value cap
 * @returns {number} integer Territory Power
 *
 * Above-cap rule: territories are sorted by base value descending; the first
 * `fullValueCap` count earn full value, the rest are halved. This rewards
 * holding higher-tier territories at full value.
 */
function calcTerritoryPower(territories, fullValueCap) {
  _assertNonNegInt(fullValueCap, 'fullValueCap');
  if (!Array.isArray(territories)) {
    throw new Error('territories must be an array');
  }
  // Rank by tier base value desc, then by dev level desc, then by legacy rank desc.
  // Highest-value territories get full value; the rest spill to half value.
  const sorted = [...territories].sort((a, b) => {
    const aScore = TERRITORY_BASE_POWER[a.tier] * 1000
                 + a.developmentLevel * 10
                 + a.legacyRank;
    const bScore = TERRITORY_BASE_POWER[b.tier] * 1000
                 + b.developmentLevel * 10
                 + b.legacyRank;
    return bScore - aScore;
  });
  let total = 0;
  sorted.forEach((t, idx) => {
    const aboveCap = idx >= fullValueCap;
    total += calcTerritoryPowerSingle(t, aboveCap);
  });
  return Math.round(total);
}

/**
 * Legacy Power — permanent lifetime accomplishment.
 */
function calcLegacyPower(stats) {
  const {
    titlesEarned = 0,
    championshipWins = 0,
    lifetimeContestWins = 0,
    lifetimeDefenceWins = 0,
    highestStreakDays = 0,
    lifetimeXp = 0,
  } = stats;
  const w = LEGACY_POWER_WEIGHTS;
  const power = titlesEarned * w.per_title
              + championshipWins * w.per_championship
              + (lifetimeContestWins + lifetimeDefenceWins) * w.per_contest_win
              + highestStreakDays * w.per_streak_day
              + Math.floor(lifetimeXp / w.xp_divisor);
  return Math.round(power);
}

/**
 * Honor / Legacy Medal Power — computed from the Honor Medal state returned by
 * GET /legacy/medals. Replaces calcLegacyPower as the legacy contributor to
 * Total Power. Pass the `medals` array from the API; returns 0 for null/empty.
 */
function calcMedalPower(medals) {
  if (!Array.isArray(medals)) return 0;
  const w = MEDAL_POWER_WEIGHTS;
  let power = 0;
  for (const m of medals) {
    if (m?.type === 'tiered') {
      if (m.currentTier) power += w[m.currentTier] || 0;
    } else if (m?.type === 'singular_count') {
      power += Math.min((Number(m.count) || 0) * w.per_count, w.count_cap);
    } else if (m?.type === 'singular_oneoff') {
      if (m.earned) power += w.one_off;
    }
  }
  return Math.round(power);
}

/**
 * Total Power — the unifying leaderboard metric.
 *
 * @param {Object} player — { activityStats, territories, legacyStats, fullValueCap }
 */
function calcTotalPower(player) {
  const { activityStats, territories, legacyStats, fullValueCap } = player;
  const a = calcActivityPower(activityStats);
  const t = calcTerritoryPower(territories, fullValueCap);
  const l = calcLegacyPower(legacyStats);
  return {
    activity: a,
    territory: t,
    legacy: l,
    total: a + t + l,
  };
}

/**
 * Alliance Power — sum of member Power × coordination multiplier.
 *
 * Per v6.10 §10.2: Alliance Power is the alliance's equivalent of individual Power.
 * Used as the canonical ranking metric for all alliance leaderboards and for
 * monthly, quarterly, and annual alliance win conditions.
 *
 * @param {Array} memberPowers — array of { activityPower, totalPower }
 * @returns {Object} { basePower, participationRate, coordinationMult, alliancePower }
 */
function calcAlliancePower(memberPowers) {
  if (!Array.isArray(memberPowers) || memberPowers.length === 0) {
    throw new Error('memberPowers must be a non-empty array');
  }
  const basePower = memberPowers.reduce((sum, m) => sum + m.totalPower, 0);
  const activeMembers = memberPowers.filter(
    m => m.activityPower >= ALLIANCE_PARTICIPATION_THRESHOLD_POWER
  ).length;
  const participationRate = activeMembers / memberPowers.length;
  const coordinationMult = ALLIANCE_COORD_BASE
                         + (participationRate * ALLIANCE_COORD_MAX_BONUS);
  return {
    basePower,
    participationRate,
    coordinationMult,
    alliancePower: Math.round(basePower * coordinationMult),
  };
}

// =============================================================================
// 10. LEGACY RANK
// =============================================================================

/**
 * Computes a territory's Legacy Rank from its history.
 *
 * Per v6.10 §9.2:
 *   - Ranks 2–4 use longest single continuous hold by any one owner.
 *   - Rank 5 uses total cumulative hold time across all owners.
 *
 * @param {Object} stats
 * @param {number} stats.ownershipChanges
 * @param {number} stats.maxSingleHoldDays — longest single hold by any one owner
 * @param {number} stats.totalCumulativeHoldDays — sum across all owners
 * @param {number} stats.distinctAlliancesHeld
 * @param {number} stats.developmentLevel
 * @returns {number} legacy rank 1–5
 */
function calcLegacyRank(stats) {
  const {
    ownershipChanges = 0,
    maxSingleHoldDays = 0,
    totalCumulativeHoldDays = 0,
    distinctAlliancesHeld = 0,
    developmentLevel = 0,
  } = stats;

  // Rank 5 — Legendary
  if (ownershipChanges >= 10
      && (totalCumulativeHoldDays >= 120 || developmentLevel === 4)) {
    return 5;
  }
  // Rank 4 — Contested Ground
  if (ownershipChanges >= 6
      || distinctAlliancesHeld >= 3
      || developmentLevel >= 3) {
    return 4;
  }
  // Rank 3 — Contested
  if (ownershipChanges >= 3
      || maxSingleHoldDays >= 60
      || developmentLevel >= 2) {
    return 3;
  }
  // Rank 2 — Established
  if (ownershipChanges >= 1
      || maxSingleHoldDays >= 21
      || developmentLevel >= 1) {
    return 2;
  }
  return 1;
}

  function legacyRankName(rank) {
    const names = { 1: 'Unproven', 2: 'Established', 3: 'Contested', 4: 'Contested Ground', 5: 'Legendary' };
    return names[rank] || 'Unproven';
  }

// =============================================================================
// 11. DISTANCE & VELOCITY
// =============================================================================

/**
 * Converts step count to distance using the player's calibrated stride.
 *
 * Per v6.10 §7.3: stride is auto-calibrated from GPS-verified outdoor walks
 * after 3+ qualifying sessions. Default 0.75 m/step for uncalibrated players.
 */
function stepsToKm(steps, strideMeters = DEFAULT_STRIDE_M) {
  _assertNonNegInt(steps, 'steps');
  _assertNonNegNumber(strideMeters, 'strideMeters');
  return (steps * strideMeters) / 1000;
}

/**
 * Returns true if the per-minute step rate implies a velocity above the cap.
 * Caller passes the steps observed in a single 60-second window.
 */
function isStepWindowOverVelocityCap(stepsInOneMinute, strideMeters = DEFAULT_STRIDE_M) {
  const distancePerMinKm = (stepsInOneMinute * strideMeters) / 1000;
  const kmh = distancePerMinKm * 60;
  return kmh > MAX_PLAUSIBLE_KMH;
}

// =============================================================================
// 12. ALLIANCE ABILITIES
// =============================================================================

function getAbility(name) {
  if (!ALLIANCE_ABILITY[name]) {
    throw new Error(`Unknown alliance ability: ${name}`);
  }
  return { ...ALLIANCE_ABILITY[name] };
}

/**
 * Validates whether an alliance can activate a new ability.
 */
function canActivateAbility(opts) {
  const { abilityName, currentlyActiveCount, weeklyMoraleSpentSoFar, warChestMorale } = opts;
  const ability = getAbility(abilityName);

  if (currentlyActiveCount >= MAX_ACTIVE_ABILITIES_PER_ALLIANCE) {
    return { allowed: false, reason: 'too_many_active' };
  }
  if (warChestMorale < ability.cost) {
    return { allowed: false, reason: 'insufficient_morale' };
  }
  if (weeklyMoraleSpentSoFar + ability.cost > ALLIANCE_MORALE_WEEKLY_SPEND_CAP) {
    return { allowed: false, reason: 'weekly_cap_exceeded' };
  }
  return { allowed: true, cost: ability.cost };
}

// =============================================================================
// 13. ALLIANCE MISSIONS
// =============================================================================

/**
 * Returns true if a player qualifies as an active member.
 * Activity Power 500 in last 30 days is the canonical eligibility threshold
 * (per v6.10 Glossary "Active member").
 */
function isActiveMember(activityPower) {
  _assertNonNegNumber(activityPower, 'activityPower');
  return activityPower >= MISSION_ELIGIBILITY_ACTIVITY_POWER;
}

/**
 * Counts active members in an alliance from an array of member activity powers.
 */
function countActiveMembers(memberActivityPowers) {
  if (!Array.isArray(memberActivityPowers)) {
    throw new Error('memberActivityPowers must be an array');
  }
  return memberActivityPowers.filter(isActiveMember).length;
}

/**
 * Computes the activity_factor for alliance mission target scaling.
 * Based on the average Activity Power across the alliance's active members.
 *
 * Per v6.10 §3.10.5:
 *   < 1500 → 0.85 (low-activity alliance)
 *   1500–3999 → 1.00 (mixed)
 *   ≥ 4000 → 1.15 (high-activity alliance)
 *
 * Returns ACTIVITY_FACTOR_MIXED if there are zero active members
 * (guards against division by zero on small/inactive alliances).
 */
function calcActivityFactor(memberActivityPowers) {
  if (!Array.isArray(memberActivityPowers)) {
    throw new Error('memberActivityPowers must be an array');
  }
  const activeMembers = memberActivityPowers.filter(
    ap => ap >= MISSION_ELIGIBILITY_ACTIVITY_POWER
  );
  if (activeMembers.length === 0) return ACTIVITY_FACTOR_MIXED;

  const sum = activeMembers.reduce((s, ap) => s + ap, 0);
  const avg = sum / activeMembers.length;

  if (avg < ACTIVITY_FACTOR_LOW_THRESHOLD) return ACTIVITY_FACTOR_LOW;
  if (avg >= ACTIVITY_FACTOR_HIGH_THRESHOLD) return ACTIVITY_FACTOR_HIGH;
  return ACTIVITY_FACTOR_MIXED;
}

/**
 * Returns the difficulty multiplier based on the alliance's recent mission
 * completion record. Counts last 4 missions completed at >= 60% of target.
 */
function calcDifficultyMultiplier(last4MissionsCompletedCount) {
  _assertNonNegInt(last4MissionsCompletedCount, 'last4MissionsCompletedCount');
  const clamped = Math.min(4, last4MissionsCompletedCount);
  return DIFFICULTY_MULT[clamped];
}

/**
 * Computes the target value for an Endurance mission.
 *
 * Per v6.10 §3.10.5:
 *   target = ceil(base_per_active_member × active_members × difficulty × activity_factor)
 *
 * Streak Wall is a special case: target equals active_members count,
 * multipliers do not apply (every active member must hold their streak).
 *
 * @param {Object} opts
 * @param {string} opts.missionType — must be an endurance mission key
 * @param {number} opts.activeMemberCount
 * @param {number} opts.last4MissionsCompletedCount
 * @param {Array<number>} opts.memberActivityPowers — for activity factor calc
 * @returns {number} target value (km, kcal, steps, etc.) — rounded sensibly
 */
function calcEnduranceTarget(opts) {
  const { missionType, activeMemberCount, last4MissionsCompletedCount,
          memberActivityPowers } = opts;
  const mission = MISSION_CATALOG[missionType];
  if (!mission || mission.category !== 'endurance') {
    throw new Error(`Not an endurance mission: ${missionType}`);
  }
  _assertNonNegInt(activeMemberCount, 'activeMemberCount');

  // Streak Wall: target = active member count. Multipliers do not apply.
  if (mission.unit === 'boolean') return activeMemberCount;

  const difficulty = calcDifficultyMultiplier(last4MissionsCompletedCount);
  const activityFactor = calcActivityFactor(memberActivityPowers);
  const raw = mission.base_per_member * activeMemberCount * difficulty * activityFactor;

  // Round up to nearest sensible unit
  if (mission.unit === 'km') return Math.ceil(raw);
  if (mission.unit === 'kcal') return Math.round(raw / 100) * 100;
  if (mission.unit === 'steps') return Math.round(raw / 1000) * 1000;
  if (mission.unit === 'hard_challenges') return Math.ceil(raw);
  return Math.ceil(raw);
}

/**
 * Computes the target value for a Conquest mission.
 *
 * Per v6.10 §3.10.5:
 *   target = ceil(base_per_active_member × active_members × difficulty)
 *
 * Conquest targets are floored at CONQUEST_TARGET_FLOOR.
 */
function calcConquestTarget(opts) {
  const { missionType, activeMemberCount, last4MissionsCompletedCount } = opts;
  const mission = MISSION_CATALOG[missionType];
  if (!mission || mission.category !== 'conquest') {
    throw new Error(`Not a conquest mission: ${missionType}`);
  }
  _assertNonNegInt(activeMemberCount, 'activeMemberCount');

  const difficulty = calcDifficultyMultiplier(last4MissionsCompletedCount);
  const raw = mission.base_per_member * activeMemberCount * difficulty;
  const target = Math.ceil(raw);
  return Math.max(CONQUEST_TARGET_FLOOR, target);
}

/**
 * Computes the requirement for a Coordination mission.
 *
 * Per v6.10 §3.10.5:
 *   required_occurrences = floor(base_occurrences × activity_factor)
 *   required_participation = floor(active_members × participation_threshold), with min override
 *
 * @returns {Object} { occurrencesRequired, participationRequired }
 */
function calcCoordinationRequirement(opts) {
  const { missionType, activeMemberCount, memberActivityPowers } = opts;
  const mission = MISSION_CATALOG[missionType];
  if (!mission || mission.category !== 'coordination') {
    throw new Error(`Not a coordination mission: ${missionType}`);
  }
  _assertNonNegInt(activeMemberCount, 'activeMemberCount');

  const activityFactor = calcActivityFactor(memberActivityPowers);
  const occurrencesRequired = Math.max(1,
    Math.floor(mission.base_occurrences * activityFactor));

  let participationRequired = Math.floor(activeMemberCount * mission.participation_pct);
  // Apply minimum threshold if defined
  if (mission.participation_min !== null) {
    participationRequired = Math.max(participationRequired, mission.participation_min);
  }

  return { occurrencesRequired, participationRequired };
}

/**
 * Returns true if a mission is feasible for the given alliance state.
 * Used to filter the 3-option pool before presenting to Founder/Marshal.
 */
function isMissionFeasible(opts) {
  const { missionType, activeMemberCount, recentlyCompletedMissions = [] } = opts;
  const mission = MISSION_CATALOG[missionType];
  if (!mission) return false;

  // Variety filter — exclude if completed 2 of last 3 weeks
  const recentCount = recentlyCompletedMissions.filter(m => m === missionType).length;
  if (recentCount >= 2) return false;

  // Coordination missions need enough active members to hit participation threshold
  if (mission.category === 'coordination') {
    if (mission.participation_min !== null && activeMemberCount < mission.participation_min) {
      return false;
    }
    const requiredFromPct = Math.floor(activeMemberCount * mission.participation_pct);
    if (requiredFromPct < 1) return false;
  }

  return true;
}

/**
 * Computes Contribution Points for a single contribution.
 *
 * @param {string} missionType
 * @param {number|boolean} value — depends on contribution type
 * @returns {number} CP value
 */
function calcContributionPoints(missionType, value) {
  const mission = MISSION_CATALOG[missionType];
  if (!mission) throw new Error(`Unknown mission type: ${missionType}`);

  if (mission.category === 'coordination') {
    // Coordination: 100 CP per qualifying participation (boolean input)
    return value === true ? CP_PER_UNIT.coordination : 0;
  }

  if (missionType === 'streak_wall') {
    return value === true ? CP_PER_UNIT.streak_wall : 0;
  }

  const cpRate = CP_PER_UNIT[missionType];
  if (cpRate === undefined) {
    throw new Error(`No CP rate defined for mission: ${missionType}`);
  }
  _assertNonNegNumber(value, 'value');
  return value * cpRate;
}

/**
 * Returns the completion factor for a given % of target achieved.
 */
function calcCompletionFactor(achievedPct) {
  _assertNonNegNumber(achievedPct, 'achievedPct');
  for (const band of COMPLETION_BANDS) {
    if (achievedPct >= band.minPct) return band.factor;
  }
  return 0;
}

/**
 * Returns the streak tier and bonus for a given streak length (in weeks).
 */
function getMissionStreakTier(streakWeeks) {
  _assertNonNegInt(streakWeeks, 'streakWeeks');
  for (const t of MISSION_STREAK_TIERS) {
    if (streakWeeks >= t.minWeeks) return { ...t };
  }
  return { ...MISSION_STREAK_TIERS[MISSION_STREAK_TIERS.length - 1] };
}

/**
 * Computes the total reward pool for a mission, accounting for completion
 * and streak bonuses. The returned values are alliance-wide pools, not
 * per-member values — they are then distributed via the 50/35/15 model.
 *
 * @param {Object} opts
 * @param {string} opts.category — mission category
 * @param {number} opts.achievedPct — 0.0 to 1.0+
 * @param {number} opts.streakWeeks — current alliance streak in weeks
 * @returns {Object} { morale, gold, xp } — all integers, alliance-wide pools
 */
function calcMissionRewardPool(opts) {
  const { category, achievedPct, streakWeeks } = opts;
  if (!MISSION_REWARDS[category]) {
    throw new Error(`Unknown mission category: ${category}`);
  }

  const base = MISSION_REWARDS[category];
  const completionFactor = calcCompletionFactor(achievedPct);
  const streakBonus = 1 + getMissionStreakTier(streakWeeks).rewardBonusPct;

  return {
    morale: Math.round(base.morale * completionFactor * streakBonus),
    gold:   Math.round(base.gold * completionFactor * streakBonus),
    xp:     Math.round(base.xp * completionFactor * streakBonus),
  };
}

/**
 * Distributes a Morale pool across members per the 50/35/15 hybrid model.
 *
 * Per v6.10 §3.10.7:
 *   - 50% participation share — equal split among members with CP > 0
 *   - 35% contribution share — distributed proportionally to CP earned
 *   - 15% hero bonus — top 3 contributors (split 7%/5%/3%)
 *   - 30% war chest deposit — additional, not subtracted from individual distributions
 *
 * On mission failure (achievedPct < 60%): only failure compensation paid
 * (50% of the participation share to each contributor). No war chest deposit.
 *
 * @param {Object} opts
 * @param {number} opts.totalMoralePool
 * @param {Array} opts.members — Each: { playerId, cp }
 * @param {boolean} opts.missionFailed — if true, only failure compensation paid
 * @returns {Object} { distributions, warChestDeposit, totalDistributed }
 */
function distributeMissionMorale(opts) {
  const { totalMoralePool, members, missionFailed = false } = opts;
  _assertNonNegNumber(totalMoralePool, 'totalMoralePool');
  if (!Array.isArray(members)) {
    throw new Error('members must be an array');
  }

  const contributors = members.filter(m => m.cp > 0);

  // Failure compensation path
  if (missionFailed) {
    const compensationPool = totalMoralePool * REWARD_SPLIT.participation
                           * FAILURE_PARTICIPATION_FACTOR;
    const perContributor = contributors.length > 0
      ? Math.floor(compensationPool / contributors.length)
      : 0;
    const distributions = members.map(m => ({
      playerId: m.playerId,
      morale: m.cp > 0 ? perContributor : 0,
      breakdown: {
        participation: m.cp > 0 ? perContributor : 0,
        contribution: 0,
        hero: 0,
      },
    }));
    return {
      distributions,
      warChestDeposit: 0,
      totalDistributed: distributions.reduce((sum, d) => sum + d.morale, 0),
    };
  }

  // Standard distribution path
  const participationPool = totalMoralePool * REWARD_SPLIT.participation;
  const contributionPool = totalMoralePool * REWARD_SPLIT.contribution;

  const perContributor = contributors.length > 0
    ? Math.floor(participationPool / contributors.length)
    : 0;
  const totalCp = contributors.reduce((sum, m) => sum + m.cp, 0);

  // Members must already be sorted by CP descending for hero ranking
  const sortedContributors = [...contributors].sort((a, b) => b.cp - a.cp);

  const distributions = members.map(m => {
    const isContributor = m.cp > 0;
    const participation = isContributor ? perContributor : 0;
    const contribution = (isContributor && totalCp > 0)
      ? Math.floor(contributionPool * (m.cp / totalCp))
      : 0;

    // Hero bonus — based on rank in sorted contributors
    let hero = 0;
    const rank = sortedContributors.findIndex(c => c.playerId === m.playerId) + 1;
    if (rank >= 1 && rank <= 3) {
      hero = Math.floor(totalMoralePool * HERO_RANK_SPLIT[rank]);
    }

    return {
      playerId: m.playerId,
      morale: participation + contribution + hero,
      breakdown: { participation, contribution, hero },
    };
  });

  const totalDistributed = distributions.reduce((sum, d) => sum + d.morale, 0);
  const warChestDeposit = Math.round(totalMoralePool * WAR_CHEST_DEPOSIT_PCT);

  return { distributions, warChestDeposit, totalDistributed };
}

/**
 * Distributes Gold pool across members per the same 50/35/15 hybrid model.
 * Same shape as Morale distribution but no war chest deposit.
 */
function distributeMissionGold(opts) {
  const { totalGoldPool, members, missionFailed = false } = opts;
  _assertNonNegNumber(totalGoldPool, 'totalGoldPool');

  // Reuse the morale distribution logic by treating Gold as the pool
  const result = distributeMissionMorale({
    totalMoralePool: totalGoldPool,
    members,
    missionFailed,
  });

  return {
    distributions: result.distributions.map(d => ({
      playerId: d.playerId,
      gold: d.morale,
      breakdown: d.breakdown,
    })),
    totalDistributed: result.totalDistributed,
  };
}

/**
 * Returns true if a mission counts toward the alliance's streak.
 */
function missionCompletedForStreak(achievedPct) {
  _assertNonNegNumber(achievedPct, 'achievedPct');
  return achievedPct >= STREAK_COMPLETION_THRESHOLD_PCT;
}

/**
 * Returns true if the alliance earns a Grace Week at this streak length.
 * Grace Weeks are earned at intervals of GRACE_WEEK_EARN_INTERVAL.
 *
 * Note: per v6.10 §3.10.8, if the alliance already has a stored Grace Week
 * (max stored = GRACE_WEEK_BANK_CAP), the new grant is suppressed. The caller
 * is responsible for checking storage state before crediting.
 */
function isGraceWeekEarnedAt(streakWeeks) {
  _assertNonNegInt(streakWeeks, 'streakWeeks');
  return streakWeeks > 0 && streakWeeks % GRACE_WEEK_EARN_INTERVAL === 0;
}

/**
 * Returns whether a member is eligible to earn CP for the current mission.
 * A member who joined after the mission started earns 0 CP for that mission.
 *
 * Per v6.10 §3.10.12: new joiners are excluded from the locked active_members
 * snapshot for the current week's mission and earn no CP.
 *
 * @param {Date|number} memberJoinedAt
 * @param {Date|number} missionStartedAt
 */
function isEligibleForMissionCp(memberJoinedAt, missionStartedAt) {
  const joined = new Date(memberJoinedAt).getTime();
  const started = new Date(missionStartedAt).getTime();
  return joined <= started;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // constants (read-only)
  TIERS, TIER_NORMALISER, DEV_LEVELS, LEGACY_RANKS, CHALLENGE_TIERS, STREAK_TIERS,
  BONUS_PRODUCT_CAP,
  LEVEL_XP_FLOORS, LEVEL_TITLES,
  XP_PER_CHALLENGE, XP_PER_DEFENCE_WIN,
  XP_RECONQUEST, XP_PER_DEV_TIER_REACHED, XP_ALLIANCE_MISSION,
  XP_STREAK_MILESTONE,
  STREAK_TIER_THRESHOLDS, STREAK_MULT_TIER_CAP,
  GRACE_DAY_BANK_CAP, GRACE_DAY_MILESTONES,
  RESOURCE_EARN,
  CLAIM_GOLD_COST, CLAIM_GOLD_REWARD, CLAIM_XP, CONTEST_IRON_COST, CONTEST_WIN_XP,
  SIEGE_BOOST_IRON_COST, SIEGE_BOOST_DISTANCE_FACTOR,
  DEFENCE_ACTIVATION_STONE_COST, FREE_DEFENCE_RATIO,
  GOLD_CONVERSION, MORALE_PERSONAL_DECAY_PER_WEEK,
  TERRITORY_BASE_POWER, TERRITORY_BASE_INFLUENCE,
  DEV_INFLUENCE_MULT, DEV_POWER_MULT, DEV_CONTEST_MULT,
  LEGACY_RANK_INFLUENCE_MULT, LEGACY_RANK_POWER_MULT,
  DEV_COST,
  INFLUENCE_FIXED_POINT_SCALE,
  RALLY_CRY_FACTOR, STEADFAST_DEF_FACTOR,
  REQUIRED_WALK_HARD_CAP, CONTEST_WALK_ROUNDING_M,
  ALLIANCE_ABILITY, ALLIANCE_MORALE_WEEKLY_SPEND_CAP,
  MAX_ACTIVE_ABILITIES_PER_ALLIANCE, SUPPLY_LINE_BONUS_MULT,
  STEP_BANDS, CALORIE_BANDS, SESSION_BANDS,
  WEEKLY_STEP_CAP, WEEKLY_OVER_CAP_FACTOR,
  SESSION_IDLE_THRESHOLD_MIN, MAX_PLAUSIBLE_KMH, DEFAULT_STRIDE_M,
  ARMOUR_COSTS,
  ACTIVITY_POWER_WEIGHTS, LEGACY_POWER_WEIGHTS, MEDAL_POWER_WEIGHTS,
  ALLIANCE_PARTICIPATION_THRESHOLD_POWER,
  ALLIANCE_COORD_BASE, ALLIANCE_COORD_MAX_BONUS,
  FULL_VALUE_CAP_BASE, FULL_VALUE_CAP_PER_LEVEL,
  FULL_VALUE_CAP_UNBROKEN_BONUS, FULL_VALUE_CAP_LEGENDARY_BONUS,
  FULL_VALUE_CAP_DOMINATOR_BONUS, FULL_VALUE_CAP_CHAMPIONSHIP_BONUS,
  FULL_VALUE_CAP_UNBROKEN_TOGETHER_BONUS, ABOVE_CAP_VALUE_FACTOR,

  // alliance mission constants
  MISSION_ELIGIBILITY_ACTIVITY_POWER, MISSION_CATEGORIES, MISSION_CATALOG,
  CONQUEST_TARGET_FLOOR, DIFFICULTY_MULT,
  ACTIVITY_FACTOR_LOW, ACTIVITY_FACTOR_MIXED, ACTIVITY_FACTOR_HIGH,
  ACTIVITY_FACTOR_LOW_THRESHOLD, ACTIVITY_FACTOR_HIGH_THRESHOLD,
  CP_PER_UNIT, MISSION_REWARDS, REWARD_SPLIT,
  HERO_RANK_SPLIT, COMPLETION_BANDS, FAILURE_PARTICIPATION_FACTOR,
  WAR_CHEST_DEPOSIT_PCT, MISSION_STREAK_TIERS,
  GRACE_WEEK_EARN_INTERVAL, GRACE_WEEK_BANK_CAP,
  STREAK_COMPLETION_THRESHOLD_PCT,

  // canonical earn calculation
  calcCanonicalEarn,

  // validation/helper utilities
  normaliseTier,

  // level & XP functions
  calcLevel, calcLevelProgress, getLevelTitle,
  getStreakTier, calcStreakMultiplier,
  calcChallengeXp, calcClaimXp, calcContestWinXp, calcDefenceWinXp,
  calcReconquestXp, calcDevTierReachedXp, calcAllianceMissionXp,
  calcStreakMilestoneXp, calcFullValueCap,
  calcTerritoryCapForLevel,

  // resource functions
  calcResourceEarn, convertGold, applyMoraleDecay,

  // wellbeing functions
  stepEffectiveness, calorieEffectiveness, sessionEffectiveness,
  weeklyStepFactor, effectivenessForChallenge,

  // influence & territory
  calcDailyInfluenceFixedPoint, calcDailyInfluence, influenceToDisplay,
  calcDevCost, getCumulativeDevCost,

  // contest & armour
  calcRequiredContestWalk, calcRequiredDefenderWalk,
  calcArmourCost,

  // power
  calcActivityPower, calcTerritoryPowerSingle, calcTerritoryPower,
  calcLegacyPower, calcMedalPower, calcTotalPower, calcAlliancePower,

  // legacy rank
  calcLegacyRank,
  legacyRankName,

  // distance & velocity
  stepsToKm, isStepWindowOverVelocityCap,

  // alliance abilities
  getAbility, canActivateAbility,

  // alliance mission functions
  isActiveMember, countActiveMembers,
  calcActivityFactor, calcDifficultyMultiplier,
  calcEnduranceTarget, calcConquestTarget, calcCoordinationRequirement,
  isMissionFeasible, calcContributionPoints, calcCompletionFactor,
  getMissionStreakTier, calcMissionRewardPool,
  distributeMissionMorale, distributeMissionGold,
  missionCompletedForStreak, isGraceWeekEarnedAt,
  isEligibleForMissionCp,
};
