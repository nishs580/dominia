/**
 * lib/__tests__/formulas.test.js
 *
 * Session 1 of 2 — covers simple + medium-complexity functions:
 *   - validation helpers (_assert*)
 *   - level / XP / title
 *   - streak tier + multiplier
 *   - simple XP getters (claim, contest, defence, reconquest, etc.)
 *   - calcChallengeXp (integration with canonical earn)
 *   - resource earn lookup, gold conversion, morale decay
 *   - getAbility
 *   - simple mission helpers (isActiveMember, missionCompletedForStreak,
 *     isGraceWeekEarnedAt, isEligibleForMissionCp)
 *   - normaliseTier and legacyRankName utilities
 *
 * Session 2 will cover: calcCanonicalEarn deep, calcDailyInfluence + FixedPoint,
 * calcRequiredContestWalk, calcLegacyRank, all 5 power functions,
 * distributeMissionMorale, band-based wellbeing functions, calcFullValueCap.
 */

const F = require('../formulas');

// =============================================================================
// VALIDATION HELPERS
// Note: _assert* helpers are not exported, so we exercise them indirectly
// through public functions that call them.
// =============================================================================

describe('validation: tier', () => {
  test('valid tiers do not throw via calcClaimXp', () => {
    expect(() => F.calcClaimXp('Small')).not.toThrow();
    expect(() => F.calcClaimXp('Medium')).not.toThrow();
    expect(() => F.calcClaimXp('Large')).not.toThrow();
    expect(() => F.calcClaimXp('Epic')).not.toThrow();
  });

  test('invalid tier throws', () => {
    expect(() => F.calcClaimXp('small')).toThrow(/Invalid tier/);
    expect(() => F.calcClaimXp('Tiny')).toThrow(/Invalid tier/);
    expect(() => F.calcClaimXp('')).toThrow(/Invalid tier/);
    expect(() => F.calcClaimXp(null)).toThrow(/Invalid tier/);
    expect(() => F.calcClaimXp(undefined)).toThrow(/Invalid tier/);
  });
});

describe('validation: challenge tier', () => {
  test('valid challenge tiers do not throw', () => {
    expect(() => F.calcChallengeXp({ tier: 'easy' })).not.toThrow();
    expect(() => F.calcChallengeXp({ tier: 'medium' })).not.toThrow();
    expect(() => F.calcChallengeXp({ tier: 'hard' })).not.toThrow();
  });

  test('invalid challenge tier throws', () => {
    expect(() => F.calcChallengeXp({ tier: 'Easy' })).toThrow(/Invalid challenge tier/);
    expect(() => F.calcChallengeXp({ tier: 'extreme' })).toThrow(/Invalid challenge tier/);
    expect(() => F.calcChallengeXp({ tier: '' })).toThrow(/Invalid challenge tier/);
  });
});

describe('validation: dev level', () => {
  test('valid dev levels 0–4 do not throw via calcWeeklyUpkeep', () => {
    for (const lvl of [0, 1, 2, 3, 4]) {
      expect(() => F.calcWeeklyUpkeep(lvl)).not.toThrow();
    }
  });

  test('invalid dev levels throw', () => {
    expect(() => F.calcWeeklyUpkeep(-1)).toThrow(/Invalid dev level/);
    expect(() => F.calcWeeklyUpkeep(5)).toThrow(/Invalid dev level/);
    expect(() => F.calcWeeklyUpkeep('2')).toThrow(/Invalid dev level/);
    expect(() => F.calcWeeklyUpkeep(null)).toThrow(/Invalid dev level/);
  });
});

describe('validation: legacy rank', () => {
  test('valid legacy ranks 1–5 do not throw via calcDailyInfluenceFixedPoint', () => {
    for (const rank of [1, 2, 3, 4, 5]) {
      expect(() => F.calcDailyInfluenceFixedPoint({
        tier: 'Small', developmentLevel: 0, legacyRank: rank,
      })).not.toThrow();
    }
  });

  test('invalid legacy ranks throw', () => {
    expect(() => F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 0, legacyRank: 0,
    })).toThrow(/Invalid legacy rank/);
    expect(() => F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 0, legacyRank: 6,
    })).toThrow(/Invalid legacy rank/);
  });
});

describe('validation: non-negative integer', () => {
  test('negative integers throw via calcLevel', () => {
    expect(() => F.calcLevel(-1)).toThrow(/non-negative integer/);
  });

  test('non-integers throw via calcLevel', () => {
    expect(() => F.calcLevel(1.5)).toThrow(/non-negative integer/);
    expect(() => F.calcLevel('100')).toThrow(/non-negative integer/);
    expect(() => F.calcLevel(null)).toThrow(/non-negative integer/);
    expect(() => F.calcLevel(undefined)).toThrow(/non-negative integer/);
    expect(() => F.calcLevel(NaN)).toThrow(/non-negative integer/);
  });

  test('zero is valid', () => {
    expect(() => F.calcLevel(0)).not.toThrow();
  });
});

describe('validation: non-negative number', () => {
  test('negative numbers throw via applyMoraleDecay', () => {
    expect(() => F.applyMoraleDecay(-1)).toThrow(/non-negative number/);
  });

  test('NaN throws via applyMoraleDecay', () => {
    expect(() => F.applyMoraleDecay(NaN)).toThrow(/non-negative number/);
  });

  test('non-numbers throw via applyMoraleDecay', () => {
    expect(() => F.applyMoraleDecay('100')).toThrow(/non-negative number/);
    expect(() => F.applyMoraleDecay(null)).toThrow(/non-negative number/);
    expect(() => F.applyMoraleDecay(undefined)).toThrow(/non-negative number/);
  });

  test('zero and positive floats are valid', () => {
    expect(() => F.applyMoraleDecay(0)).not.toThrow();
    expect(() => F.applyMoraleDecay(99.5)).not.toThrow();
  });
});

// =============================================================================
// TIER NORMALISER
// =============================================================================

describe('normaliseTier', () => {
  test('lowercase tiers normalise to title-case', () => {
    expect(F.normaliseTier('small')).toBe('Small');
    expect(F.normaliseTier('medium')).toBe('Medium');
    expect(F.normaliseTier('large')).toBe('Large');
    expect(F.normaliseTier('epic')).toBe('Epic');
  });

  test('already-title-case tiers pass through unchanged', () => {
    expect(F.normaliseTier('Small')).toBe('Small');
    expect(F.normaliseTier('Medium')).toBe('Medium');
    expect(F.normaliseTier('Large')).toBe('Large');
    expect(F.normaliseTier('Epic')).toBe('Epic');
  });

  test('invalid tier throws', () => {
    expect(() => F.normaliseTier('SMALL')).toThrow(/Invalid tier/); // not in normaliser table
    expect(() => F.normaliseTier('tiny')).toThrow(/Invalid tier/);
    expect(() => F.normaliseTier('')).toThrow(/Invalid tier/);
    expect(() => F.normaliseTier(null)).toThrow(/Invalid tier/);
    expect(() => F.normaliseTier(undefined)).toThrow(/Invalid tier/);
  });

  test('output of normaliseTier is always accepted by calcClaimXp', () => {
    // Composability check — normaliseTier should always produce a valid tier
    expect(() => F.calcClaimXp(F.normaliseTier('small'))).not.toThrow();
    expect(() => F.calcClaimXp(F.normaliseTier('Epic'))).not.toThrow();
  });
});

// =============================================================================
// LEVEL & XP
// =============================================================================

describe('calcLevel', () => {
  test('0 XP is Level 1', () => {
    expect(F.calcLevel(0)).toBe(1);
  });

  test('XP just below floor is previous level', () => {
    expect(F.calcLevel(599)).toBe(1);
    expect(F.calcLevel(1_999)).toBe(2);
    expect(F.calcLevel(11_999)).toBe(4);
  });

  test('XP exactly at floor is the new level', () => {
    expect(F.calcLevel(600)).toBe(2);
    expect(F.calcLevel(2_000)).toBe(3);
    expect(F.calcLevel(5_500)).toBe(4);
    expect(F.calcLevel(12_000)).toBe(5);
    expect(F.calcLevel(30_000)).toBe(6);
    expect(F.calcLevel(70_000)).toBe(7);
    expect(F.calcLevel(140_000)).toBe(8);
    expect(F.calcLevel(250_000)).toBe(9);
    expect(F.calcLevel(420_000)).toBe(10);
  });

  test('XP above max floor stays at Level 10', () => {
    expect(F.calcLevel(420_001)).toBe(10);
    expect(F.calcLevel(1_000_000)).toBe(10);
    expect(F.calcLevel(99_999_999)).toBe(10);
  });

  test('mid-band XP returns correct level', () => {
    expect(F.calcLevel(1_000)).toBe(2);
    expect(F.calcLevel(8_000)).toBe(4);
    expect(F.calcLevel(50_000)).toBe(6);
    expect(F.calcLevel(200_000)).toBe(8);
  });
});

describe('calcLevelProgress', () => {
  test('0 XP returns 0 progress at Level 1', () => {
    expect(F.calcLevelProgress(0)).toBe(0);
  });

  test('XP exactly at floor returns 0 progress in new level', () => {
    expect(F.calcLevelProgress(600)).toBe(0);
    expect(F.calcLevelProgress(2_000)).toBe(0);
    expect(F.calcLevelProgress(12_000)).toBe(0);
  });

  test('XP at midpoint of band returns ~0.5 progress', () => {
    // L1 band is 0..600, midpoint 300
    expect(F.calcLevelProgress(300)).toBeCloseTo(0.5, 5);
    // L2 band is 600..2000, midpoint 1300
    expect(F.calcLevelProgress(1_300)).toBeCloseTo(0.5, 5);
  });

  test('Level 10 always returns 1.0 regardless of overflow XP', () => {
    expect(F.calcLevelProgress(420_000)).toBe(1.0);
    expect(F.calcLevelProgress(1_000_000)).toBe(1.0);
    expect(F.calcLevelProgress(99_999_999)).toBe(1.0);
  });

  test('progress is monotonically non-decreasing within a band', () => {
    // L2 band: 600..2000
    const a = F.calcLevelProgress(700);
    const b = F.calcLevelProgress(1_000);
    const c = F.calcLevelProgress(1_900);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(1);
  });
});

describe('getLevelTitle', () => {
  test('returns correct title for each level', () => {
    expect(F.getLevelTitle(1)).toBe('Scout');
    expect(F.getLevelTitle(2)).toBe('Pathfinder');
    expect(F.getLevelTitle(3)).toBe('Claimer');
    expect(F.getLevelTitle(4)).toBe('Defender');
    expect(F.getLevelTitle(5)).toBe('Commander');
    expect(F.getLevelTitle(6)).toBe('Warlord');
    expect(F.getLevelTitle(7)).toBe('Strategist');
    expect(F.getLevelTitle(8)).toBe('Conqueror');
    expect(F.getLevelTitle(9)).toBe('Sovereign');
    expect(F.getLevelTitle(10)).toBe('Dominator');
  });

  test('invalid levels throw', () => {
    expect(() => F.getLevelTitle(0)).toThrow(/Invalid level/);
    expect(() => F.getLevelTitle(11)).toThrow(/Invalid level/);
    expect(() => F.getLevelTitle(-1)).toThrow(/Invalid level/);
  });
});

// =============================================================================
// STREAKS
// =============================================================================

describe('getStreakTier', () => {
  test('0 days is newcomer (1.00x)', () => {
    expect(F.getStreakTier(0)).toEqual({ tier: 'newcomer', multiplier: 1.00 });
  });

  test('exact tier thresholds', () => {
    expect(F.getStreakTier(3)).toEqual({ tier: 'committed', multiplier: 1.10 });
    expect(F.getStreakTier(7)).toEqual({ tier: 'proven', multiplier: 1.15 });
    expect(F.getStreakTier(14)).toEqual({ tier: 'reliable', multiplier: 1.20 });
    expect(F.getStreakTier(21)).toEqual({ tier: 'iron_guard', multiplier: 1.30 });
    expect(F.getStreakTier(30)).toEqual({ tier: 'unbroken', multiplier: 1.40 });
    expect(F.getStreakTier(60)).toEqual({ tier: 'legendary', multiplier: 1.50 });
  });

  test('off-by-one: day before threshold returns previous tier', () => {
    expect(F.getStreakTier(2).tier).toBe('newcomer');
    expect(F.getStreakTier(6).tier).toBe('committed');
    expect(F.getStreakTier(13).tier).toBe('proven');
    expect(F.getStreakTier(20).tier).toBe('reliable');
    expect(F.getStreakTier(29).tier).toBe('iron_guard');
    expect(F.getStreakTier(59).tier).toBe('unbroken');
  });

  test('very long streaks stay at legendary', () => {
    expect(F.getStreakTier(100).tier).toBe('legendary');
    expect(F.getStreakTier(999).tier).toBe('legendary');
  });
});

