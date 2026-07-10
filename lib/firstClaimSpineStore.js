import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deserialiseSpineState,
  initialSpineState,
  serialiseSpineState,
} from './firstClaimSpine';
import { hasFired } from './walkthroughFlags';

/**
 * Persistence for the first-claim spine (same AsyncStorage key pattern as the
 * retired guided demo: dominia:walkthrough:{userId}:{name}). Storage failures
 * degrade to the in-memory copy, mirroring lib/walkthroughFlags.js — a player
 * may re-see a beat after a crash, never lose progress mid-session.
 *
 * Accounts that finished the retired 13-beat demo are adopted as
 * spine-complete: they were already onboarded, and "once per account" spans
 * iterations.
 */

const keyFor = (userId) => `dominia:walkthrough:${userId ?? 'anon'}:spine`;

const memoryCache = new Map();

export async function loadSpineState(userId) {
  const key = keyFor(userId);
  if (memoryCache.has(key)) return memoryCache.get(key);

  let state = null;
  try {
    state = deserialiseSpineState(await AsyncStorage.getItem(key));
  } catch {
    state = null;
  }

  if (!state) {
    state = initialSpineState();
    if (await hasFired(userId, 'demo')) {
      state = { ...state, complete: true, completedVia: 'legacy_demo' };
    }
  }

  memoryCache.set(key, state);
  return state;
}

export async function saveSpineState(userId, state) {
  const key = keyFor(userId);
  memoryCache.set(key, state);
  try {
    await AsyncStorage.setItem(key, serialiseSpineState(state));
  } catch {
    // Memory cache still holds it for this session.
  }
}
