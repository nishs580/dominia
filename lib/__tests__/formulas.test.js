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
