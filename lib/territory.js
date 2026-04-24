// lib/territory.js
// Helper functions for territory calculations
// Based on Dominia Mechanics v6.8

// Streak tier name + defence/attack multiplier based on consecutive days
// From §4.1 and §4.2
export function streakTier(days) {
  if (!days || days < 3) return { name: 'Newcomer', multiplier: 1.0 };
  if (days < 7) return { name: 'Committed', multiplier: 1.1 };
  if (days < 14) return { name: 'Proven', multiplier: 1.15 };
  if (days < 21) return { name: 'Reliable', multiplier: 1.2 };
  if (days < 30) return { name: 'Iron Guard', multiplier: 1.3 };
  if (days < 60) return { name: 'Unbroken', multiplier: 1.4 };
  return { name: 'Legendary', multiplier: 1.5 };
}

// Development level name
// From §5.8.1
export function developmentName(level) {
  const names = ['Raw', 'Established', 'Fortified', 'Stronghold', 'Citadel'];
  return names[level] ?? 'Raw';
}

// Development Influence multiplier by tier and level
// From §5.8.1
export function developmentMultiplier(tier, level) {
  const tierKey = (tier ?? 'Medium').toLowerCase();
  const table = {
    small: [1.0, 1.3, 1.6, 2.0, 2.5],
    medium: [1.0, 1.3, 1.6, 2.0, 2.5],
    large: [1.0, 1.3, 1.5, 1.75, 2.0],
    epic: [1.0, 1.25, 1.4, 1.6, 1.75],
  };
  const row = table[tierKey] ?? table.medium;
  return row[level] ?? 1.0;
}

// Legacy rank name
// From §9.2
export function legacyRankName(rank) {
  const names = ['', 'Unproven', 'Established', 'Contested', 'Contested Ground', 'Legendary'];
  return names[rank] ?? 'Unproven';
}

// Legacy rank Influence multiplier
// From §5.8.2
export function legacyRankMultiplier(rank) {
  const table = [1.0, 1.0, 1.25, 1.5, 2.0, 3.0];
  return table[rank] ?? 1.0;
}

// Base Influence rate per day by tier
// From §5.8.2
export function baseInfluencePerDay(tier) {
  const key = (tier ?? 'Medium').toLowerCase();
  const rates = { small: 2, medium: 5, large: 12, epic: 25 };
  return rates[key] ?? 5;
}

// Daily Influence generation
// From §5.8.2
// legacyRank defaults to 1 (Unproven), upkeepActive defaults to true
export function influencePerDay({ tier, developmentLevel = 0, legacyRank = 1, upkeepActive = true }) {
  const base = baseInfluencePerDay(tier);
  const legacy = legacyRankMultiplier(legacyRank);
  const dev = developmentMultiplier(tier, developmentLevel);
  const upkeep = upkeepActive ? 1.0 : 0.5;
  return Math.round(base * legacy * dev * upkeep);
}

// Streak multiplier cap per tier
// From §4.2.2
export function streakCapForTier(tier) {
  const key = (tier ?? 'Medium').toLowerCase();
  if (key === 'large') return 1.25;
  if (key === 'epic') return 1.15;
  return 1.5; // small, medium
}

// Apply tier cap to a raw streak multiplier
export function cappedStreakMultiplier(multiplier, tier) {
  return Math.min(multiplier, streakCapForTier(tier));
}

// Required contest walk distance
// From §4.2.1 — simplified (no alliance abilities, no siege boost, no sovereign)
// Returns distance in metres, rounded to nearest 10m, capped at 2× perimeter
export function contestWalkDistance({
  perimeter,
  attackerStreakDays = 0,
  defenderStreakDays = 0,
  tier,
  developmentLevel = 0,
}) {
  const atkMult = cappedStreakMultiplier(streakTier(attackerStreakDays).multiplier, tier);
  const defMult = cappedStreakMultiplier(streakTier(defenderStreakDays).multiplier, tier);
  const devMult = developmentMultiplier(tier, developmentLevel);
  const raw = perimeter * (defMult / atkMult) * devMult;
  const capped = Math.min(raw, perimeter * 2.0);
  return Math.round(capped / 10) * 10;
}

// Streak reduction percentage vs a fresh defender
// Useful for "Your X-day streak reduces this by Y%" copy
export function streakReductionPercent(attackerStreakDays) {
  const mult = streakTier(attackerStreakDays).multiplier;
  if (mult <= 1.0) return 0;
  return Math.round((1 - 1 / mult) * 100);
}
