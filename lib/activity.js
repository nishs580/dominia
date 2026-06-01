import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initialize,
  getSdkStatus,
  getGrantedPermissions,
  aggregateGroupByDuration,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { hasForegroundStepsRead } from './healthConnect';
import { loadPlayerStride } from './claim';
import { postActivitySteps } from './activityApi';
import {
  formatHexAsUuid,
  alignToMinute,
  buildSampleFromBucket,
  evictOldestIfOverCap,
  shouldFlush,
  mergeRehydratedState,
} from './activity.helpers';

const STORAGE_KEY = 'dominia.activity.buffer.v1';
const BUFFER_CAP = 1000;
const BATCH_CAP = 100;
const PERIODIC_INTERVAL_MS = 2 * 60_000;
const RECOVERY_CAP_MS = 6 * 60 * 60_000;
const FIRST_COLLECTION_RANGE_MS = 5 * 60_000;
const FOREGROUND_INACTIVE_THRESHOLD_MS = 5 * 60_000;

/** @type {ReturnType<typeof setInterval> | null} */
let _currentFlushPromise = null;

let _state = {
  started: false,
  playerId: null,
  getToken: null,
  strideM: 0.75,
  hasPermission: false,
  sdkAvailable: false,

  samples: [],
  lastFlushedWindowEndMs: null,
  lastFlushAt: null,
  lastFlushFailed: false,

  flushInProgress: false,
  lastIsConnected: true,
  lastAppState: 'active',
  periodicTimerId: null,
  sdkUnavailableLogged: false,
};

function _isForegroundAppState(appState) {
  return appState === 'active' || appState === 'inactive';
}

export async function start(playerId, getToken) {
  if (_state.started) return;

  _state.started = true;
  _state.playerId = playerId;
  _state.getToken = getToken;

  try {
    const strideResult = await loadPlayerStride(playerId);
    _state.strideM = strideResult?.strideM ?? 0.75;
  } catch (_) {
    _state.strideM = 0.75;
  }

  let sdkOk = false;
  try {
    const status = await getSdkStatus();
    _state.sdkAvailable = status === SdkAvailabilityStatus.SDK_AVAILABLE;
    if (!_state.sdkAvailable) {
      if (!_state.sdkUnavailableLogged) {
        console.warn('[activity.producer] sdk unavailable');
        _state.sdkUnavailableLogged = true;
      }
      console.log(
        `[activity.producer] start playerId=${playerId} sdk=false perm=${_state.hasPermission} buffer=${_state.samples.length}`,
      );
      return;
    }
    sdkOk = await initialize();
    if (!sdkOk) {
      console.warn('[activity.producer] initialize failed');
      console.log(
        `[activity.producer] start playerId=${playerId} sdk=false perm=${_state.hasPermission} buffer=${_state.samples.length}`,
      );
      return;
    }
  } catch (e) {
    console.warn(`[activity.producer] sdk init error: ${e?.message ?? e}`);
    return;
  }

  await _checkPermission();
  await _rehydrate();

  if (_isForegroundAppState(_state.lastAppState)) {
    _startTimer();
  }

  console.log(
    `[activity.producer] start playerId=${playerId} sdk=${sdkOk} perm=${_state.hasPermission} buffer=${_state.samples.length}`,
  );

  if (_state.samples.length > 0) {
    setTimeout(() => {
      _flush('startup-drain');
    }, 0);
  }
}

export function stop() {
  _stopTimer();
  _state.flushInProgress = false;
  _currentFlushPromise = null;
  _state.started = false;
  _state.playerId = null;
  _state.getToken = null;
  console.log('[activity.producer] stop');
}

export function onAppStateChange(nextState) {
  const wasForeground = _isForegroundAppState(_state.lastAppState);
  const isForeground = _isForegroundAppState(nextState);

  if (wasForeground && !isForeground) {
    _onBackground();
  } else if (!wasForeground && isForeground) {
    _onForeground();
  }

  _state.lastAppState = nextState;
}

export function onNetworkChange({ isConnected }) {
  if (_state.lastIsConnected === isConnected) return;

  const prev = _state.lastIsConnected;
  _state.lastIsConnected = isConnected;

  if (isConnected && !prev) {
    const willFlush = _state.lastFlushFailed && _state.samples.length > 0;
    console.log(
      `[activity.producer] network restored buffer=${_state.samples.length} willFlush=${willFlush}`,
    );
    if (willFlush) {
      _flush('network');
    }
  } else if (!isConnected && prev) {
    console.warn('[activity.producer] network lost');
  }
}

export function onPermissionGranted() {
  _checkPermission();
}

export async function flushNow() {
  if (!_state.started) return;
  return _flush('manual');
}

export function getBufferSize() {
  return _state.samples.length;
}

function _startTimer() {
  if (_state.periodicTimerId != null) {
    clearInterval(_state.periodicTimerId);
  }
  _state.periodicTimerId = setInterval(() => {
    _periodicTick();
  }, PERIODIC_INTERVAL_MS);
}

function _stopTimer() {
  if (_state.periodicTimerId != null) {
    clearInterval(_state.periodicTimerId);
    _state.periodicTimerId = null;
  }
}

async function _periodicTick() {
  await _collectAndEnqueue();
  await _flush('periodic');
}