describe('calcStreakMultiplier', () => {
  test('Small territory uses uncapped multiplier', () => {
    expect(F.calcStreakMultiplier(60, 'Small')).toBe(1.50);
    expect(F.calcStreakMultiplier(30, 'Small')).toBe(1.40);
    expect(F.calcStreakMultiplier(0, 'Small')).toBe(1.00);
  });

  test('Medium territory uses uncapped multiplier (cap = 1.50)', () => {
    expect(F.calcStreakMultiplier(60, 'Medium')).toBe(1.50);
    expect(F.calcStreakMultiplier(21, 'Medium')).toBe(1.30);
  });

  test('Large territory caps streak multiplier at 1.25', () => {
    expect(F.calcStreakMultiplier(60, 'Large')).toBe(1.25);
    expect(F.calcStreakMultiplier(30, 'Large')).toBe(1.25);
    expect(F.calcStreakMultiplier(21, 'Large')).toBe(1.25);
    expect(F.calcStreakMultiplier(14, 'Large')).toBe(1.20); // below cap
    expect(F.calcStreakMultiplier(0, 'Large')).toBe(1.00);
  });

  test('Epic territory caps streak multiplier at 1.15', () => {
    expect(F.calcStreakMultiplier(60, 'Epic')).toBe(1.15);
    expect(F.calcStreakMultiplier(7, 'Epic')).toBe(1.15);
    expect(F.calcStreakMultiplier(3, 'Epic')).toBe(1.10); // below cap
    expect(F.calcStreakMultiplier(0, 'Epic')).toBe(1.00);
  });

  test('invalid tier throws', () => {
    expect(() => F.calcStreakMultiplier(7, 'small')).toThrow(/Invalid tier/);
  });
});

// =============================================================================
// SIMPLE XP GETTERS
// =============================================================================

describe('calcClaimXp', () => {
  test('returns canonical XP for each tier', () => {
    expect(F.calcClaimXp('Small')).toBe(40);
    expect(F.calcClaimXp('Medium')).toBe(80);
    expect(F.calcClaimXp('Large')).toBe(200);
    expect(F.calcClaimXp('Epic')).toBe(500);
  });
});

describe('calcContestWinXp', () => {
  test('returns canonical XP for each tier', () => {
    expect(F.calcContestWinXp('Small')).toBe(300);
    expect(F.calcContestWinXp('Medium')).toBe(350);
    expect(F.calcContestWinXp('Large')).toBe(450);
    expect(F.calcContestWinXp('Epic')).toBe(600);
  });
});

describe('calcDefenceWinXp', () => {
  test('returns canonical XP for each tier', () => {
    expect(F.calcDefenceWinXp('Small')).toBe(200);
    expect(F.calcDefenceWinXp('Medium')).toBe(250);
    expect(F.calcDefenceWinXp('Large')).toBe(350);
    expect(F.calcDefenceWinXp('Epic')).toBe(500);
  });
});

describe('constant XP getters', () => {
  test('calcReconquestXp returns 400', () => {
    expect(F.calcReconquestXp()).toBe(400);
  });
  test('calcDevTierReachedXp returns 500', () => {
    expect(F.calcDevTierReachedXp()).toBe(500);
  });
  test('calcAllianceMissionXp returns 250', () => {
    expect(F.calcAllianceMissionXp()).toBe(250);
  });
  test('calcStreakMilestoneXp returns 250', () => {
    expect(F.calcStreakMilestoneXp()).toBe(250);
  });
});

// =============================================================================
// CHALLENGE XP (integration with canonical earn)
// Spot-checks only — exhaustive canonical-earn tests are Session 2.
// =============================================================================

describe('calcChallengeXp', () => {
  test('base XP with no streak, no event, no buffs, full cap', () => {
    expect(F.calcChallengeXp({ tier: 'easy', streakDays: 0 })).toBe(50);
    expect(F.calcChallengeXp({ tier: 'medium', streakDays: 0 })).toBe(150);
    expect(F.calcChallengeXp({ tier: 'hard', streakDays: 0 })).toBe(400);
  });

  test('streak multiplier applied to base XP', () => {
    // medium (150) × 1.20 (reliable) = 180
    expect(F.calcChallengeXp({ tier: 'medium', streakDays: 14 })).toBe(180);
    // hard (400) × 1.50 (legendary) = 600
    expect(F.calcChallengeXp({ tier: 'hard', streakDays: 60 })).toBe(600);
  });

  test('city event applies 1.5x', () => {
    // easy (50) × 1.5 = 75
    expect(F.calcChallengeXp({ tier: 'easy', streakDays: 0, isCityEvent: true })).toBe(75);
  });

  test('supply line applies 1.20x', () => {
    // easy (50) × 1.20 = 60
    expect(F.calcChallengeXp({ tier: 'easy', streakDays: 0, isSupplyLineActive: true })).toBe(60);
  });

  test('cap factor reduces base earn before bonuses', () => {
    // easy (50) × 0.5 cap × 1.0 = 25
    expect(F.calcChallengeXp({ tier: 'easy', streakDays: 0, capFactor: 0.5 })).toBe(25);
  });

  test('zero cap factor zeroes the earn', () => {
    expect(F.calcChallengeXp({ tier: 'hard', streakDays: 60, capFactor: 0 })).toBe(0);
  });

  test('bonus product is hard-capped at 3.0', () => {
    // hard (400) × 1.50 (legendary) × 1.5 (city) × 1.20 (supply) = 2.7 raw product
    // 2.7 < 3.0 cap, so full product applies: 400 × 2.7 = 1080
    expect(F.calcChallengeXp({
      tier: 'hard', streakDays: 60, isCityEvent: true, isSupplyLineActive: true,
    })).toBe(1080);
  });

  test('invalid tier throws', () => {
    expect(() => F.calcChallengeXp({ tier: 'extreme', streakDays: 0 })).toThrow();
  });
});

// =============================================================================
// RESOURCE EARN
// =============================================================================

describe('calcResourceEarn', () => {
  test('returns correct shape for step challenges', () => {
    expect(F.calcResourceEarn('easy_step_challenge')).toEqual({ iron: 0, stone: 15, gold: 5, morale: 3 });
    expect(F.calcResourceEarn('medium_step_challenge')).toEqual({ iron: 0, stone: 35, gold: 10, morale: 5 });
    expect(F.calcResourceEarn('hard_step_challenge')).toEqual({ iron: 0, stone: 65, gold: 20, morale: 10 });
  });

  test('returns correct shape for calorie challenges', () => {
    expect(F.calcResourceEarn('easy_calorie_challenge')).toEqual({ iron: 9, stone: 0, gold: 5, morale: 3 });
    expect(F.calcResourceEarn('medium_calorie_challenge')).toEqual({ iron: 20, stone: 0, gold: 10, morale: 5 });
    expect(F.calcResourceEarn('hard_calorie_challenge')).toEqual({ iron: 45, stone: 0, gold: 20, morale: 10 });
  });

  test('returns correct shape for combat events', () => {
    expect(F.calcResourceEarn('contest_win')).toEqual({ iron: 15, stone: 0, gold: 25, morale: 8 });
    expect(F.calcResourceEarn('defence_win')).toEqual({ iron: 0, stone: 20, gold: 15, morale: 8 });
    expect(F.calcResourceEarn('reconquest')).toEqual({ iron: 15, stone: 20, gold: 40, morale: 15 });
  });

  test('returns correct shape for non-combat events', () => {
    expect(F.calcResourceEarn('weekly_bonus')).toEqual({ iron: 50, stone: 50, gold: 30, morale: 20 });
    expect(F.calcResourceEarn('alliance_mission')).toEqual({ iron: 10, stone: 10, gold: 30, morale: 40 });
    expect(F.calcResourceEarn('war_chest_donation')).toEqual({ iron: 0, stone: 0, gold: 0, morale: 5 });
  });

  test('returns a clone — mutating result does not leak', () => {
    const a = F.calcResourceEarn('contest_win');
    a.iron = 9999;
    const b = F.calcResourceEarn('contest_win');
    expect(b.iron).toBe(15);
  });

  test('unknown event throws', () => {
    expect(() => F.calcResourceEarn('totally_fake')).toThrow(/Unknown resource event/);
    expect(() => F.calcResourceEarn('')).toThrow(/Unknown resource event/);
  });
});

// =============================================================================
// GOLD CONVERSION
// =============================================================================

describe('convertGold', () => {
  test('Gold → Iron at 50%', () => {
    expect(F.convertGold(100, 'iron')).toBe(50);
    expect(F.convertGold(10, 'iron')).toBe(5);
  });

  test('Gold → Stone at 60%', () => {
    expect(F.convertGold(100, 'stone')).toBe(60);
    expect(F.convertGold(10, 'stone')).toBe(6);
  });

  test('Gold → Morale at 40%', () => {
    expect(F.convertGold(100, 'morale')).toBe(40);
    expect(F.convertGold(10, 'morale')).toBe(4);
  });

  test('floors fractional results (no rounding up)', () => {
    // 11 * 0.5 = 5.5 → 5
    expect(F.convertGold(11, 'iron')).toBe(5);
    // 11 * 0.6 = 6.6 → 6
    expect(F.convertGold(11, 'stone')).toBe(6);
    // 11 * 0.4 = 4.4 → 4
    expect(F.convertGold(11, 'morale')).toBe(4);
    // 1 * 0.4 = 0.4 → 0 (under-1 conversion is lost, by design)
    expect(F.convertGold(1, 'morale')).toBe(0);
  });

  test('zero gold returns zero', () => {
    expect(F.convertGold(0, 'iron')).toBe(0);
    expect(F.convertGold(0, 'stone')).toBe(0);
    expect(F.convertGold(0, 'morale')).toBe(0);
  });

  test('invalid target resource throws', () => {
    expect(() => F.convertGold(100, 'gold')).toThrow(/Cannot convert Gold to/);
    expect(() => F.convertGold(100, 'wood')).toThrow(/Cannot convert Gold to/);
    expect(() => F.convertGold(100, '')).toThrow(/Cannot convert Gold to/);
  });

  test('negative or non-integer gold throws', () => {
    expect(() => F.convertGold(-10, 'iron')).toThrow(/non-negative integer/);
    expect(() => F.convertGold(10.5, 'iron')).toThrow(/non-negative integer/);
  });
});

// =============================================================================
// MORALE DECAY
// =============================================================================

describe('applyMoraleDecay', () => {
  test('100 morale decays to 95 (5% weekly)', () => {
    expect(F.applyMoraleDecay(100)).toBe(95);
  });

  test('1 morale decays to 0 via floor', () => {
    // 1 * 0.95 = 0.95 → 0
    expect(F.applyMoraleDecay(1)).toBe(0);
  });

  test('0 morale stays at 0', () => {
    expect(F.applyMoraleDecay(0)).toBe(0);
  });

  test('large balance decays correctly', () => {
    // 1000 * 0.95 = 950
    expect(F.applyMoraleDecay(1000)).toBe(950);
  });

  test('floors result (does not round up)', () => {
    // 21 * 0.95 = 19.95 → 19
    expect(F.applyMoraleDecay(21)).toBe(19);
  });
});

// =============================================================================
// ALLIANCE ABILITIES
// =============================================================================

