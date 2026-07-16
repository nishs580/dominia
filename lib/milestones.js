// lib/milestones.js
// Builders for MilestoneTakeover items so ClaimSuccess and ContestResult
// present identical ceremonies from one definition.

import { getLevelTitle, XP_STREAK_MILESTONE } from './formulas';

// Alliance access unlocks at level 3 — the backend membership gate
// (canFoundAlliance) and the level_up_3 push both moved from L6 to L3.
export const ALLIANCE_UNLOCK_LEVEL = 3;

export function levelUpMilestone(t, level) {
  return {
    kicker: t('milestone.levelKicker', { level }),
    title: t('levelTitle.' + getLevelTitle(level)),
    body: level === ALLIANCE_UNLOCK_LEVEL ? t('milestone.levelBodyAlliances') : undefined,
  };
}

export function firstContestWinMilestone(t) {
  return {
    kicker: t('milestone.firstWinKicker'),
    title: t('milestone.firstWinTitle'),
    body: t('milestone.firstWinBody'),
  };
}

// Fired when a challenge completion crosses a streak milestone day —
// server-decided via the response's streak_milestone field.
export function streakMilestoneItem(t, days, tierKey) {
  return {
    kicker: t('milestone.streakKicker'),
    title: t('milestone.streakTitle', { count: days }),
    body: t('milestone.streakBody', {
      tier: t('streakTierName.' + (tierKey || 'newcomer')),
      xp: XP_STREAK_MILESTONE,
    }),
  };
}
