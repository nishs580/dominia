// Legacy Medal UI catalog + derivation helpers (presentation only — the
// authoritative earning logic and values come from the backend GET /legacy/medals).
// Design system per the Legacy Medals concept: Bone-on-Ink, category silhouettes
// (triangle / square / hexagon / diamond), accumulating tier ribbon.

export const CATEGORY_ORDER = ['combat', 'defense', 'distance', 'endurance'];

export const CATEGORY_LABEL = {
  combat: 'COMBAT',
  defense: 'DEFENSE',
  distance: 'DISTANCE',
  endurance: 'ENDURANCE',
};

// Silhouette shape per category (drawn in MedalIcon).
export const CATEGORY_SHAPE = {
  combat: 'triangle',
  defense: 'square',
  distance: 'hexagon',
  endurance: 'diamond',
};

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'claim'];

// Tier ribbon colours (bar count is the primary channel, colour supporting).
export const TIER_COLOR = {
  bronze: '#8C5A2E',
  silver: '#9B9B9B',
  gold: '#C5A14A',
  claim: '#D64525',
};

export const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  claim: 'Claim',
};

export const MEDAL_NAME = {
  'combat.first_blood': 'FIRST BLOOD',
  'combat.conqueror': 'CONQUEROR',
  'combat.trophy_hunter': 'TROPHY HUNTER',
  'combat.reclaimer': 'RECLAIMER',
  'defense.the_wall': 'THE WALL',
  'defense.bulwark': 'BULWARK',
  'defense.guardian': 'GUARDIAN',
  'defense.immovable': 'IMMOVABLE',
  'distance.pathfinder': 'PATHFINDER',
  'distance.iron_legs': 'IRON LEGS',
  'distance.daily_marcher': 'DAILY MARCHER',
  'distance.war_marcher': 'WAR MARCHER',
  'endurance.unbroken': 'UNBROKEN',
  'endurance.phoenix': 'PHOENIX',
  'endurance.eternal': 'ETERNAL',
  'endurance.time_served': 'TIME SERVED',
};

// One-line earning condition for the detail card.
export const MEDAL_CONDITION = {
  'combat.first_blood': 'First to ever claim a territory. No prior owner in history.',
  'combat.conqueror': 'Total offensive contests won, lifetime.',
  'combat.trophy_hunter': 'Offensive wins on territories of Legacy Rank 3 or higher.',
  'combat.reclaimer': 'Reconquests within 72 hours of a loss.',
  'defense.the_wall': 'Hold one territory through 5 defences in 90 days against 5 attackers.',
  'defense.bulwark': 'Total successful defences, lifetime, any territory.',
  'defense.guardian': 'Defensive wins on territories of Legacy Rank 3 or higher.',
  'defense.immovable': 'Longest unbroken single-territory hold, in days.',
  'distance.pathfinder': 'Total lifetime distance walked, km.',
  'distance.iron_legs': 'Longest single continuous walking session, km.',
  'distance.daily_marcher': 'Days walked 5 km or more. Lifetime count.',
  'distance.war_marcher': 'Cumulative km walked inside contest perimeters.',
  'endurance.unbroken': 'Longest single continuous streak, in days.',
  'endurance.phoenix': 'Rebuilt 30-day streaks after a break.',
  'endurance.eternal': '365-day streak. Once per lifetime. Year stamped.',
  'endurance.time_served': 'Days lived under an active 7-day-or-longer streak.',
};

// Unit suffix appended to tiered values/thresholds in the detail card.
export const MEDAL_UNIT = {
  'defense.immovable': ' days',
  'distance.pathfinder': ' km',
  'distance.iron_legs': ' km',
  'distance.daily_marcher': ' days',
  'distance.war_marcher': ' km',
  'endurance.unbroken': ' days',
  'endurance.time_served': ' days',
};

export function tierRank(tier) {
  return tier ? TIER_ORDER.indexOf(tier) : -1;
}

/** Is this medal earned at all (any tier, a count, or a one-off)? */
export function isMedalEarned(medal) {
  if (medal.type === 'tiered') return medal.currentTier != null;
  if (medal.type === 'singular_count') return (medal.count ?? 0) > 0;
  return medal.earned === true; // singular_oneoff
}

/** Number of earned medals across the set (for the "x/16" header). */
export function earnedCount(medals) {
  return medals.reduce((n, m) => n + (isMedalEarned(m) ? 1 : 0), 0);
}

export function medalsForCategory(medals, category) {
  return medals.filter((m) => m.category === category);
}

/** Highest tier reached by any tiered medal in a category, or null. */
export function categoryHighestTier(medals, category) {
  let best = -1;
  for (const m of medalsForCategory(medals, category)) {
    if (m.type === 'tiered') best = Math.max(best, tierRank(m.currentTier));
  }
  return best >= 0 ? TIER_ORDER[best] : null;
}

/** Earned count within a category (out of 4). */
export function categoryEarnedCount(medals, category) {
  return medalsForCategory(medals, category).filter(isMedalEarned).length;
}

/** The short Bone-bar label for a singular medal (x N, or year). */
export function singularBarLabel(medal) {
  if (medal.type === 'singular_count') return `× ${medal.count ?? 0}`;
  if (medal.type === 'singular_oneoff') {
    return medal.earned ? String(medal.earnedYear ?? '') : 'LOCKED';
  }
  return '';
}