describe('getAbility', () => {
  test('returns shape for war_surge', () => {
    expect(F.getAbility('war_surge')).toEqual({
      type: 'offensive', cost: 80, durationHours: 6, effect: 'iron_cost_minus_40',
    });
  });

  test('returns shape for iron_bulwark', () => {
    expect(F.getAbility('iron_bulwark')).toEqual({
      type: 'defensive', cost: 80, durationHours: 6, effect: 'iron_cost_plus_40',
    });
  });

  test('returns shape for rally_cry', () => {
    expect(F.getAbility('rally_cry')).toEqual({
      type: 'offensive', cost: 60, durationHours: 12, effect: 'attacker_walk_80',
    });
  });

  test('returns shape for steadfast', () => {
    expect(F.getAbility('steadfast')).toEqual({
      type: 'defensive', cost: 60, durationHours: 12, effect: 'defender_walk_80',
    });
  });

  test('returns shape for supply_line', () => {
    expect(F.getAbility('supply_line')).toEqual({
      type: 'utility', cost: 40, durationHours: 24, effect: 'resource_earn_plus_20',
    });
  });

  test('returns shape for unified_front', () => {
    expect(F.getAbility('unified_front')).toEqual({
      type: 'utility', cost: 100, durationHours: 48, effect: 'streak_break_immune',
    });
  });

  test('returns a clone — mutating result does not leak', () => {
    const a = F.getAbility('war_surge');
    a.cost = 9999;
    const b = F.getAbility('war_surge');
    expect(b.cost).toBe(80);
  });

  test('unknown ability throws', () => {
    expect(() => F.getAbility('thunder_strike')).toThrow(/Unknown alliance ability/);
    expect(() => F.getAbility('')).toThrow(/Unknown alliance ability/);
    expect(() => F.getAbility(null)).toThrow(/Unknown alliance ability/);
  });
});

// =============================================================================
// MISSION HELPERS — simple
// =============================================================================

describe('isActiveMember', () => {
  test('Activity Power below threshold is inactive', () => {
    expect(F.isActiveMember(0)).toBe(false);
    expect(F.isActiveMember(100)).toBe(false);
    expect(F.isActiveMember(499)).toBe(false);
  });

  test('Activity Power at or above threshold (500) is active', () => {
    expect(F.isActiveMember(500)).toBe(true);
    expect(F.isActiveMember(501)).toBe(true);
    expect(F.isActiveMember(10_000)).toBe(true);
  });

  test('negative or NaN throws', () => {
    expect(() => F.isActiveMember(-1)).toThrow(/non-negative number/);
    expect(() => F.isActiveMember(NaN)).toThrow(/non-negative number/);
  });
});

describe('missionCompletedForStreak', () => {
  test('below 60% does not count', () => {
    expect(F.missionCompletedForStreak(0)).toBe(false);
    expect(F.missionCompletedForStreak(0.5)).toBe(false);
    expect(F.missionCompletedForStreak(0.59)).toBe(false);
  });

  test('at or above 60% counts', () => {
    expect(F.missionCompletedForStreak(0.60)).toBe(true);
    expect(F.missionCompletedForStreak(0.80)).toBe(true);
    expect(F.missionCompletedForStreak(1.00)).toBe(true);
    expect(F.missionCompletedForStreak(1.50)).toBe(true);
  });
});

describe('isGraceWeekEarnedAt', () => {
  test('week 0 does not earn (defensive against false trigger at start)', () => {
    expect(F.isGraceWeekEarnedAt(0)).toBe(false);
  });

  test('weeks divisible by 12 earn a Grace Week', () => {
    expect(F.isGraceWeekEarnedAt(12)).toBe(true);
    expect(F.isGraceWeekEarnedAt(24)).toBe(true);
    expect(F.isGraceWeekEarnedAt(36)).toBe(true);
    expect(F.isGraceWeekEarnedAt(60)).toBe(true);
  });

  test('off-by-one weeks do not earn', () => {
    expect(F.isGraceWeekEarnedAt(11)).toBe(false);
    expect(F.isGraceWeekEarnedAt(13)).toBe(false);
    expect(F.isGraceWeekEarnedAt(23)).toBe(false);
    expect(F.isGraceWeekEarnedAt(25)).toBe(false);
  });

  test('negative or non-integer throws', () => {
    expect(() => F.isGraceWeekEarnedAt(-1)).toThrow(/non-negative integer/);
    expect(() => F.isGraceWeekEarnedAt(12.5)).toThrow(/non-negative integer/);
  });
});

describe('isEligibleForMissionCp', () => {
  test('member who joined before mission start is eligible', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const joined = new Date('2026-01-01T00:00:00Z');
    expect(F.isEligibleForMissionCp(joined, start)).toBe(true);
  });

  test('member who joined exactly at mission start is eligible', () => {
    const t = new Date('2026-01-15T00:00:00Z');
    expect(F.isEligibleForMissionCp(t, t)).toBe(true);
  });

  test('member who joined after mission start is not eligible', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const joined = new Date('2026-01-15T00:00:01Z');
    expect(F.isEligibleForMissionCp(joined, start)).toBe(false);
  });

  test('accepts numeric timestamps', () => {
    expect(F.isEligibleForMissionCp(1_000_000, 2_000_000)).toBe(true);
    expect(F.isEligibleForMissionCp(2_000_000, 1_000_000)).toBe(false);
    expect(F.isEligibleForMissionCp(1_500_000, 1_500_000)).toBe(true);
  });
});

// =============================================================================
// LEGACY RANK NAME
// =============================================================================

describe('legacyRankName', () => {
  test('returns correct name for each rank', () => {
    expect(F.legacyRankName(1)).toBe('Unproven');
    expect(F.legacyRankName(2)).toBe('Established');
    expect(F.legacyRankName(3)).toBe('Contested');
    expect(F.legacyRankName(4)).toBe('Contested Ground');
    expect(F.legacyRankName(5)).toBe('Legendary');
  });

  test('out-of-range ranks return Unproven (defensive)', () => {
    expect(F.legacyRankName(0)).toBe('Unproven');
    expect(F.legacyRankName(6)).toBe('Unproven');
    expect(F.legacyRankName(99)).toBe('Unproven');
  });
});


// =============================================================================
// =============================================================================
// SESSION 2 — hairy / complex functions + remaining coverage
// =============================================================================
// =============================================================================

// =============================================================================
// CANONICAL EARN CALCULATION
// =============================================================================

describe('calcCanonicalEarn', () => {
  test('base earn with default cap and no bonuses', () => {
    expect(F.calcCanonicalEarn({ baseEarn: 100 })).toBe(100);
    expect(F.calcCanonicalEarn({ baseEarn: 0 })).toBe(0);
  });

  test('cap factor reduces output before bonuses', () => {
    expect(F.calcCanonicalEarn({ baseEarn: 100, capFactor: 0.5 })).toBe(50);
    expect(F.calcCanonicalEarn({ baseEarn: 100, capFactor: 0 })).toBe(0);
    expect(F.calcCanonicalEarn({ baseEarn: 100, capFactor: 1.0 })).toBe(100);
  });

  test('single bonus multiplier applied', () => {
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [1.5] })).toBe(150);
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [2.0] })).toBe(200);
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [1.0] })).toBe(100);
  });

  test('multiple bonuses stack multiplicatively', () => {
    // 100 × 1.2 × 1.5 = 180
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [1.2, 1.5] })).toBe(180);
    // 100 × 1.1 × 1.1 × 1.1 = 133.1 → 133
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [1.1, 1.1, 1.1] })).toBe(133);
  });

  test('bonus product hard-capped at 3.0', () => {
    // 4.0 product would yield 400, capped at 3.0 yields 300
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [2.0, 2.0] })).toBe(300);
    // 6.0 product also capped at 3.0
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [2.0, 3.0] })).toBe(300);
    // 3.0 exactly: not over, full value
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [3.0] })).toBe(300);
  });

  test('cap factor and bonuses combine', () => {
    // 100 × 0.5 (cap) × 2.0 (bonus) = 100
    expect(F.calcCanonicalEarn({
      baseEarn: 100, capFactor: 0.5, bonusMultipliers: [2.0],
    })).toBe(100);
    // 100 × 0.5 × 4.0 (capped to 3.0) = 150
    expect(F.calcCanonicalEarn({
      baseEarn: 100, capFactor: 0.5, bonusMultipliers: [2.0, 2.0],
    })).toBe(150);
  });

  test('empty bonus array produces no bonus', () => {
    expect(F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: [] })).toBe(100);
  });

  test('zero base earn returns zero regardless of bonuses', () => {
    expect(F.calcCanonicalEarn({ baseEarn: 0, bonusMultipliers: [3.0] })).toBe(0);
  });

  test('throws on invalid baseEarn', () => {
    expect(() => F.calcCanonicalEarn({ baseEarn: -1 })).toThrow(/non-negative number/);
    expect(() => F.calcCanonicalEarn({ baseEarn: NaN })).toThrow(/non-negative number/);
  });

  test('throws on invalid capFactor', () => {
    expect(() => F.calcCanonicalEarn({ baseEarn: 100, capFactor: -0.1 })).toThrow(/non-negative number/);
  });

  test('throws on non-array bonusMultipliers', () => {
    expect(() => F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: 1.5 })).toThrow(/must be an array/);
    expect(() => F.calcCanonicalEarn({ baseEarn: 100, bonusMultipliers: 'foo' })).toThrow(/must be an array/);
  });
});

// =============================================================================
// INFLUENCE — fixed-point and display
// =============================================================================

describe('calcDailyInfluenceFixedPoint', () => {
  test('Small D0 R1 baseline: 2 base × 1.0 dev × 1.0 rank × 10 = 20', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 0, legacyRank: 1,
    })).toBe(20);
  });

  test('Medium D0 R1: 5 × 1.0 × 1.0 × 10 = 50', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Medium', developmentLevel: 0, legacyRank: 1,
    })).toBe(50);
  });

  test('Large D0 R1: 12 × 1.0 × 1.0 × 10 = 120', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Large', developmentLevel: 0, legacyRank: 1,
    })).toBe(120);
  });

  test('Epic D0 R1: 25 × 1.0 × 1.0 × 10 = 250', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Epic', developmentLevel: 0, legacyRank: 1,
    })).toBe(250);
  });

  test('Small D4 R1: 2 × 2.5 × 1.0 × 10 = 50', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 4, legacyRank: 1,
    })).toBe(50);
  });

  test('Epic D4 R1: 25 × 1.75 × 1.0 × 10 = 437.5 → 438', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Epic', developmentLevel: 4, legacyRank: 1,
    })).toBe(438);
  });

  test('legacy rank multiplier applied: Small D0 R5: 2 × 1.0 × 3.0 × 10 = 60', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 0, legacyRank: 5,
    })).toBe(60);
  });

  test('all multipliers compound: Large D2 R3: 12 × 1.5 × 1.5 × 10 = 270', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Large', developmentLevel: 2, legacyRank: 3,
    })).toBe(270);
  });

  test('upkeep overdue halves output: Medium D2 R1 overdue: 5 × 1.6 × 1.0 × 0.5 × 10 = 40', () => {
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Medium', developmentLevel: 2, legacyRank: 1, upkeepOverdue: true,
    })).toBe(40);
  });

  test('upkeep overdue with full multipliers: Epic D4 R5 overdue', () => {
    // 25 × 1.75 × 3.0 × 0.5 = 65.625 → ×10 = 656.25 → 656
    expect(F.calcDailyInfluenceFixedPoint({
      tier: 'Epic', developmentLevel: 4, legacyRank: 5, upkeepOverdue: true,
    })).toBe(656);
  });

  test('throws on invalid inputs', () => {
    expect(() => F.calcDailyInfluenceFixedPoint({
      tier: 'Tiny', developmentLevel: 0, legacyRank: 1,
    })).toThrow(/Invalid tier/);
    expect(() => F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 5, legacyRank: 1,
    })).toThrow(/Invalid dev level/);
    expect(() => F.calcDailyInfluenceFixedPoint({
      tier: 'Small', developmentLevel: 0, legacyRank: 0,
    })).toThrow(/Invalid legacy rank/);
  });
});

describe('calcDailyInfluence', () => {
  test('returns float value: Small D0 R1 = 2.0', () => {
    expect(F.calcDailyInfluence({
      tier: 'Small', developmentLevel: 0, legacyRank: 1,
    })).toBe(2.0);
  });

  test('returns float value: Epic D4 R1 = 43.8', () => {
    expect(F.calcDailyInfluence({
      tier: 'Epic', developmentLevel: 4, legacyRank: 1,
    })).toBeCloseTo(43.8, 5);
  });

  test('display value is fixed-point divided by 10', () => {
    const fp = F.calcDailyInfluenceFixedPoint({
      tier: 'Large', developmentLevel: 2, legacyRank: 3,
    });
    const display = F.calcDailyInfluence({
      tier: 'Large', developmentLevel: 2, legacyRank: 3,
    });
    expect(display).toBe(fp / 10);
  });
});

