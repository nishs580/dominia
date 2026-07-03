// lib/challengeAxes.js
// The 4-axis daily challenge menu (memory: daily-challenge-redesign).
// Mirrors backend shared/formulas/challenge-days.ts + challenge.formulas.ts —
// display metadata only; the backend is authoritative for gating and payouts.

export const AXES = ['steps', 'distance', 'calories', 'tempo'];

export const XP_PER_TIER = Object.freeze({ easy: 50, medium: 150, hard: 400 });

export const THEME_BOOST_MULT = 1.5;

/**
 * Per-axis catalog: i18n name key, tier targets, which live aggregate gates
 * it, and the earn-key family. `targets` are the backend thresholds
 * (steps / metres / active kcal / tempo tier).
 */
export const AXIS_CATALOG = Object.freeze({
  steps: {
    nameKey: 'activity.axisSteps',
    aggregate: 'daily_steps',
    primaryResource: 'stone',
    tiers: {
      easy: { target: 5000, earnKey: 'easy_step_challenge', taskKey: 'activity.taskSteps' },
      medium: { target: 10000, earnKey: 'medium_step_challenge', taskKey: 'activity.taskSteps' },
      hard: { target: 15000, earnKey: 'hard_step_challenge', taskKey: 'activity.taskSteps' },
    },
  },
  distance: {
    nameKey: 'activity.axisDistance',
    aggregate: 'daily_distance_m',
    primaryResource: 'stone',
    tiers: {
      easy: { target: 2500, earnKey: 'easy_distance_challenge', taskKey: 'activity.taskDistance' },
      medium: { target: 4000, earnKey: 'medium_distance_challenge', taskKey: 'activity.taskDistance' },
      hard: { target: 8000, earnKey: 'hard_distance_challenge', taskKey: 'activity.taskDistance' },
    },
  },
  calories: {
    nameKey: 'activity.axisCalories',
    aggregate: 'daily_calories',
    primaryResource: 'iron',
    tiers: {
      easy: { target: 200, earnKey: 'easy_calorie_challenge', taskKey: 'activity.taskCalories' },
      medium: { target: 400, earnKey: 'medium_calorie_challenge', taskKey: 'activity.taskCalories' },
      hard: { target: 700, earnKey: 'hard_calorie_challenge', taskKey: 'activity.taskCalories' },
    },
  },
  tempo: {
    nameKey: 'activity.axisTempo',
    aggregate: 'daily_tempo_tier',
    primaryResource: 'iron',
    tiers: {
      easy: { target: 1, earnKey: 'easy_tempo_challenge', taskKey: 'activity.taskTempoEasy' },
      medium: { target: 2, earnKey: 'medium_tempo_challenge', taskKey: 'activity.taskTempoMedium' },
      hard: { target: 3, earnKey: 'hard_tempo_challenge', taskKey: 'activity.taskTempoHard' },
    },
  },
});

export const TIERS = ['easy', 'medium', 'hard'];

/**
 * Client-side theme fallback (matches backend themeForYmd) so the header can
 * render before /me/challenges/today responds. Server payload wins once
 * loaded. `date` is a JS Date in device-local time.
 */
export function themeAxisForDate(date) {
  switch (date.getDay()) {
    case 1: return 'steps'; // Mon — March
    case 2: return 'distance'; // Tue — Range
    case 3: return 'calories'; // Wed — Drill
    case 4: return 'tempo'; // Thu — Tempo
    case 5: return 'war_prep'; // Fri — both Iron axes
    default: return null; // Sat/Sun — Attack Days
  }
}

/** Boosted axes for a theme key ('war_prep' covers both Iron axes). */
export function boostedAxesForTheme(themeKey) {
  if (themeKey === 'war_prep') return ['calories', 'tempo'];
  if (AXES.includes(themeKey)) return [themeKey];
  return [];
}

/**
 * The default axis armed for auto-complete before the player makes a
 * conscious choice: the day's theme axis; Friday (war_prep) arms calories
 * (the more broadly attainable Iron axis). Weekends: none.
 *
 * Falls back to steps when the theme axis's data source is unavailable
 * (kcal permission not granted) — the armed default exists to keep a
 * do-nothing player's streak alive, so it must be an axis that can
 * actually accumulate. Distance always works (stride fallback); tempo can
 * complete from stitched walk sessions, so both stay armable.
 */
export function defaultAxisForTheme(themeKey, { hasKcalPerm = false } = {}) {
  let axis = null;
  if (themeKey === 'war_prep') axis = 'calories';
  else if (AXES.includes(themeKey)) axis = themeKey;
  if (axis === null) return null;
  if (axis === 'calories' && !hasKcalPerm) return 'steps';
  return axis;
}

/** Progress display for an axis row: current vs target in axis units. */
export function formatAxisProgress(axis, aggregates, liveSteps, target) {
  if (axis === 'steps') {
    const v = Math.max(Number(aggregates?.daily_steps) || 0, Number(liveSteps) || 0);
    return { current: Math.min(v, target), target, kind: 'count' };
  }
  if (axis === 'distance') {
    const v = Number(aggregates?.daily_distance_m) || 0;
    return { current: Math.min(v, target), target, kind: 'meters' };
  }
  if (axis === 'calories') {
    const v = Number(aggregates?.daily_calories) || 0;
    return { current: Math.min(v, target), target, kind: 'count' };
  }
  const v = Number(aggregates?.daily_tempo_tier) || 0;
  return { current: Math.min(v, target), target, kind: 'tier' };
}
