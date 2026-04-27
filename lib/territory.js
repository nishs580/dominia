// lib/territory.js
// Helper functions for territory calculations (display names, streak reduction copy).
// Numeric mechanics live in ./formulas.js

import {
  getStreakTier,
  calcStreakMultiplier,
  calcDailyInfluence,
  calcRequiredContestWalk,
  TERRITORY_BASE_INFLUENCE,
  DEV_INFLUENCE_MULT,
  LEGACY_RANK_INFLUENCE_MULT,
  STREAK_MULT_TIER_CAP,
} from './formulas';

// Development level name
// From §5.8.1
export function developmentName(level) {
  const names = ['Raw', 'Established', 'Fortified', 'Stronghold', 'Citadel'];
  return names[level] ?? 'Raw';
}

// Legacy rank name
// From §9.2
export function legacyRankName(rank) {
  const names = ['', 'Unproven', 'Established', 'Contested', 'Contested Ground', 'Legendary'];
  return names[rank] ?? 'Unproven';
}

export function streakTierName(tier) {
  const names = {
    newcomer: 'Newcomer',
    committed: 'Committed',
    proven: 'Proven',
    reliable: 'Reliable',
    iron_guard: 'Iron Guard',
    unbroken: 'Unbroken',
    legendary: 'Legendary',
  };
  return names[tier] ?? 'Newcomer';
}

// Streak reduction percentage vs a fresh defender
// Useful for "Your X-day streak reduces this by Y%" copy
export function streakReductionPercent(attackerStreakDays) {
  const mult = getStreakTier(attackerStreakDays).multiplier;
  if (mult <= 1.0) return 0;
  return Math.round((1 - 1 / mult) * 100);
}
