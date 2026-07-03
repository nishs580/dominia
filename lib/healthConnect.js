// lib/healthConnect.js
// Single source of truth for Health Connect permission descriptors and
// grant filtering. Used by lib/activity.js, screens/ActivityScreen.js,
// and screens/HealthConnectDebugScreen.js.

export const STEPS_READ_PERM = { accessType: 'read', recordType: 'Steps' };

// 4-axis daily challenges (memory: daily-challenge-redesign):
// - ActiveCaloriesBurned gates the Drill axis. ACTIVE calories, never
//   TotalCaloriesBurned — basal burn (~1,500–2,000 kcal/day) would
//   auto-complete every tier by lunch.
// - Distance gates Range and (via per-minute samples) Tempo. Tempo needs no
//   Speed permission: the backend computes session pace from distance ÷
//   active time of stitched samples.
export const ACTIVE_CALORIES_READ_PERM = {
  accessType: 'read',
  recordType: 'ActiveCaloriesBurned',
};
export const DISTANCE_READ_PERM = { accessType: 'read', recordType: 'Distance' };

/** Everything the Activity screen requests in one Health Connect sheet. */
export const ACTIVITY_READ_PERMS = [
  STEPS_READ_PERM,
  ACTIVE_CALORIES_READ_PERM,
  DISTANCE_READ_PERM,
];

function isBackgroundPermission(p) {
  return p?.background === true || p?.backgroundRead === true || p?.isBackground === true;
}

function hasForegroundRead(granted, recordType) {
  return (granted ?? []).some(
    (p) => p.recordType === recordType && p.accessType === 'read' && !isBackgroundPermission(p),
  );
}

/**
 * Returns true iff `granted` contains a FOREGROUND Steps read permission.
 * D10 (S51) producer + ActivityScreen polling gate on this.
 */
export function hasForegroundStepsRead(granted) {
  return hasForegroundRead(granted, 'Steps');
}

/** Drill axis (active kcal) data available. Optional — steps-only still works. */
export function hasForegroundActiveCaloriesRead(granted) {
  return hasForegroundRead(granted, 'ActiveCaloriesBurned');
}

/**
 * Sensor distance available (Range/Tempo axes use it when granted; stride
 * fallback covers Range otherwise). Optional — steps-only still works.
 */
export function hasForegroundDistanceRead(granted) {
  return hasForegroundRead(granted, 'Distance');
}

/**
 * Returns true iff `granted` contains a BACKGROUND Steps read permission.
 * Currently used only by HealthConnectDebugScreen for status display.
 * S51 producer does NOT use background reads.
 */
export function hasBackgroundStepsRead(granted) {
  return (granted ?? []).some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read' && isBackgroundPermission(p),
  );
}