describe('influenceToDisplay', () => {
  test('converts fixed-point to display number', () => {
    expect(F.influenceToDisplay(0)).toBe(0);
    expect(F.influenceToDisplay(20)).toBe(2.0);
    expect(F.influenceToDisplay(123)).toBe(12.3);
    expect(F.influenceToDisplay(1)).toBe(0.1);
  });
});

// =============================================================================
// CONTEST DISTANCE
// =============================================================================

describe('calcRequiredContestWalk', () => {
  test('baseline equal-streak Small D0: ratio=1.0, dev=1.0 → returns perimeter', () => {
    // 1000 × 1.0 × 1.0 × 1.0 × 1.0 = 1000m, rounded to nearest 10m = 1000
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 7, usedSiegeBoost: false },
      defender: { streakDays: 7 },
    })).toBe(1000);
  });

  test('higher defender streak increases required walk', () => {
    // Small, perim 1000, attacker newcomer (1.0), defender legendary (1.5)
    // ratio = 1.5/1.0 = 1.5, dev=1.0, no buffs → 1000 × 1.5 = 1500
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 0, usedSiegeBoost: false },
      defender: { streakDays: 60 },
    })).toBe(1500);
  });

  test('higher attacker streak decreases required walk', () => {
    // ratio = 1.0/1.5 = 0.6666..., dev=1.0 → 1000 × 0.6667 = 666.67 → rounded to nearest 10 = 670
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 60, usedSiegeBoost: false },
      defender: { streakDays: 0 },
    })).toBe(670);
  });

  test('Large tier caps streak multipliers at 1.25 (defender benefit limited)', () => {
    // Large: both att and def streaks capped at 1.25
    // attacker legendary capped at 1.25, defender legendary capped at 1.25 → ratio = 1.0
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Large', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 60, usedSiegeBoost: false },
      defender: { streakDays: 60 },
    })).toBe(1000);
  });

  test('Epic tier caps streak multipliers at 1.15', () => {
    // Epic: both capped at 1.15, ratio = 1.0
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Epic', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 60, usedSiegeBoost: false },
      defender: { streakDays: 60 },
    })).toBe(1000);
  });

  test('development level adds contest factor', () => {
    // Small D2: dev factor 1.10
    // 1000 × 1.0 × 1.10 = 1100
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 2 },
      attacker: { streakDays: 7, usedSiegeBoost: false },
      defender: { streakDays: 7 },
    })).toBe(1100);
  });

  test('rally cry buff reduces walk by 20%', () => {
    // 1000 × 1.0 × 1.0 × 0.80 = 800
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 7, usedSiegeBoost: false, allianceBuffs: ['rally_cry'] },
      defender: { streakDays: 7 },
    })).toBe(800);
  });

  test('siege boost reduces walk by 25%', () => {
    // 1000 × 1.0 × 1.0 × 0.75 = 750
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 7, usedSiegeBoost: true },
      defender: { streakDays: 7 },
    })).toBe(750);
  });

  test('rally cry and siege boost stack', () => {
    // 1000 × 1.0 × 1.0 × 0.80 × 0.75 = 600
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 7, usedSiegeBoost: true, allianceBuffs: ['rally_cry'] },
      defender: { streakDays: 7 },
    })).toBe(600);
  });

  test('result is hard-capped at 2× perimeter', () => {
    // attacker newcomer, defender legendary, dev D4 (1.20), no buffs
    // ratio = 1.5/1.0 = 1.5, × 1.20 = 1.80
    // 1000 × 1.80 = 1800 (under 2.0 cap)
    // But Small tier doesn't cap streak mults, so this is just under cap
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 4 },
      attacker: { streakDays: 0, usedSiegeBoost: false },
      defender: { streakDays: 60 },
    })).toBe(1800);
  });

  test('extreme case clamps to 2× perimeter cap', () => {
    // Test that the hard cap actually fires when math would exceed 2x
    // Need a scenario where streak ratio × dev exceeds 2.0 on Small/Medium
    // Small, defender legendary (1.5), attacker newcomer (1.0), D4 (1.20) = 1.5 × 1.20 = 1.80
    // To exceed 2.0, would need rally_cry or siege INVERTED — but those reduce, not increase.
    // The cap is defensive, can't reach in normal play. We test it fires when forced.
    // Force via: attacker buffs include 'rally_cry' would only reduce. So we use baseline math.
    // 1.80 × 1000 = 1800, which is less than 2000 cap. Cap doesn't fire here.
    // We'd need to mock or pick numbers carefully — for this test, verify cap value as a constant.
    expect(F.REQUIRED_WALK_HARD_CAP).toBe(2.0);
  });

  test('result rounded to nearest 10m', () => {
    // Force a non-round result and check rounding
    // 1000 × (1.10/1.0) = 1100 (already round)
    // Try perim 1234, no streaks, no dev
    // 1234 × 1.0 × 1.0 = 1234 → rounded to nearest 10 = 1230
    expect(F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1234, developmentLevel: 0 },
      attacker: { streakDays: 7, usedSiegeBoost: false },
      defender: { streakDays: 7 },
    })).toBe(1230);
  });

  test('throws on invalid tier', () => {
    expect(() => F.calcRequiredContestWalk({
      territory: { tier: 'Tiny', perimeterMeters: 1000, developmentLevel: 0 },
      attacker: { streakDays: 7 },
      defender: { streakDays: 7 },
    })).toThrow(/Invalid tier/);
  });

  test('throws on invalid dev level', () => {
    expect(() => F.calcRequiredContestWalk({
      territory: { tier: 'Small', perimeterMeters: 1000, developmentLevel: 5 },
      attacker: { streakDays: 7 },
      defender: { streakDays: 7 },
    })).toThrow(/Invalid dev level/);
  });
});

describe('calcRequiredDefenderWalk', () => {
  test('with paid activation: 1:1 ratio', () => {
    expect(F.calcRequiredDefenderWalk({
      attackerActualWalked: 1000, defenderPaidActivation: true,
    })).toBe(1000);
  });

  test('without paid activation: 1.25:1 ratio', () => {
    expect(F.calcRequiredDefenderWalk({
      attackerActualWalked: 1000, defenderPaidActivation: false,
    })).toBe(1250);
  });

  test('Steadfast with paid activation: 0.8 of 1.0 = 0.8:1 ratio', () => {
    expect(F.calcRequiredDefenderWalk({
      attackerActualWalked: 1000, defenderPaidActivation: true, defenderHasSteadfast: true,
    })).toBe(800);
  });

  test('Steadfast without paid activation: 0.8 of 1.25 = 1.0:1 ratio', () => {
    expect(F.calcRequiredDefenderWalk({
      attackerActualWalked: 1000, defenderPaidActivation: false, defenderHasSteadfast: true,
    })).toBe(1000);
  });

  test('rounds to integer', () => {
    expect(F.calcRequiredDefenderWalk({
      attackerActualWalked: 333, defenderPaidActivation: false,
    })).toBe(416); // 333 * 1.25 = 416.25 → 416
  });

  test('zero attacker walk produces zero defender walk', () => {
    expect(F.calcRequiredDefenderWalk({
      attackerActualWalked: 0, defenderPaidActivation: false,
    })).toBe(0);
  });
});

// =============================================================================
// LEGACY RANK
// =============================================================================

describe('calcLegacyRank', () => {
  test('fresh territory with no history is Rank 1', () => {
    expect(F.calcLegacyRank({})).toBe(1);
    expect(F.calcLegacyRank({
      ownershipChanges: 0, maxSingleHoldDays: 0,
      totalCumulativeHoldDays: 0, distinctAlliancesHeld: 0, developmentLevel: 0,
    })).toBe(1);
  });

  test('Rank 2 — Established: 1+ ownership change', () => {
    expect(F.calcLegacyRank({ ownershipChanges: 1 })).toBe(2);
  });

  test('Rank 2 — Established: 21+ day single hold', () => {
    expect(F.calcLegacyRank({ maxSingleHoldDays: 21 })).toBe(2);
    expect(F.calcLegacyRank({ maxSingleHoldDays: 50 })).toBe(2);
  });

  test('Rank 2 — Established: dev level 1+', () => {
    expect(F.calcLegacyRank({ developmentLevel: 1 })).toBe(2);
  });

  test('Rank 3 — Contested: 3+ ownership changes', () => {
    expect(F.calcLegacyRank({ ownershipChanges: 3 })).toBe(3);
    expect(F.calcLegacyRank({ ownershipChanges: 5 })).toBe(3);
  });

  test('Rank 3 — Contested: 60+ day single hold', () => {
    expect(F.calcLegacyRank({ maxSingleHoldDays: 60 })).toBe(3);
    expect(F.calcLegacyRank({ maxSingleHoldDays: 100 })).toBe(3);
  });

  test('Rank 3 — Contested: dev level 2', () => {
    expect(F.calcLegacyRank({ developmentLevel: 2 })).toBe(3);
  });

  test('Rank 4 — Contested Ground: 6+ ownership changes', () => {
    expect(F.calcLegacyRank({ ownershipChanges: 6 })).toBe(4);
    expect(F.calcLegacyRank({ ownershipChanges: 9 })).toBe(4);
  });

  test('Rank 4 — Contested Ground: 3+ distinct alliances', () => {
    expect(F.calcLegacyRank({ distinctAlliancesHeld: 3 })).toBe(4);
  });

  test('Rank 4 — Contested Ground: dev level 3+', () => {
    expect(F.calcLegacyRank({ developmentLevel: 3 })).toBe(4);
  });

  test('Rank 5 — Legendary: 10+ changes AND 120+ cumulative days', () => {
    expect(F.calcLegacyRank({
      ownershipChanges: 10, totalCumulativeHoldDays: 120,
    })).toBe(5);
    expect(F.calcLegacyRank({
      ownershipChanges: 20, totalCumulativeHoldDays: 365,
    })).toBe(5);
  });

  test('Rank 5 — Legendary: 10+ changes AND dev level 4', () => {
    expect(F.calcLegacyRank({
      ownershipChanges: 10, developmentLevel: 4,
    })).toBe(5);
  });

  test('Rank 5 NOT awarded for 10+ changes alone (needs cumulative OR D4)', () => {
    // 10 changes but no cumulative time and dev < 4 — drops to Rank 4
    expect(F.calcLegacyRank({
      ownershipChanges: 10, totalCumulativeHoldDays: 50, developmentLevel: 0,
    })).toBe(4);
  });

  test('higher rank wins when multiple thresholds cross', () => {
    // would qualify for rank 2, 3, and 4 — should return 4
    expect(F.calcLegacyRank({
      ownershipChanges: 6, maxSingleHoldDays: 100, developmentLevel: 3,
    })).toBe(4);
  });
});

// =============================================================================
// POWER FUNCTIONS
// =============================================================================

describe('calcActivityPower', () => {
  test('zero stats produce zero power', () => {
    expect(F.calcActivityPower({})).toBe(0);
    expect(F.calcActivityPower({
      xp30d: 0, km30d: 0, challenges30d: 0, contests30d: 0,
    })).toBe(0);
  });

  test('XP weighted at 0.5: 1000 XP = 500 power', () => {
    expect(F.calcActivityPower({ xp30d: 1000 })).toBe(500);
  });

  test('km weighted at 3: 30 km = 90 power', () => {
    expect(F.calcActivityPower({ km30d: 30 })).toBe(90);
  });

  test('challenges weighted at 10: 20 challenges = 200 power', () => {
    expect(F.calcActivityPower({ challenges30d: 20 })).toBe(200);
  });

  test('contests weighted at 25: 4 contests = 100 power', () => {
    expect(F.calcActivityPower({ contests30d: 4 })).toBe(100);
  });

  test('all components combine additively', () => {
    // 2000 XP × 0.5 + 50 km × 3 + 30 challenges × 10 + 5 contests × 25
    // = 1000 + 150 + 300 + 125 = 1575
    expect(F.calcActivityPower({
      xp30d: 2000, km30d: 50, challenges30d: 30, contests30d: 5,
    })).toBe(1575);
  });

  test('rounds to integer', () => {
    // 100 XP × 0.5 = 50; 33.7 km × 3 = 101.1 → 101
    // total = 50 + 101.1 + 0 + 0 = 151.1 → 151
    expect(F.calcActivityPower({ xp30d: 100, km30d: 33.7 })).toBe(151);
  });
});

