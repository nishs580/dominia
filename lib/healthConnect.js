// lib/healthConnect.js
// Single source of truth for Health Connect permission descriptors and
// grant filtering. Used by lib/activity.js, screens/ActivityScreen.js,
// and screens/HealthConnectDebugScreen.js.

export const STEPS_READ_PERM = { accessType: 'read', recordType: 'Steps' };

function isBackgroundPermission(p) {
  return p?.background === true || p?.backgroundRead === true || p?.isBackground === true;
}

/**
 * Returns true iff `granted` contains a FOREGROUND Steps read permission.
 * D10 (S51) producer + ActivityScreen polling gate on this.
 */
export function hasForegroundStepsRead(granted) {
  return (granted ?? []).some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read' && !isBackgroundPermission(p),
  );
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
