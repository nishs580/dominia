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

export function formatHeldDays(heldDays) {
  if (heldDays === null || heldDays === undefined) return null;
  if (heldDays === 0) return 'Today';
  if (heldDays === 1) return '1 day';
  return `${heldDays} days`;
}

export function formatChangedHands(changedHands) {
  if (!changedHands || changedHands === 0) return 'Never';
  if (changedHands === 1) return '1 time';
  return `${changedHands} times`;
}

export function formatHolderCount(holderCount) {
  if (!holderCount || holderCount === 0) return null;
  if (holderCount === 1) return '1 holder';
  return `${holderCount} holders`;
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

// Returns { heldDays, changedHands, currentClaimedAt, holderCount }
// - heldDays: null if territory is unclaimed (no open row), else floor((now - claimed_at) / 1 day)
// - changedHands: count of rows where lost_at IS NOT NULL AND backfilled = false
// - currentClaimedAt: ISO string of the open row's claimed_at, or null
// - holderCount: distinct owner_id count across rows where backfilled = false
export async function getTerritoryHistoryStats(territoryId) {
  const { data: rows, error } = await supabase
    .from('territory_history')
    .select('owner_id, claimed_at, lost_at, backfilled')
    .eq('territory_id', territoryId);

  if (error) {
    console.warn('[territory] getTerritoryHistoryStats error:', error);
    return { heldDays: null, changedHands: 0, currentClaimedAt: null, holderCount: 0 };
  }

  const safeRows = rows || [];
  const currentRow = safeRows.find(r => r.lost_at === null);
  const heldDays = currentRow
    ? Math.floor((Date.now() - new Date(currentRow.claimed_at).getTime()) / 86400000)
    : null;
  const changedHands = safeRows.filter(r => r.lost_at !== null && r.backfilled === false).length;
  const currentClaimedAt = currentRow ? currentRow.claimed_at : null;
  const holderCount = new Set(
    safeRows.filter(r => r.backfilled === false).map(r => r.owner_id)
  ).size;

  return { heldDays, changedHands, currentClaimedAt, holderCount };
}