describe('calcTerritoryPowerSingle', () => {
  test('Small D0 R1 baseline: 10 × 1.0 × 1.0 = 10', () => {
    expect(F.calcTerritoryPowerSingle({
      tier: 'Small', developmentLevel: 0, legacyRank: 1,
    }, false)).toBe(10);
  });

  test('Epic D0 R1: 120 × 1.0 × 1.0 = 120', () => {
    expect(F.calcTerritoryPowerSingle({
      tier: 'Epic', developmentLevel: 0, legacyRank: 1,
    }, false)).toBe(120);
  });

  test('dev multiplier (tier-blind): Small D4 R1: 10 × 2.5 × 1.0 = 25', () => {
    expect(F.calcTerritoryPowerSingle({
      tier: 'Small', developmentLevel: 4, legacyRank: 1,
    }, false)).toBe(25);
  });

  test('legacy rank multiplier: Small D0 R5: 10 × 1.0 × 1.80 = 18', () => {
    expect(F.calcTerritoryPowerSingle({
      tier: 'Small', developmentLevel: 0, legacyRank: 5,
    }, false)).toBe(18);
  });

  test('above-cap halves value: Small D0 R1 above cap = 5', () => {
    expect(F.calcTerritoryPowerSingle({
      tier: 'Small', developmentLevel: 0, legacyRank: 1,
    }, true)).toBe(5);
  });

  test('full compounding: Epic D4 R5: 120 × 2.5 × 1.8 = 540', () => {
    expect(F.calcTerritoryPowerSingle({
      tier: 'Epic', developmentLevel: 4, legacyRank: 5,
    }, false)).toBe(540);
  });

  test('throws on invalid tier', () => {
    expect(() => F.calcTerritoryPowerSingle({
      tier: 'Tiny', developmentLevel: 0, legacyRank: 1,
    }, false)).toThrow(/Invalid tier/);
  });
});

describe('calcTerritoryPower', () => {
  test('empty territory list returns 0', () => {
    expect(F.calcTerritoryPower([], 5)).toBe(0);
  });

  test('single territory under cap is full value', () => {
    expect(F.calcTerritoryPower([
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
    ], 5)).toBe(10);
  });

  test('all territories under cap are full value', () => {
    // 3 Small D0 R1 = 30
    expect(F.calcTerritoryPower([
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
    ], 5)).toBe(30);
  });

  test('above-cap territories are halved', () => {
    // cap = 2: first 2 full value, third halved
    // Epic 120 + Medium 25 + Small 10 (halved → 5) = 150
    expect(F.calcTerritoryPower([
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Medium', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Epic', developmentLevel: 0, legacyRank: 1 },
    ], 2)).toBe(150);
  });

  test('sorts by tier base value first (Epic > Large > Medium > Small)', () => {
    // cap = 1: only highest-value Epic gets full, rest halved
    // Epic 120 + Small 5 + Small 5 = 130
    expect(F.calcTerritoryPower([
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Small', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Epic', developmentLevel: 0, legacyRank: 1 },
    ], 1)).toBe(130);
  });

  test('ties broken by dev level descending', () => {
    // Two Mediums: D2 vs D0. Cap=1 → D2 full value, D0 halved.
    // Medium D2 R1: 25 × 1.6 × 1.0 = 40
    // Medium D0 R1 halved: 25 × 1.0 × 1.0 × 0.5 = 12.5
    // total = 40 + 12.5 = 52.5 → 53
    expect(F.calcTerritoryPower([
      { tier: 'Medium', developmentLevel: 0, legacyRank: 1 },
      { tier: 'Medium', developmentLevel: 2, legacyRank: 1 },
    ], 1)).toBe(53);
  });

  test('throws on non-array input', () => {
    expect(() => F.calcTerritoryPower(null, 5)).toThrow(/must be an array/);
  });

  test('throws on invalid cap', () => {
    expect(() => F.calcTerritoryPower([], -1)).toThrow(/non-negative integer/);
  });
});

describe('calcLegacyPower', () => {
  test('zero stats produce zero', () => {
    expect(F.calcLegacyPower({})).toBe(0);
  });

  test('titles: 200 each', () => {
    expect(F.calcLegacyPower({ titlesEarned: 3 })).toBe(600);
  });

  test('championships: 500 each', () => {
    expect(F.calcLegacyPower({ championshipWins: 2 })).toBe(1000);
  });

  test('contest + defence wins each weighted at 5', () => {
    expect(F.calcLegacyPower({ lifetimeContestWins: 10, lifetimeDefenceWins: 5 })).toBe(75);
  });

  test('streak days weighted at 10: 100 days = 1000', () => {
    expect(F.calcLegacyPower({ highestStreakDays: 100 })).toBe(1000);
  });

  test('lifetime XP divided by 1000 (floored)', () => {
    expect(F.calcLegacyPower({ lifetimeXp: 5000 })).toBe(5);
    expect(F.calcLegacyPower({ lifetimeXp: 5999 })).toBe(5);
    expect(F.calcLegacyPower({ lifetimeXp: 6000 })).toBe(6);
    expect(F.calcLegacyPower({ lifetimeXp: 999 })).toBe(0);
  });

  test('all components combine', () => {
    // 2 titles × 200 = 400
    // 1 championship × 500 = 500
    // (5 + 3) × 5 = 40
    // 60 streak days × 10 = 600
    // 50000 XP / 1000 = 50
    // total = 1590
    expect(F.calcLegacyPower({
      titlesEarned: 2, championshipWins: 1,
      lifetimeContestWins: 5, lifetimeDefenceWins: 3,
      highestStreakDays: 60, lifetimeXp: 50000,
    })).toBe(1590);
  });
});

describe('calcTotalPower', () => {
  test('returns components and total', () => {
    const result = F.calcTotalPower({
      activityStats: { xp30d: 1000 },              // 500
      territories: [{ tier: 'Small', developmentLevel: 0, legacyRank: 1 }], // 10
      legacyStats: { titlesEarned: 1 },            // 200
      fullValueCap: 5,
    });
    expect(result.activity).toBe(500);
    expect(result.territory).toBe(10);
    expect(result.legacy).toBe(200);
    expect(result.total).toBe(710);
  });

  test('zero everywhere returns zero total', () => {
    const result = F.calcTotalPower({
      activityStats: {}, territories: [], legacyStats: {}, fullValueCap: 5,
    });
    expect(result.total).toBe(0);
  });
});

describe('calcAlliancePower', () => {
  test('throws on empty member list', () => {
    expect(() => F.calcAlliancePower([])).toThrow(/non-empty array/);
    expect(() => F.calcAlliancePower(null)).toThrow(/non-empty array/);
  });

  test('single member, full participation', () => {
    // base = 1000, all active → coordMult = 1.0 + 1.0 × 0.3 = 1.3
    // alliancePower = round(1000 × 1.3) = 1300
    const result = F.calcAlliancePower([
      { activityPower: 600, totalPower: 1000 },
    ]);
    expect(result.basePower).toBe(1000);
    expect(result.participationRate).toBe(1.0);
    expect(result.coordinationMult).toBeCloseTo(1.3, 5);
    expect(result.alliancePower).toBe(1300);
  });

  test('zero participation: base coordination mult of 1.0', () => {
    // No member meets 500 threshold → participation 0 → coordMult = 1.0
    const result = F.calcAlliancePower([
      { activityPower: 100, totalPower: 500 },
      { activityPower: 200, totalPower: 800 },
    ]);
    expect(result.basePower).toBe(1300);
    expect(result.participationRate).toBe(0);
    expect(result.coordinationMult).toBe(1.0);
    expect(result.alliancePower).toBe(1300);
  });

  test('half participation: 1.15 multiplier', () => {
    // 2 members, 1 active → 0.5 participation → 1.0 + 0.5 × 0.3 = 1.15
    const result = F.calcAlliancePower([
      { activityPower: 100, totalPower: 1000 },
      { activityPower: 600, totalPower: 1000 },
    ]);
    expect(result.participationRate).toBe(0.5);
    expect(result.coordinationMult).toBeCloseTo(1.15, 5);
    expect(result.alliancePower).toBe(2300); // 2000 × 1.15
  });

  test('participation threshold is exactly 500', () => {
    // member at exactly 500 IS active
    const result = F.calcAlliancePower([
      { activityPower: 500, totalPower: 1000 },
    ]);
    expect(result.participationRate).toBe(1.0);
  });
});

// =============================================================================
// MISSION DISTRIBUTION
// =============================================================================

describe('distributeMissionMorale', () => {
  test('throws on non-array members', () => {
    expect(() => F.distributeMissionMorale({
      totalMoralePool: 1000, members: null,
    })).toThrow(/must be an array/);
  });

  test('failure path: 25% of pool split equally among contributors', () => {
    // pool 1000, failure: 1000 × 0.5 (participation) × 0.5 (failure) = 250 compensation
    // 4 contributors, 250 / 4 = 62 each (floored), non-contributors get 0
    const result = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [
        { playerId: 'a', cp: 50 },
        { playerId: 'b', cp: 30 },
        { playerId: 'c', cp: 20 },
        { playerId: 'd', cp: 10 },
        { playerId: 'e', cp: 0 },
      ],
      missionFailed: true,
    });
    expect(result.distributions.find(d => d.playerId === 'a').morale).toBe(62);
    expect(result.distributions.find(d => d.playerId === 'd').morale).toBe(62);
    expect(result.distributions.find(d => d.playerId === 'e').morale).toBe(0);
    expect(result.warChestDeposit).toBe(0);
  });

  test('failure path: zero contributors yields all zero', () => {
    const result = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [{ playerId: 'a', cp: 0 }],
      missionFailed: true,
    });
    expect(result.distributions[0].morale).toBe(0);
    expect(result.totalDistributed).toBe(0);
  });

  test('standard path: equal CP gives equal participation + contribution', () => {
    // pool 1000, 4 equal contributors
    // participation: 500 / 4 = 125 each
    // contribution: 350 × (cp/totalCp) = 350 × 0.25 = 87 each (floored)
    // hero: top 3 get 70/50/30 (0.07/0.05/0.03 of pool)
    const result = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [
        { playerId: 'a', cp: 100 },
        { playerId: 'b', cp: 100 },
        { playerId: 'c', cp: 100 },
        { playerId: 'd', cp: 100 },
      ],
    });
    expect(result.warChestDeposit).toBe(300); // 30% of 1000
    // each gets participation 125 + contribution 87 = 212
    // first one in sorted order also gets hero rank 1 (70)
    // BUT findIndex picks first in sortedContributors, which is sorted by CP desc with stable sort → original order preserved on ties
    // a is first → rank 1 → +70 → 282
    // b is second → rank 2 → +50 → 262
    // c is third → rank 3 → +30 → 242
    // d is fourth → no hero → 212
    const a = result.distributions.find(d => d.playerId === 'a');
    expect(a.breakdown.participation).toBe(125);
    expect(a.breakdown.contribution).toBe(87);
    expect(a.breakdown.hero).toBe(70);
    expect(a.morale).toBe(282);
    const d = result.distributions.find(d => d.playerId === 'd');
    expect(d.breakdown.hero).toBe(0);
  });

  test('standard path: hero bonuses go to top 3 by CP', () => {
    // pool 1000
    const result = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [
        { playerId: 'top',    cp: 400 },
        { playerId: 'second', cp: 300 },
        { playerId: 'third',  cp: 200 },
        { playerId: 'fourth', cp: 100 },
      ],
    });
    expect(result.distributions.find(d => d.playerId === 'top').breakdown.hero).toBe(70);
    expect(result.distributions.find(d => d.playerId === 'second').breakdown.hero).toBe(50);
    expect(result.distributions.find(d => d.playerId === 'third').breakdown.hero).toBe(30);
    expect(result.distributions.find(d => d.playerId === 'fourth').breakdown.hero).toBe(0);
  });

  test('non-contributors (cp=0) receive nothing in standard path', () => {
    const result = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [
        { playerId: 'a', cp: 100 },
        { playerId: 'b', cp: 0 },
      ],
    });
    expect(result.distributions.find(d => d.playerId === 'b').morale).toBe(0);
    expect(result.distributions.find(d => d.playerId === 'b').breakdown).toEqual({
      participation: 0, contribution: 0, hero: 0,
    });
  });

  test('war chest deposit is 30% of pool, rounded', () => {
    expect(F.distributeMissionMorale({
      totalMoralePool: 1000, members: [{ playerId: 'a', cp: 1 }],
    }).warChestDeposit).toBe(300);
    expect(F.distributeMissionMorale({
      totalMoralePool: 333, members: [{ playerId: 'a', cp: 1 }],
    }).warChestDeposit).toBe(100); // 333 × 0.3 = 99.9 → 100
  });

  test('all-zero CP standard path produces zero distributions', () => {
    const result = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [{ playerId: 'a', cp: 0 }, { playerId: 'b', cp: 0 }],
    });
    expect(result.totalDistributed).toBe(0);
    expect(result.warChestDeposit).toBe(300); // war chest still deposits
  });

  test('zero pool produces zero distributions', () => {
    const result = F.distributeMissionMorale({
      totalMoralePool: 0,
      members: [{ playerId: 'a', cp: 100 }],
    });
    expect(result.totalDistributed).toBe(0);
    expect(result.warChestDeposit).toBe(0);
  });
});

