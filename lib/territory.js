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
import * as F from './formulas';
import { supabase } from './supabase';

export { legacyRankName } from './formulas';

// Development level name
// From §5.8.1
export function developmentName(level) {
  const names = ['Raw', 'Established', 'Fortified', 'Stronghold', 'Citadel'];
  return names[level] ?? 'Raw';
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

export async function getLegacyRankForTerritory(territoryId) {
  const { data: historyRows, error: historyError } = await supabase
    .from('territory_history')
    .select('*')
    .eq('territory_id', territoryId);

  const { data: territoryRow, error: territoryError } = await supabase
    .from('territories')
    .select('development_level')
    .eq('id', territoryId)
    .maybeSingle();

  if (historyError) {
    console.warn('[territory] legacy rank fetch failed:', historyError);
    return 1;
  }
  if (territoryError) {
    console.warn('[territory] legacy rank fetch failed:', territoryError);
    return 1;
  }

  const rows = Array.isArray(historyRows) ? historyRows : [];

  const ownershipChanges = rows.filter(r => r?.lost_at != null).length;

  const holdDaysList = rows.map((row) => {
    const claimed = new Date(row.claimed_at).getTime();
    const ended = row.lost_at ? new Date(row.lost_at).getTime() : Date.now();
    const holdMs = ended - claimed;
    return holdMs / (1000 * 60 * 60 * 24);
  });

  const maxSingleHoldDays =
    holdDaysList.length === 0 ? 0 : Math.floor(Math.max(...holdDaysList));

  const totalCumulativeHoldDays =
    holdDaysList.length === 0 ? 0 : Math.floor(holdDaysList.reduce((a, b) => a + b, 0));

  const allianceSet = new Set();
  for (const row of rows) {
    if (row?.alliance_id != null) allianceSet.add(row.alliance_id);
  }
  const distinctAlliancesHeld = allianceSet.size;

  const developmentLevel =
    territoryRow?.development_level == null ? 0 : Number(territoryRow.development_level) || 0;

  return F.calcLegacyRank({
    ownershipChanges,
    maxSingleHoldDays,
    totalCumulativeHoldDays,
    distinctAlliancesHeld,
    developmentLevel,
  });
}
