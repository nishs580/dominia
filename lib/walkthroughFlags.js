import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Fires-once flags for the first-run walkthrough system (per player, per
 * screen) and the just-in-time resource explanations (per player, per
 * resource). Backed by AsyncStorage — a reinstall re-runs walkthroughs, which
 * is acceptable: the first-claim objective itself is server-driven (held
 * count), so a reinstalled landed player never sees the objective again even
 * though screen tours may re-fire.
 *
 * Also exposes a tiny subscribe/notify bridge so app-level lifecycles (FCM
 * registration) can react to a walkthrough completing without a re-render
 * dependency on screen state.
 */

const keyFor = (userId, name) => `dominia:walkthrough:${userId ?? 'anon'}:${name}`;

const memoryCache = new Map();
const listeners = new Set();

export async function hasFired(userId, name) {
  const key = keyFor(userId, name);
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const value = await AsyncStorage.getItem(key);
    const fired = value === '1';
    memoryCache.set(key, fired);
    return fired;
  } catch {
    // Storage failure: err on the side of not re-running a tour the player
    // may already have seen this session.
    return memoryCache.get(key) ?? false;
  }
}

export async function markFired(userId, name) {
  const key = keyFor(userId, name);
  memoryCache.set(key, true);
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Memory cache still holds it for this session.
  }
  listeners.forEach((fn) => {
    try {
      fn({ userId, name });
    } catch {
      // Listener errors must never break the marking path.
    }
  });
}

/** Subscribe to markFired events. Returns an unsubscribe function. */
export function onWalkthroughFired(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