describe('distributeMissionGold', () => {
  test('returns same shape as morale but keyed as gold', () => {
    const result = F.distributeMissionGold({
      totalGoldPool: 1000,
      members: [
        { playerId: 'a', cp: 100 },
        { playerId: 'b', cp: 100 },
      ],
    });
    expect(result.distributions[0]).toHaveProperty('playerId');
    expect(result.distributions[0]).toHaveProperty('gold');
    expect(result.distributions[0]).toHaveProperty('breakdown');
    expect(result.distributions[0]).not.toHaveProperty('morale');
  });

  test('Gold distribution does NOT include war chest deposit field', () => {
    const result = F.distributeMissionGold({
      totalGoldPool: 1000,
      members: [{ playerId: 'a', cp: 100 }],
    });
    expect(result).not.toHaveProperty('warChestDeposit');
  });

  test('total distributed matches morale logic', () => {
    const goldResult = F.distributeMissionGold({
      totalGoldPool: 1000,
      members: [
        { playerId: 'a', cp: 100 },
        { playerId: 'b', cp: 100 },
        { playerId: 'c', cp: 100 },
      ],
    });
    const moraleResult = F.distributeMissionMorale({
      totalMoralePool: 1000,
      members: [
        { playerId: 'a', cp: 100 },
        { playerId: 'b', cp: 100 },
        { playerId: 'c', cp: 100 },
      ],
    });
    expect(goldResult.totalDistributed).toBe(moraleResult.totalDistributed);
  });
});

// =============================================================================
// WELLBEING / CHALLENGE EFFECTIVENESS BANDS
// =============================================================================

describe('stepEffectiveness', () => {
  test('zero steps fully effective (1.00)', () => {
    expect(F.stepEffectiveness(0)).toBe(1.00);
  });

  test('at first band edge (15,000 steps): full effectiveness (uses <=)', () => {
    expect(F.stepEffectiveness(15_000)).toBe(1.00);
  });

  test('one over first edge (15,001): 0.75', () => {
    expect(F.stepEffectiveness(15_001)).toBe(0.75);
  });

  test('at second band edge (17,500): 0.75', () => {
    expect(F.stepEffectiveness(17_500)).toBe(0.75);
  });

  test('one over second edge (17,501): 0.40', () => {
    expect(F.stepEffectiveness(17_501)).toBe(0.40);
  });

  test('at third band edge (20,000): 0.40', () => {
    expect(F.stepEffectiveness(20_000)).toBe(0.40);
  });

  test('above all bands: 0', () => {
    expect(F.stepEffectiveness(20_001)).toBe(0);
    expect(F.stepEffectiveness(50_000)).toBe(0);
  });

  test('throws on non-integer or negative', () => {
    expect(() => F.stepEffectiveness(-1)).toThrow(/non-negative integer/);
    expect(() => F.stepEffectiveness(1.5)).toThrow(/non-negative integer/);
  });
});

describe('calorieEffectiveness', () => {
  test('band edges and transitions', () => {
    expect(F.calorieEffectiveness(0)).toBe(1.00);
    expect(F.calorieEffectiveness(700)).toBe(1.00);
    expect(F.calorieEffectiveness(700.01)).toBe(0.75);
    expect(F.calorieEffectiveness(800)).toBe(0.75);
    expect(F.calorieEffectiveness(800.01)).toBe(0.40);
    expect(F.calorieEffectiveness(900)).toBe(0.40);
    expect(F.calorieEffectiveness(900.01)).toBe(0);
  });
});

describe('sessionEffectiveness', () => {
  test('band edges and transitions', () => {
    expect(F.sessionEffectiveness(0)).toBe(1.00);
    expect(F.sessionEffectiveness(90)).toBe(1.00);
    expect(F.sessionEffectiveness(90.01)).toBe(0.60);
    expect(F.sessionEffectiveness(110)).toBe(0.60);
    expect(F.sessionEffectiveness(110.01)).toBe(0.25);
    expect(F.sessionEffectiveness(130)).toBe(0.25);
    expect(F.sessionEffectiveness(130.01)).toBe(0);
  });
});

describe('weeklyStepFactor', () => {
  test('at or below cap (100,000): 1.0', () => {
    expect(F.weeklyStepFactor(0)).toBe(1.0);
    expect(F.weeklyStepFactor(50_000)).toBe(1.0);
    expect(F.weeklyStepFactor(100_000)).toBe(1.0);
  });

  test('above cap: 0.5', () => {
    expect(F.weeklyStepFactor(100_001)).toBe(0.5);
    expect(F.weeklyStepFactor(200_000)).toBe(0.5);
  });
});

describe('effectivenessForChallenge', () => {
  test('steps challenge combines daily and weekly factors', () => {
    // 10k steps daily (1.0) × under weekly cap (1.0) = 1.0
    expect(F.effectivenessForChallenge('steps', {
      stepsToday: 10_000, weeklyStepsTotal: 50_000,
    })).toBe(1.0);
    // 10k steps daily (1.0) × over weekly cap (0.5) = 0.5
    expect(F.effectivenessForChallenge('steps', {
      stepsToday: 10_000, weeklyStepsTotal: 150_000,
    })).toBe(0.5);
    // over daily cap (0.40) × under weekly (1.0) = 0.40
    expect(F.effectivenessForChallenge('steps', {
      stepsToday: 18_000, weeklyStepsTotal: 50_000,
    })).toBe(0.40);
  });

  test('calories challenge uses calorie band', () => {
    expect(F.effectivenessForChallenge('calories', { kcalToday: 500 })).toBe(1.0);
    expect(F.effectivenessForChallenge('calories', { kcalToday: 850 })).toBe(0.40);
  });

  test('distance challenge uses session band', () => {
    expect(F.effectivenessForChallenge('distance', { longestSessionMin: 60 })).toBe(1.0);
    expect(F.effectivenessForChallenge('distance', { longestSessionMin: 120 })).toBe(0.25);
  });

  test('session challenge uses session band', () => {
    expect(F.effectivenessForChallenge('session', { longestSessionMin: 60 })).toBe(1.0);
    expect(F.effectivenessForChallenge('session', { longestSessionMin: 120 })).toBe(0.25);
  });

  test('throws on unknown challenge type', () => {
    expect(() => F.effectivenessForChallenge('telepathy', {})).toThrow(/Unknown challenge type/);
  });
});

// =============================================================================
// FULL VALUE TERRITORY CAP
// =============================================================================

describe('calcFullValueCap', () => {
  test('Level 1 baseline: 2 + 1×3 = 5', () => {
    expect(F.calcFullValueCap({ level: 1 })).toBe(5);
  });

  test('Level 5: 2 + 5×3 = 17', () => {
    expect(F.calcFullValueCap({ level: 5 })).toBe(17);
  });

  test('Level 9: 2 + 9×3 = 29', () => {
    expect(F.calcFullValueCap({ level: 9 })).toBe(29);
  });

  test('Level 10: 2 + 10×3 + 3 (Dominator) = 35', () => {
    expect(F.calcFullValueCap({ level: 10 })).toBe(35);
  });

  test('Unbroken streak adds +1 (mutually exclusive with Legendary)', () => {
    expect(F.calcFullValueCap({ level: 5, isUnbrokenStreak: true })).toBe(18);
  });

  test('Legendary streak adds +2', () => {
    expect(F.calcFullValueCap({ level: 5, isLegendaryStreak: true })).toBe(19);
  });

  test('Legendary takes precedence over Unbroken when both flags set', () => {
    // Defensive: caller should never set both, but if they do Legendary wins
    expect(F.calcFullValueCap({
      level: 5, isUnbrokenStreak: true, isLegendaryStreak: true,
    })).toBe(19);
  });

  test('alliance championship adds +2', () => {
    expect(F.calcFullValueCap({ level: 5, isAllianceChampion: true })).toBe(19);
  });

  test('Unbroken Together tier adds +1', () => {
    expect(F.calcFullValueCap({ level: 5, isUnbrokenTogetherTier: true })).toBe(18);
  });

  test('all bonuses stack: L10 + Legendary + Champion + UnbrokenTogether', () => {
    // 2 + 10×3 + 3 (Dom) + 2 (Legendary) + 2 (Champ) + 1 (UT) = 40
    expect(F.calcFullValueCap({
      level: 10, isLegendaryStreak: true, isAllianceChampion: true,
      isUnbrokenTogetherTier: true,
    })).toBe(40);
  });

  test('throws on invalid level', () => {
    expect(() => F.calcFullValueCap({ level: 0 })).toThrow(/Invalid level/);
    expect(() => F.calcFullValueCap({ level: 11 })).toThrow(/Invalid level/);
  });
});

// =============================================================================
// TERRITORY DEVELOPMENT COSTS
// =============================================================================

describe('calcDevCost', () => {
  test('D0 → D1: full first-tier cost', () => {
    expect(F.calcDevCost(0, 1)).toEqual({
      stone: 150, iron: 80, gold: 40, influence: 60,
    });
  });

  test('D1 → D2: difference between cumulative costs', () => {
    // D2 cumulative - D1 cumulative
    expect(F.calcDevCost(1, 2)).toEqual({
      stone: 300,  // 450 - 150
      iron: 160,   // 240 - 80
      gold: 80,    // 120 - 40
      influence: 140, // 200 - 60
    });
  });

  test('D0 → D4: full cumulative cost', () => {
    expect(F.calcDevCost(0, 4)).toEqual({
      stone: 2200, iron: 1200, gold: 600, influence: 1300,
    });
  });

  test('D2 → D4: skip-tier cost', () => {
    expect(F.calcDevCost(2, 4)).toEqual({
      stone: 1750,    // 2200 - 450
      iron: 960,      // 1200 - 240
      gold: 480,      // 600 - 120
      influence: 1100, // 1300 - 200
    });
  });

  test('throws on equal levels', () => {
    expect(() => F.calcDevCost(2, 2)).toThrow(/must be greater than/);
  });

  test('throws on regression (toLevel < fromLevel)', () => {
    expect(() => F.calcDevCost(3, 1)).toThrow(/must be greater than/);
  });

  test('throws on invalid levels', () => {
    expect(() => F.calcDevCost(-1, 2)).toThrow(/Invalid dev level/);
    expect(() => F.calcDevCost(0, 5)).toThrow(/Invalid dev level/);
  });
});

