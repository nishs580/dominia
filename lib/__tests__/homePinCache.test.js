/**
 * lib/__tests__/homePinCache.test.js
 *
 * Loads the cache with AsyncStorage replaced by a fake (same loader pattern as
 * firstClaimSpineStore.test.js) — plain-node jest cannot resolve AsyncStorage.
 */

const fs = require('fs');
const path = require('path');

function makeAsyncStorageFake({ failing = false } = {}) {
  const backing = new Map();
  return {
    backing,
    async getItem(key) {
      if (failing) throw new Error('storage unavailable');
      return backing.has(key) ? backing.get(key) : null;
    },
    async setItem(key, value) {
      if (failing) throw new Error('storage unavailable');
      backing.set(key, value);
    },
    async removeItem(key) {
      if (failing) throw new Error('storage unavailable');
      backing.delete(key);
    },
  };
}

function loadCache(asyncStorage) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'homePinCache.js'), 'utf8');
  source = source
    .replace(/import AsyncStorage from '@react-native-async-storage\/async-storage';/, '')
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function');
  source += '\nreturn { peekHomePin, loadHomePin, saveHomePin, clearHomePin };';
  // eslint-disable-next-line no-new-func
  return new Function('AsyncStorage', source)(asyncStorage);
}

const SPB = [30.3306, 60.0231];

describe('homePinCache', () => {
  test('round-trips a pin as [lng, lat]', async () => {
    const storage = makeAsyncStorageFake();
    const cache = loadCache(storage);

    await cache.saveHomePin('user-1', SPB[0], SPB[1]);
    expect(await cache.loadHomePin('user-1')).toEqual(SPB);
    expect(cache.peekHomePin('user-1')).toEqual(SPB);
  });

  test('reads back from storage in a fresh module instance', async () => {
    const storage = makeAsyncStorageFake();
    await loadCache(storage).saveHomePin('user-1', SPB[0], SPB[1]);

    const reloaded = loadCache(storage); // cold start: empty memory cache
    expect(reloaded.peekHomePin('user-1')).toBeNull();
    expect(await reloaded.loadHomePin('user-1')).toEqual(SPB);
  });

  test('keys by user — one account never sees another\'s pin', async () => {
    const storage = makeAsyncStorageFake();
    const cache = loadCache(storage);

    await cache.saveHomePin('user-1', SPB[0], SPB[1]);
    expect(await cache.loadHomePin('user-2')).toBeNull();
  });

  test('returns null when nothing is cached', async () => {
    const cache = loadCache(makeAsyncStorageFake());
    expect(await cache.loadHomePin('user-1')).toBeNull();
  });

  test('ignores non-finite and out-of-range coordinates', async () => {
    const storage = makeAsyncStorageFake();
    const cache = loadCache(storage);

    await cache.saveHomePin('user-1', undefined, 60);
    await cache.saveHomePin('user-1', NaN, 60);
    await cache.saveHomePin('user-1', 30, 91);
    await cache.saveHomePin('user-1', 181, 60);
    expect(await cache.loadHomePin('user-1')).toBeNull();
  });

  test('survives corrupt stored JSON', async () => {
    const storage = makeAsyncStorageFake();
    storage.backing.set('dominia:homePin:user-1', '{not json');
    const cache = loadCache(storage);
    expect(await cache.loadHomePin('user-1')).toBeNull();
  });

  test('storage failure degrades to the in-memory copy', async () => {
    const cache = loadCache(makeAsyncStorageFake({ failing: true }));

    await cache.saveHomePin('user-1', SPB[0], SPB[1]);
    expect(cache.peekHomePin('user-1')).toEqual(SPB);
    expect(await cache.loadHomePin('user-1')).toEqual(SPB);
  });

  test('clearHomePin drops both copies', async () => {
    const storage = makeAsyncStorageFake();
    const cache = loadCache(storage);

    await cache.saveHomePin('user-1', SPB[0], SPB[1]);
    await cache.clearHomePin('user-1');
    expect(cache.peekHomePin('user-1')).toBeNull();
    expect(await cache.loadHomePin('user-1')).toBeNull();
    expect(storage.backing.size).toBe(0);
  });
});
