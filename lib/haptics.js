// lib/haptics.js
// The three brand-sanctioned haptic moments (Brand Guidelines v1.1, Motion &
// interaction). Never fired for taps, swipes, or ordinary UI.
//
//   claimHaptic()     — territory claim success: single firm pulse
//   contestHaptic()   — contest completion (win or loss): double pulse
//   milestoneHaptic() — milestone unlock (level-up, first contest win): extended
//
// expo-haptics is a native module; a dev client built before it was added
// throws on import. Guarded require lets the app degrade to core Vibration
// (and Vibration itself no-ops where unsupported) until the next rebuild.

import { Vibration } from 'react-native';

let Haptics = null;
try {
  // eslint-disable-next-line global-require
  Haptics = require('expo-haptics');
} catch (e) {
  Haptics = null;
}

function safe(fn) {
  try {
    const p = fn();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    // Haptics must never break a reward moment.
  }
}

export function claimHaptic() {
  if (Haptics) {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  } else {
    safe(() => Vibration.vibrate(60));
  }
}

export function contestHaptic() {
  if (Haptics) {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    setTimeout(
      () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      120,
    );
  } else {
    safe(() => Vibration.vibrate([0, 45, 120, 45]));
  }
}

export function milestoneHaptic() {
  if (Haptics) {
    // No long-vibration API on iOS — composite: success notification followed
    // by a heavy impact reads as one extended event.
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    setTimeout(
      () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      180,
    );
  } else {
    safe(() => Vibration.vibrate([0, 60, 80, 60, 80, 200]));
  }
}
