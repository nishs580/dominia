import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device cache of the signed-in player's own home pin.
 *
 * The pin is no longer readable through the anon Supabase client (the
 * 20260710 column lockdown), so the only authoritative source is GET /me on
 * the backend. Territories, by contrast, still come straight from Supabase —
 * so when the backend is slow or unreachable the map renders perfectly but
 * has no idea where home is, and opens on the locale fallback centre (a city
 * that can be thousands of km away). Caching the pin locally means the map
 * opens at home on every launch after the first, with no network round-trip
 * in the critical path.
 *
 * Storage failures degrade to the in-memory copy, mirroring
 * lib/firstClaimSpineStore.js.
 *
 * Coordinates are stored and returned as [lng, lat] — Mapbox order.
 */

const keyFor = (userId) => `dominia:homePin:${userId ?? 'anon'}`;

const memoryCache = new Map();

function normalise(lng, lat) {
  const nLng = Number(lng);
  const nLat = Number(lat);
  if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) return null;
  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) return null;
  return [nLng, nLat];
}

/** Synchronous read of the same-session copy. null when nothing is cached yet. */
export function peekHomePin(userId) {
  return memoryCache.get(keyFor(userId)) ?? null;
}

/** @returns {Promise<[number, number] | null>} [lng, lat] */
export async function loadHomePin(userId) {
  const key = keyFor(userId);
  if (memoryCache.has(key)) return memoryCache.get(key);

  let coord = null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      coord = normalise(parsed?.lng, parsed?.lat);
    }
  } catch {
    coord = null;
  }

  memoryCache.set(key, coord);
  return coord;
}

/** Persist a pin. Invalid coordinates are ignored rather than cached. */
export async function saveHomePin(userId, lng, lat) {
  const coord = normalise(lng, lat);
  if (!coord) return;
  const key = keyFor(userId);
  memoryCache.set(key, coord);
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ lng: coord[0], lat: coord[1] }));
  } catch {
    // Memory cache still holds it for this session.
  }
}

/** Drop the cached pin (account deletion, or a pin the server no longer has). */
export async function clearHomePin(userId) {
  const key = keyFor(userId);
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing else to do — the memory copy is already gone.
  }
}