async function _collectAndEnqueue() {
  if (!_state.sdkAvailable || !_state.hasPermission) return;

  const now = alignToMinute(Date.now());
  let start = _state.lastFlushedWindowEndMs ?? (now - FIRST_COLLECTION_RANGE_MS);
  start = Math.max(start, now - RECOVERY_CAP_MS);

  if (now - start < 60_000) return;

  try {
    const buckets = await aggregateGroupByDuration({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(start).toISOString(),
        endTime: new Date(now).toISOString(),
      },
      timeRangeSlicer: { duration: 'MINUTES', length: 1 },
    });

    let nonZero = 0;
    for (const bucket of buckets ?? []) {
      const windowStartMs = new Date(bucket.startTime).getTime();
      const windowEndMs = new Date(bucket.endTime).getTime();
      const sourceId = await _generateSourceId(_state.playerId, windowStartMs, windowEndMs);
      const sample = buildSampleFromBucket(bucket, sourceId, _state.strideM);
      if (sample !== null) {
        _state.samples.push(sample);
        nonZero += 1;
      }
    }

    const { kept, dropped } = evictOldestIfOverCap(_state.samples, BUFFER_CAP);
    _state.samples = kept;
    if (dropped > 0) {
      console.warn(`[activity.producer] buffer cap-hit dropped=${dropped} kept=${BUFFER_CAP}`);
    }
    _state.lastFlushedWindowEndMs = now;
    await _snapshotToStorage();

    console.log(
      `[activity.producer] collect range=${start}..${now} buckets=${buckets?.length ?? 0} nonZero=${nonZero} buffered=${_state.samples.length}`,
    );
  } catch (e) {
    console.warn(`[activity.producer] hc-read failed: ${e?.message ?? e}`);
  }
}

async function _generateSourceId(playerId, windowStartMs, windowEndMs) {
  const input = `${playerId}|${windowStartMs}|${windowEndMs}`;
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return formatHexAsUuid(hex);
}

async function _flush(trigger) {
  if (_state.flushInProgress && _currentFlushPromise) {
    return _currentFlushPromise;
  }

  const decision = shouldFlush(
    {
      bufferSize: _state.samples.length,
      isConnected: _state.lastIsConnected,
      flushInProgress: _state.flushInProgress,
      lastFlushAt: _state.lastFlushAt,
      now: Date.now(),
    },
    trigger,
  );

  if (!decision.shouldFlush) {
    console.log(`[activity.producer] flush skip reason=${decision.reason}`);
    return;
  }

  _state.flushInProgress = true;
  _currentFlushPromise = (async () => {
    try {
      const batch = _state.samples.slice(0, BATCH_CAP);
      console.log(`[activity.producer] flush attempt trigger=${trigger} size=${batch.length}`);

      const result = await postActivitySteps({
        clerkGetToken: _state.getToken,
        samples: batch,
      });

      if (result.ok) {
        _state.samples = _state.samples.slice(batch.length);
        _state.lastFlushAt = Date.now();
        _state.lastFlushFailed = false;
      } else if (!result.retryable) {
        _state.samples = _state.samples.slice(batch.length);
        _state.lastFlushFailed = false;
      } else {
        _state.lastFlushFailed = true;
      }

      await _snapshotToStorage();
    } finally {
      _state.flushInProgress = false;
      _currentFlushPromise = null;
    }
  })();

  return _currentFlushPromise;
}

async function _checkPermission() {
  try {
    const granted = await getGrantedPermissions();
    const next = hasForegroundStepsRead(granted);
    if (next !== _state.hasPermission) {
      console.log(`[activity.producer] permission ${next ? 'granted' : 'lost'}`);
    }
    _state.hasPermission = next;
  } catch (e) {
    console.warn(`[activity.producer] permission check failed: ${e?.message ?? e}`);
  }
}

async function _snapshotToStorage() {
  try {
    const payload = {
      playerId: _state.playerId,
      samples: _state.samples,
      lastFlushedWindowEndMs: _state.lastFlushedWindowEndMs,
      lastFlushAt: _state.lastFlushAt,
      lastFlushFailed: _state.lastFlushFailed,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn(`[activity.producer] storage error: ${e?.message ?? e}`);
  }
}

async function _rehydrate() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        parsed = null;
      }
    }
    const merged = mergeRehydratedState(parsed, _state.playerId);
    _state.samples = merged.samples;
    _state.lastFlushedWindowEndMs = merged.lastFlushedWindowEndMs;
    _state.lastFlushAt = merged.lastFlushAt;
    _state.lastFlushFailed = merged.lastFlushFailed;
    const playerMatch = parsed?.playerId === _state.playerId;
    console.log(
      `[activity.producer] rehydrate size=${_state.samples.length} playerMatch=${playerMatch}`,
    );
  } catch (e) {
    console.warn(`[activity.producer] rehydrate error: ${e?.message ?? e}`);
  }
}

async function _onBackground() {
  console.log(`[activity.producer] background bufferOnExit=${_state.samples.length}`);
  _stopTimer();
  await _flush('background');
}

async function _onForeground() {
  const elapsed =
    _state.lastFlushAt == null ? Infinity : Date.now() - _state.lastFlushAt;
  const willFlush = elapsed >= FOREGROUND_INACTIVE_THRESHOLD_MS;
  console.log(
    `[activity.producer] foreground after-inactive=${Math.round(elapsed / 60_000)}min willFlush=${willFlush}`,
  );
  await _checkPermission();
  _startTimer();
  if (willFlush && _state.samples.length > 0) {
    await _flush('foreground');
  }
}