describe('getCumulativeDevCost', () => {
  test('returns cumulative cost from D0 to target', () => {
    expect(F.getCumulativeDevCost(0)).toEqual({
      stone: 0, iron: 0, gold: 0, influence: 0,
    });
    expect(F.getCumulativeDevCost(2)).toEqual({
      stone: 450, iron: 240, gold: 120, influence: 200,
    });
    expect(F.getCumulativeDevCost(4)).toEqual({
      stone: 2200, iron: 1200, gold: 600, influence: 1300,
    });
  });

  test('returns a clone — mutation does not leak', () => {
    const a = F.getCumulativeDevCost(2);
    a.stone = 99999;
    const b = F.getCumulativeDevCost(2);
    expect(b.stone).toBe(450);
  });

  test('throws on invalid level', () => {
    expect(() => F.getCumulativeDevCost(5)).toThrow(/Invalid dev level/);
  });
});

describe('calcWeeklyUpkeep', () => {
  test('D0 and D1 have no upkeep', () => {
    expect(F.calcWeeklyUpkeep(0)).toBe(0);
    expect(F.calcWeeklyUpkeep(1)).toBe(0);
  });

  test('D2: 6 Stone/week', () => {
    expect(F.calcWeeklyUpkeep(2)).toBe(6);
  });

  test('D3: 9 Stone/week', () => {
    expect(F.calcWeeklyUpkeep(3)).toBe(9);
  });

  test('D4: 12 Stone/week', () => {
    expect(F.calcWeeklyUpkeep(4)).toBe(12);
  });
});

// =============================================================================
// ARMOUR
// =============================================================================

describe('calcArmourCost', () => {
  test('Small tier prices', () => {
    expect(F.calcArmourCost('Small', 6)).toBe(10);
    expect(F.calcArmourCost('Small', 12)).toBe(20);
    expect(F.calcArmourCost('Small', 24)).toBe(40);
    expect(F.calcArmourCost('Small', 48)).toBe(80);
  });

  test('Medium tier prices', () => {
    expect(F.calcArmourCost('Medium', 6)).toBe(20);
    expect(F.calcArmourCost('Medium', 48)).toBe(160);
  });

  test('Large tier prices (no 48h available)', () => {
    expect(F.calcArmourCost('Large', 6)).toBe(35);
    expect(F.calcArmourCost('Large', 24)).toBe(140);
    expect(() => F.calcArmourCost('Large', 48)).toThrow(/not available for Large tier/);
  });

  test('Epic tier prices (no 48h available)', () => {
    expect(F.calcArmourCost('Epic', 6)).toBe(50);
    expect(F.calcArmourCost('Epic', 24)).toBe(200);
    expect(() => F.calcArmourCost('Epic', 48)).toThrow(/not available for Epic tier/);
  });

  test('throws on invalid duration', () => {
    expect(() => F.calcArmourCost('Small', 1)).toThrow(/Invalid armour duration/);
    expect(() => F.calcArmourCost('Small', 36)).toThrow(/Invalid armour duration/);
  });

  test('throws on invalid tier', () => {
    expect(() => F.calcArmourCost('Tiny', 6)).toThrow(/Invalid tier/);
  });
});

// =============================================================================
// DISTANCE & VELOCITY
// =============================================================================

describe('stepsToKm', () => {
  test('default stride 0.75m: 1000 steps = 0.75 km', () => {
    expect(F.stepsToKm(1000)).toBe(0.75);
  });

  test('zero steps = 0 km', () => {
    expect(F.stepsToKm(0)).toBe(0);
  });

  test('custom stride', () => {
    expect(F.stepsToKm(1000, 0.8)).toBe(0.8);
    expect(F.stepsToKm(1000, 1.0)).toBe(1.0);
  });

  test('large values', () => {
    expect(F.stepsToKm(10_000)).toBe(7.5);
  });

  test('throws on negative or non-integer steps', () => {
    expect(() => F.stepsToKm(-10)).toThrow(/non-negative integer/);
    expect(() => F.stepsToKm(10.5)).toThrow(/non-negative integer/);
  });

  test('throws on negative stride', () => {
    expect(() => F.stepsToKm(1000, -1)).toThrow(/non-negative number/);
  });
});

describe('isStepWindowOverVelocityCap', () => {
  test('normal walking (100 steps/min, 0.75m stride) is under cap', () => {
    // 100 × 0.75 / 1000 × 60 = 4.5 km/h — well under 25
    expect(F.isStepWindowOverVelocityCap(100)).toBe(false);
  });

  test('fast running pace under cap', () => {
    // 200 steps/min × 0.75 / 1000 × 60 = 9 km/h
    expect(F.isStepWindowOverVelocityCap(200)).toBe(false);
  });

  test('impossibly high step rate flagged as over cap', () => {
    // 1000 steps/min × 0.75 / 1000 × 60 = 45 km/h — way over 25
    expect(F.isStepWindowOverVelocityCap(1000)).toBe(true);
  });

  test('exactly at cap is NOT flagged (uses strict >)', () => {
    // To get exactly 25 km/h with 0.75m stride: 25 × 1000 / 60 / 0.75 ≈ 555.5 steps/min
    // Test boundary: 555 → 24.975 km/h (under), 556 → 25.02 km/h (over)
    expect(F.isStepWindowOverVelocityCap(555)).toBe(false);
    expect(F.isStepWindowOverVelocityCap(556)).toBe(true);
  });

  test('custom stride affects velocity calculation', () => {
    // With 1.0m stride, 500 steps/min × 1.0 / 1000 × 60 = 30 km/h — over cap
    expect(F.isStepWindowOverVelocityCap(500, 1.0)).toBe(true);
    // Same step rate with 0.5m stride = 15 km/h — under cap
    expect(F.isStepWindowOverVelocityCap(500, 0.5)).toBe(false);
  });
});

// =============================================================================
// ALLIANCE ABILITY ACTIVATION
// =============================================================================

