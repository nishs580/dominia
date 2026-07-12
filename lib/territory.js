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

// The backend is the source of truth for Legacy Rank: it recomputes
// territories.legacy_rank on every ownership change / develop level-up and
// in the daily influence tick (never decreases). The old client-side
// recompute from territory_history lives on in formulas.calcLegacyRank as
// the canonical mirror of the server SQL — do not resurrect it here.
export async function getLegacyRankForTerritory(territoryId) {
  const { data, error } = await supabase
    .from('territories')
    .select('legacy_rank')
    .eq('id', territoryId)
    .maybeSingle();

  if (error) {
    console.warn('[territory] legacy rank fetch failed:', error);
    return 1;
  }
  return data?.legacy_rank ?? 1;
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
