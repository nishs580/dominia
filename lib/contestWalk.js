import * as Crypto from 'expo-crypto';
import { postContestSamples } from './contestWalkApi';
import { formatHexAsUuid } from './activity.helpers';

const PERIODIC_INTERVAL_MS = 30_000;
const BUFFER_CAP = 100;

const INITIAL_STATE = {
  active: false,
  contestId: null,
  requiredWalkM: 0,
  playerId: null,
  clerkGetToken: null,
  buffer: [],
  cumulativeDistanceM: 0,
  completionFlushTriggered: false,
  flushInProgress: false,
  periodicTimer: null,
  onResolved: null,
  onWalkError: null,
};

/** @type {typeof INITIAL_STATE} */
let _state = { ...INITIAL_STATE };

function _windowKey(sample) {
  return `${sample.windowStartMs}|${sample.windowEndMs}`;
}

function _removeSnapshotFromBuffer(snapshot) {
  const snapshotKeys = new Set(snapshot.map((s) => _windowKey(s)));
  _state.buffer = _state.buffer.filter((s) => !snapshotKeys.has(_windowKey(s)));
}

function _resetState() {
  if (_state.periodicTimer != null) {
    clearInterval(_state.periodicTimer);
  }
  _state = { ...INITIAL_STATE, buffer: [], periodicTimer: null };
}

function _startTimer() {
  if (_state.periodicTimer != null) {
    clearInterval(_state.periodicTimer);
  }
  _state.periodicTimer = setInterval(() => {
    flushNow();
  }, PERIODIC_INTERVAL_MS);
}

function _stopTimer() {
  if (_state.periodicTimer != null) {
    clearInterval(_state.periodicTimer);
    _state.periodicTimer = null;
  }
}

export function start({ contestId, requiredWalkM, playerId, clerkGetToken, onResolved, onWalkError }) {
  if (_state.active) {
    console.warn('[contestWalk.producer] start ignored — already active');
    return;
  }

  _state = {
    ...INITIAL_STATE,
    active: true,
    contestId,
    requiredWalkM,
    playerId,
    clerkGetToken,
    onResolved,
    onWalkError,
    buffer: [],
  };

  _startTimer();
  console.log(`[contestWalk.producer] start contestId=${contestId} requiredWalkM=${requiredWalkM}`);
}

export function stop() {
  if (!_state.active && _state.periodicTimer == null) {
    return;
  }
  _resetState();
  console.log('[contestWalk.producer] stop');
}

export function enqueueSample({ steps, distanceM, windowStartMs, windowEndMs }) {
  if (!_state.active) return;

  _state.buffer.push({ steps, distance_m: distanceM, windowStartMs, windowEndMs });
  if (_state.buffer.length > BUFFER_CAP) {
    const dropped = _state.buffer.length - BUFFER_CAP;
    _state.buffer = _state.buffer.slice(dropped);
    console.warn(`[contestWalk.producer] buffer cap-hit dropped=${dropped} kept=${BUFFER_CAP}`);
  }

  _state.cumulativeDistanceM += distanceM;

  if (
    _state.cumulativeDistanceM >= _state.requiredWalkM
    && !_state.completionFlushTriggered
  ) {
    _state.completionFlushTriggered = true;
    flushNow();
  }
}

export async function flushNow() {
  if (!_state.active || _state.flushInProgress || _state.buffer.length === 0) {
    return;
  }

  _state.flushInProgress = true;
  const snapshot = _state.buffer.slice(0);

  try {
    const wireSamples = await Promise.all(snapshot.map(async (s) => ({
      source_id: formatHexAsUuid(
        await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${_state.playerId}|${_state.contestId}|${s.windowStartMs}|${s.windowEndMs}`,
        ),
      ),
      window_start: new Date(s.windowStartMs).toISOString(),
      window_end: new Date(s.windowEndMs).toISOString(),
      steps: s.steps,
      distance_m: s.distance_m,
    })));

    const result = await postContestSamples({
      clerkGetToken: _state.clerkGetToken,
      contestId: _state.contestId,
      samples: wireSamples,
    });

    if (result.ok) {
      _removeSnapshotFromBuffer(snapshot);

      if (result.data?.status === 'resolved' && result.data?.outcome != null) {
        const env = result.data;
        const cb = _state.onResolved;
        stop();
        cb?.(env);
      }
    } else {
      const { code, context } = result;

      if (code === 'invalid_body') {
        _removeSnapshotFromBuffer(snapshot);
      } else if (code === 'invalid_sample_timestamp') {
        const bad = context?.source_id;
        if (bad) {
          const idx = wireSamples.findIndex((w) => w.source_id === bad);
          if (idx >= 0) {
            const badKey = _windowKey(snapshot[idx]);
            _state.buffer = _state.buffer.filter((s) => _windowKey(s) !== badKey);
          }
        }
      } else if (
        code === 'player_not_found'
        || code === 'contest_not_found'
        || code === 'contest_not_active'
        || code === 'not_a_participant'
      ) {
        const cb = _state.onWalkError;
        stop();
        cb?.(code, context);
      }
    }
  } finally {
    _state.flushInProgress = false;
  }
}

export function onAppStateChange(nextState) {
  if (nextState === 'active') {
    if (_state.active && _state.periodicTimer == null) {
      _startTimer();
    }
    return;
  }

  if (nextState === 'background' || nextState === 'inactive') {
    _stopTimer();
  }
}

export function getCumulativeDistance() {
  return _state.cumulativeDistanceM;
}

export function getBufferSize() {
  return _state.buffer.length;
}