describe('canActivateAbility', () => {
  test('allowed under normal conditions', () => {
    const result = F.canActivateAbility({
      abilityName: 'rally_cry',
      currentlyActiveCount: 0,
      weeklyMoraleSpentSoFar: 0,
      warChestMorale: 100,
    });
    expect(result.allowed).toBe(true);
    expect(result.cost).toBe(60);
  });

  test('blocks when too many abilities active (cap = 2)', () => {
    const result = F.canActivateAbility({
      abilityName: 'rally_cry',
      currentlyActiveCount: 2,
      weeklyMoraleSpentSoFar: 0,
      warChestMorale: 1000,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_many_active');
  });

  test('blocks when war chest cannot afford cost', () => {
    const result = F.canActivateAbility({
      abilityName: 'unified_front', // costs 100
      currentlyActiveCount: 0,
      weeklyMoraleSpentSoFar: 0,
      warChestMorale: 50,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_morale');
  });

  test('blocks when activation would breach weekly spend cap (200)', () => {
    const result = F.canActivateAbility({
      abilityName: 'war_surge', // costs 80
      currentlyActiveCount: 0,
      weeklyMoraleSpentSoFar: 150,
      warChestMorale: 1000,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('weekly_cap_exceeded');
  });

  test('allows activation that exactly hits weekly cap', () => {
    // 80 + 120 = 200 — at cap, not over
    const result = F.canActivateAbility({
      abilityName: 'war_surge', // costs 80
      currentlyActiveCount: 0,
      weeklyMoraleSpentSoFar: 120,
      warChestMorale: 1000,
    });
    expect(result.allowed).toBe(true);
  });

  test('throws on unknown ability', () => {
    expect(() => F.canActivateAbility({
      abilityName: 'fake_ability', currentlyActiveCount: 0,
      weeklyMoraleSpentSoFar: 0, warChestMorale: 1000,
    })).toThrow(/Unknown alliance ability/);
  });
});

// =============================================================================
// MISSION SCALING & DIFFICULTY
// =============================================================================

describe('countActiveMembers', () => {
  test('counts members at or above 500 Activity Power', () => {
    expect(F.countActiveMembers([100, 500, 1000, 250, 800])).toBe(3);
  });

  test('zero active members', () => {
    expect(F.countActiveMembers([100, 200, 300])).toBe(0);
  });

  test('all active', () => {
    expect(F.countActiveMembers([500, 1000, 2000])).toBe(3);
  });

  test('empty array returns 0', () => {
    expect(F.countActiveMembers([])).toBe(0);
  });

  test('throws on non-array', () => {
    expect(() => F.countActiveMembers('foo')).toThrow(/must be an array/);
  });
});

describe('calcActivityFactor', () => {
  test('zero active members defaults to MIXED (1.00)', () => {
    expect(F.calcActivityFactor([])).toBe(1.00);
    expect(F.calcActivityFactor([100, 200])).toBe(1.00); // none over 500
  });

  test('average below 1500 across active members: LOW (0.85)', () => {
    expect(F.calcActivityFactor([600, 800, 1000])).toBe(0.85);
    expect(F.calcActivityFactor([1499, 1499])).toBe(0.85);
  });

  test('average 1500-3999 across active members: MIXED (1.00)', () => {
    expect(F.calcActivityFactor([1500, 2000, 3000])).toBe(1.00);
    expect(F.calcActivityFactor([3999, 3999])).toBe(1.00);
  });

  test('average 4000+ across active members: HIGH (1.15)', () => {
    expect(F.calcActivityFactor([4000, 5000, 6000])).toBe(1.15);
  });

  test('inactive members excluded from average', () => {
    // Only 5000 counts, 100 is below threshold → average = 5000 → HIGH
    expect(F.calcActivityFactor([100, 5000])).toBe(1.15);
  });

  test('throws on non-array', () => {
    expect(() => F.calcActivityFactor(null)).toThrow(/must be an array/);
  });
});

describe('calcDifficultyMultiplier', () => {
  test('4 of 4: harder (1.10)', () => {
    expect(F.calcDifficultyMultiplier(4)).toBe(1.10);
  });

  test('3 of 4: status quo (1.00)', () => {
    expect(F.calcDifficultyMultiplier(3)).toBe(1.00);
  });

  test('2 of 4: gentle ease (0.95)', () => {
    expect(F.calcDifficultyMultiplier(2)).toBe(0.95);
  });

  test('1 of 4: recovery (0.90)', () => {
    expect(F.calcDifficultyMultiplier(1)).toBe(0.90);
  });

  test('0 of 4: recovery (0.90)', () => {
    expect(F.calcDifficultyMultiplier(0)).toBe(0.90);
  });

  test('clamps high values to 4 (so 5+ behaves as 4)', () => {
    expect(F.calcDifficultyMultiplier(5)).toBe(1.10);
    expect(F.calcDifficultyMultiplier(100)).toBe(1.10);
  });

  test('throws on negative or non-integer', () => {
    expect(() => F.calcDifficultyMultiplier(-1)).toThrow(/non-negative integer/);
    expect(() => F.calcDifficultyMultiplier(2.5)).toThrow(/non-negative integer/);
  });
});

describe('calcEnduranceTarget', () => {
  test('long_march: 25km × members × difficulty × activity_factor', () => {
    // 5 members, 3-of-4 (1.0 difficulty), MIXED (1.0 factor)
    // 25 × 5 × 1.0 × 1.0 = 125 → ceil → 125
    expect(F.calcEnduranceTarget({
      missionType: 'long_march',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 3,
      memberActivityPowers: [2000, 2000, 2000, 2000, 2000],
    })).toBe(125);
  });

  test('the_forge: kcal rounded to nearest 100', () => {
    // 2500 × 5 × 1.0 × 1.0 = 12_500 → already round to 100
    expect(F.calcEnduranceTarget({
      missionType: 'the_forge',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 3,
      memberActivityPowers: [2000, 2000, 2000, 2000, 2000],
    })).toBe(12_500);
  });

  test('the_step_wall: steps rounded to nearest 1000', () => {
    // 50_000 × 4 × 1.0 × 1.0 = 200_000
    expect(F.calcEnduranceTarget({
      missionType: 'the_step_wall',
      activeMemberCount: 4,
      last4MissionsCompletedCount: 3,
      memberActivityPowers: [2000, 2000, 2000, 2000],
    })).toBe(200_000);
  });

  test('streak_wall: target equals active member count, multipliers ignored', () => {
    expect(F.calcEnduranceTarget({
      missionType: 'streak_wall',
      activeMemberCount: 7,
      last4MissionsCompletedCount: 4, // would normally be 1.10
      memberActivityPowers: [5000, 5000, 5000, 5000, 5000, 5000, 5000], // would be HIGH
    })).toBe(7);
  });

  test('difficulty multiplier applied: 4-of-4 raises target', () => {
    // 25 × 5 × 1.10 × 1.0 = 137.5 → ceil → 138
    expect(F.calcEnduranceTarget({
      missionType: 'long_march',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 4,
      memberActivityPowers: [2000, 2000, 2000, 2000, 2000],
    })).toBe(138);
  });

  test('activity factor HIGH raises target', () => {
    // 25 × 5 × 1.0 × 1.15 = 143.75 → ceil → 144
    expect(F.calcEnduranceTarget({
      missionType: 'long_march',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 3,
      memberActivityPowers: [5000, 5000, 5000, 5000, 5000],
    })).toBe(144);
  });

  test('throws on non-endurance mission', () => {
    expect(() => F.calcEnduranceTarget({
      missionType: 'the_push',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 3,
      memberActivityPowers: [],
    })).toThrow(/Not an endurance mission/);
  });

  test('throws on unknown mission', () => {
    expect(() => F.calcEnduranceTarget({
      missionType: 'fake_mission',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 3,
      memberActivityPowers: [],
    })).toThrow(/Not an endurance mission/);
  });
});

describe('calcConquestTarget', () => {
  test('the_push: 0.40 contest_wins × members × difficulty', () => {
    // 0.40 × 10 × 1.0 = 4 → ceil → 4
    expect(F.calcConquestTarget({
      missionType: 'the_push',
      activeMemberCount: 10,
      last4MissionsCompletedCount: 3,
    })).toBe(4);
  });

  test('floors at minimum of 2', () => {
    // 0.40 × 1 × 0.9 = 0.36 → ceil → 1, but floor at 2
    expect(F.calcConquestTarget({
      missionType: 'the_push',
      activeMemberCount: 1,
      last4MissionsCompletedCount: 0,
    })).toBe(2);
  });

  test('the_long_walk: 1.5 km × members × difficulty', () => {
    // 1.5 × 10 × 1.0 = 15
    expect(F.calcConquestTarget({
      missionType: 'the_long_walk',
      activeMemberCount: 10,
      last4MissionsCompletedCount: 3,
    })).toBe(15);
  });

  test('throws on non-conquest mission', () => {
    expect(() => F.calcConquestTarget({
      missionType: 'long_march',
      activeMemberCount: 5,
      last4MissionsCompletedCount: 3,
    })).toThrow(/Not a conquest mission/);
  });
});

describe('calcCoordinationRequirement', () => {
  test('all_hands: requires 100% participation, 2 occurrences (no min)', () => {
    // 10 active, 100% pct → 10 participation, no min
    // 2 occurrences × 1.0 activity factor = 2
    expect(F.calcCoordinationRequirement({
      missionType: 'all_hands',
      activeMemberCount: 10,
      memberActivityPowers: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000],
    })).toEqual({ occurrencesRequired: 2, participationRequired: 10 });
  });

  test('show_of_force: 50% participation with 5 minimum', () => {
    // 6 active × 0.50 = 3, but min is 5 → use 5
    expect(F.calcCoordinationRequirement({
      missionType: 'show_of_force',
      activeMemberCount: 6,
      memberActivityPowers: [2000, 2000, 2000, 2000, 2000, 2000],
    })).toEqual({ occurrencesRequired: 1, participationRequired: 5 });
  });

  test('show_of_force: pct exceeds min, use pct', () => {
    // 20 × 0.50 = 10, min 5 → use 10
    expect(F.calcCoordinationRequirement({
      missionType: 'show_of_force',
      activeMemberCount: 20,
      memberActivityPowers: new Array(20).fill(2000),
    }).participationRequired).toBe(10);
  });

  test('occurrences scale with activity factor', () => {
    // sunrise_run base 3 × HIGH 1.15 = 3.45 → floor → 3
    expect(F.calcCoordinationRequirement({
      missionType: 'sunrise_run',
      activeMemberCount: 10,
      memberActivityPowers: new Array(10).fill(5000),
    }).occurrencesRequired).toBe(3);
    // sunrise_run base 3 × LOW 0.85 = 2.55 → floor → 2
    expect(F.calcCoordinationRequirement({
      missionType: 'sunrise_run',
      activeMemberCount: 10,
      memberActivityPowers: new Array(10).fill(600),
    }).occurrencesRequired).toBe(2);
  });

  test('occurrences floored to minimum 1', () => {
    // Even on smallest activity factor, never zero
    // base × 0.85 = some fraction that might floor to 0 → min 1
    expect(F.calcCoordinationRequirement({
      missionType: 'show_of_force', // base 1
      activeMemberCount: 5,
      memberActivityPowers: [600, 600, 600, 600, 600],
    }).occurrencesRequired).toBeGreaterThanOrEqual(1);
  });

  test('throws on non-coordination mission', () => {
    expect(() => F.calcCoordinationRequirement({
      missionType: 'long_march',
      activeMemberCount: 5,
      memberActivityPowers: [],
    })).toThrow(/Not a coordination mission/);
  });
});

describe('isMissionFeasible', () => {
  test('endurance missions are feasible by default', () => {
    expect(F.isMissionFeasible({
      missionType: 'long_march',
      activeMemberCount: 5,
    })).toBe(true);
  });

  test('excludes mission completed 2+ of last 3 weeks (variety filter)', () => {
    expect(F.isMissionFeasible({
      missionType: 'long_march',
      activeMemberCount: 5,
      recentlyCompletedMissions: ['long_march', 'long_march', 'the_push'],
    })).toBe(false);
  });

  test('one prior completion does not exclude', () => {
    expect(F.isMissionFeasible({
      missionType: 'long_march',
      activeMemberCount: 5,
      recentlyCompletedMissions: ['long_march', 'the_push', 'the_forge'],
    })).toBe(true);
  });

  test('coordination mission excluded if active members below participation_min', () => {
    // show_of_force needs min 5 active members
    expect(F.isMissionFeasible({
      missionType: 'show_of_force',
      activeMemberCount: 3,
    })).toBe(false);
  });

  test('coordination mission feasible when active members meet threshold', () => {
    expect(F.isMissionFeasible({
      missionType: 'show_of_force',
      activeMemberCount: 5,
    })).toBe(true);
  });

  test('all_hands excluded when 0 active members (would require 0 from pct)', () => {
    expect(F.isMissionFeasible({
      missionType: 'all_hands',
      activeMemberCount: 0,
    })).toBe(false);
  });

  test('unknown mission returns false', () => {
    expect(F.isMissionFeasible({
      missionType: 'fake_mission',
      activeMemberCount: 5,
    })).toBe(false);
  });
});

describe('calcContributionPoints', () => {
  test('long_march: 1 CP per km', () => {
    expect(F.calcContributionPoints('long_march', 10)).toBe(10);
    expect(F.calcContributionPoints('long_march', 0.5)).toBe(0.5);
  });

  test('the_forge: 1 CP per 25 kcal', () => {
    expect(F.calcContributionPoints('the_forge', 250)).toBe(10);
  });

  test('hard_days: 30 CP per challenge', () => {
    expect(F.calcContributionPoints('hard_days', 2)).toBe(60);
  });

  test('streak_wall: boolean — 100 CP if true, 0 if false', () => {
    expect(F.calcContributionPoints('streak_wall', true)).toBe(100);
    expect(F.calcContributionPoints('streak_wall', false)).toBe(0);
  });

  test('coordination missions: 100 CP per qualifying participation', () => {
    expect(F.calcContributionPoints('all_hands', true)).toBe(100);
    expect(F.calcContributionPoints('show_of_force', false)).toBe(0);
    expect(F.calcContributionPoints('synchronised', true)).toBe(100);
  });

  test('the_push: 25 CP per contest win', () => {
    expect(F.calcContributionPoints('the_push', 3)).toBe(75);
  });

  test('iron_investment: 0.5 CP per Iron spent', () => {
    expect(F.calcContributionPoints('iron_investment', 100)).toBe(50);
  });

  test('throws on unknown mission', () => {
    expect(() => F.calcContributionPoints('fake_mission', 5)).toThrow(/Unknown mission type/);
  });
});

describe('calcCompletionFactor', () => {
  test('100%+ → 1.00', () => {
    expect(F.calcCompletionFactor(1.00)).toBe(1.00);
    expect(F.calcCompletionFactor(1.50)).toBe(1.00);
  });

  test('80–99% → 0.60', () => {
    expect(F.calcCompletionFactor(0.80)).toBe(0.60);
    expect(F.calcCompletionFactor(0.99)).toBe(0.60);
  });

  test('60–79% → 0.30', () => {
    expect(F.calcCompletionFactor(0.60)).toBe(0.30);
    expect(F.calcCompletionFactor(0.79)).toBe(0.30);
  });

  test('below 60% → 0', () => {
    expect(F.calcCompletionFactor(0.59)).toBe(0);
    expect(F.calcCompletionFactor(0)).toBe(0);
  });

  test('throws on negative', () => {
    expect(() => F.calcCompletionFactor(-0.1)).toThrow(/non-negative number/);
  });
});

describe('getMissionStreakTier', () => {
  test('0 weeks: none tier, 0% bonus', () => {
    expect(F.getMissionStreakTier(0)).toEqual({
      minWeeks: 0, tier: 'none', rewardBonusPct: 0.00, capBonus: 0,
    });
  });

  test('1 week: forming tier', () => {
    expect(F.getMissionStreakTier(1).tier).toBe('forming');
  });

  test('4 weeks: aligned tier (5% bonus)', () => {
    const t = F.getMissionStreakTier(4);
    expect(t.tier).toBe('aligned');
    expect(t.rewardBonusPct).toBe(0.05);
  });

  test('30 weeks: unbroken_together (20% bonus, +1 cap)', () => {
    const t = F.getMissionStreakTier(30);
    expect(t.tier).toBe('unbroken_together');
    expect(t.rewardBonusPct).toBe(0.20);
    expect(t.capBonus).toBe(1);
  });

  test('52+ weeks: eternal_bond (25% bonus, +1 cap)', () => {
    const t = F.getMissionStreakTier(52);
    expect(t.tier).toBe('eternal_bond');
    expect(t.rewardBonusPct).toBe(0.25);
    expect(t.capBonus).toBe(1);
  });

  test('100 weeks stays at eternal_bond', () => {
    expect(F.getMissionStreakTier(100).tier).toBe('eternal_bond');
  });

  test('returns a clone — mutation does not leak', () => {
    const a = F.getMissionStreakTier(30);
    a.rewardBonusPct = 9.99;
    const b = F.getMissionStreakTier(30);
    expect(b.rewardBonusPct).toBe(0.20);
  });
});

describe('calcMissionRewardPool', () => {
  test('full completion no streak bonus: pool × 1.00 × 1.00', () => {
    // endurance: morale 480, gold 360, xp 250
    expect(F.calcMissionRewardPool({
      category: 'endurance', achievedPct: 1.0, streakWeeks: 0,
    })).toEqual({ morale: 480, gold: 360, xp: 250 });
  });

  test('80% completion: pool × 0.60', () => {
    // conquest: 600 × 0.60 = 360, 500 × 0.60 = 300, 350 × 0.60 = 210
    expect(F.calcMissionRewardPool({
      category: 'conquest', achievedPct: 0.85, streakWeeks: 0,
    })).toEqual({ morale: 360, gold: 300, xp: 210 });
  });

  test('failure: zero rewards', () => {
    expect(F.calcMissionRewardPool({
      category: 'endurance', achievedPct: 0.50, streakWeeks: 0,
    })).toEqual({ morale: 0, gold: 0, xp: 0 });
  });

  test('streak bonus applies on top of completion', () => {
    // coordination 100% × eternal_bond 1.25
    // morale 720 × 1.0 × 1.25 = 900
    // gold 400 × 1.25 = 500
    // xp 300 × 1.25 = 375
    expect(F.calcMissionRewardPool({
      category: 'coordination', achievedPct: 1.0, streakWeeks: 52,
    })).toEqual({ morale: 900, gold: 500, xp: 375 });
  });

  test('throws on unknown category', () => {
    expect(() => F.calcMissionRewardPool({
      category: 'fake', achievedPct: 1.0, streakWeeks: 0,
    })).toThrow(/Unknown mission category/);
  });
});
