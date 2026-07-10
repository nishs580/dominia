/**
 * lib/__tests__/firstClaimSpineStore.test.js
 *
 * Loads the store with its imports replaced by fakes (same loader pattern as
 * contestWalkApi.test.js) — plain-node jest cannot resolve AsyncStorage.
 */

const fs = require('fs');
const path = require('path');
const spine = require('../firstClaimSpine');

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
  };
}

function loadStore({ asyncStorage, hasFired }) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'firstClaimSpineStore.js'), 'utf8');
  source = source
    .replace(/import AsyncStorage from '@react-native-async-storage\/async-storage';/, '')
    .replace(/import \{[^}]+\} from '\.\/firstClaimSpine';/, '')
    .replace(/import \{ hasFired \} from '\.\/walkthroughFlags';/, '')
    .replace(/export async function/g, 'async function');
  source += '\nreturn { loadSpineState, saveSpineState };';
  // eslint-disable-next-line no-new-func
  return new Function(
    'AsyncStorage',
    'deserialiseSpineState',
    'initialSpineState',
    'serialiseSpineState',
    'hasFired',
    source,
  )(
    asyncStorage,
    spine.deserialiseSpineState,
    spine.initialSpineState,
    spine.serialiseSpineState,
    hasFired,
  );
}

const neverFired = jest.fn(async () => false);

describe('loadSpineState', () => {
  test('fresh account → initial state at the flight beat', async () => {
    const store = loadStore({ asyncStorage: makeAsyncStorageFake(), hasFired: neverFired });
    const state = await store.loadSpineState('user-1');
    expect(state.beat).toBe('flight');
    expect(state.complete).toBe(false);
  });

  test('persisted mid-spine state round-trips through save/load', async () => {
    const asyncStorage = makeAsyncStorageFake();
    const store = loadStore({ asyncStorage, hasFired: neverFired });
    const mid = spine.spineReduce(spine.initialSpineState(), spine.SPINE_EVENTS.FLIGHT_SETTLED);
    await store.saveSpineState('user-1', mid);

    // A second store instance (fresh memory cache) reads it back from storage.
    const store2 = loadStore({ asyncStorage, hasFired: neverFired });
    const state = await store2.loadSpineState('user-1');
    expect(state.beat).toBe('objective');
    expect(state.flightDone).toBe(true);
  });

  test('accounts that finished the retired demo are adopted as complete', async () => {
    const demoFired = jest.fn(async (userId, name) => name === 'demo');
    const store = loadStore({ asyncStorage: makeAsyncStorageFake(), hasFired: demoFired });
    const state = await store.loadSpineState('user-legacy');
    expect(state.complete).toBe(true);
    expect(state.completedVia).toBe('legacy_demo');
    expect(spine.resumeBeat(state)).toBeNull();
  });

  test('a persisted spine state wins over the legacy demo flag', async () => {
    const asyncStorage = makeAsyncStorageFake();
    const demoFired = jest.fn(async () => true);
    const store = loadStore({ asyncStorage, hasFired: demoFired });
    const mid = spine.spineReduce(spine.initialSpineState(), spine.SPINE_EVENTS.FLIGHT_SETTLED);
    await store.saveSpineState('user-1', mid);

    const store2 = loadStore({ asyncStorage, hasFired: demoFired });
    const state = await store2.loadSpineState('user-1');
    expect(state.complete).toBe(false);
    expect(state.beat).toBe('objective');
    expect(demoFired).not.toHaveBeenCalled();
  });

  test('storage failure degrades to a fresh in-memory state, never throws', async () => {
    const store = loadStore({ asyncStorage: makeAsyncStorageFake({ failing: true }), hasFired: neverFired });
    const state = await store.loadSpineState('user-1');
    expect(state.beat).toBe('flight');
    expect(state.complete).toBe(false);
  });

  test('states are cached per user in memory', async () => {
    const asyncStorage = makeAsyncStorageFake();
    const store = loadStore({ asyncStorage, hasFired: neverFired });
    const done = spine.spineReduce(spine.initialSpineState(), spine.SPINE_EVENTS.CLAIM_STARTED);
    await store.saveSpineState('user-1', done);
    // Same instance: memory cache serves the saved state even if storage lies.
    asyncStorage.backing.clear();
    const state = await store.loadSpineState('user-1');
    expect(state.complete).toBe(true);
  });
});

describe('saveSpineState', () => {
  test('storage failure keeps the in-memory copy for the session', async () => {
    const store = loadStore({ asyncStorage: makeAsyncStorageFake({ failing: true }), hasFired: neverFired });
    let done = spine.spineReduce(spine.initialSpineState(), spine.SPINE_EVENTS.FLIGHT_SETTLED);
    done = spine.spineReduce(done, spine.SPINE_EVENTS.SHEET_OPENED);
    done = spine.spineReduce(done, spine.SPINE_EVENTS.SHEET_DISMISSED);
    expect(spine.isSpineComplete(done)).toBe(true);
    await expect(store.saveSpineState('user-1', done)).resolves.toBeUndefined();
    const state = await store.loadSpineState('user-1');
    expect(state).toBe(done);
  });
});
