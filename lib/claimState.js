import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dominia.claimState.v1';

// Module-level mutable state object
export const claimState = {
  active: false,
  territoryId: null,
  playerId: null,
  perimeterM: 0,
  mode: 'claim',
  territoryName: '',
  startedAt: null,

  // Progress
  distanceM: 0,
  liveSteps: 0,
  livePace: 0,
  strideM: 0.75,
  strideSessions: 0,

  // Last tick diagnostics
  lastTickAt: null,
  lastAccuracyM: null,
  lastSpeedKmh: 0,
  lastWindowMs: null,
  lastStepsInWindow: null,
  lastQualifies: null,
  lastRejectReason: null,

  // UI states
  bannerState: null,        // 'vehicle' | 'paused' | 'reset' | 'gpsWeak' | 'halfway' | null
  pauseElapsedMs: 0,
  hcPermission: 'unknown',
  gpsFixReady: false,

  // Completion flag — screen watches this and navigates
  completed: false,
};

// Tiny subscriber API
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.warn('[claimState] listener error', e); }
  }
}

// Setters — mutate then emit
export function setTick(partial) {
  Object.assign(claimState, partial);
  claimState.lastTickAt = Date.now();
  emit();
  snapshotToStorage();
}

export function startClaim({ territoryId, playerId, perimeterM, mode, territoryName }) {
  Object.assign(claimState, {
    active: true,
    territoryId,
    playerId,
    perimeterM,
    mode,
    territoryName,
    startedAt: Date.now(),
    distanceM: 0,
    liveSteps: 0,
    livePace: 0,
    lastTickAt: null,
    lastAccuracyM: null,
    lastSpeedKmh: 0,
    lastWindowMs: null,
    lastStepsInWindow: null,
    lastQualifies: null,
    lastRejectReason: null,
    bannerState: null,
    pauseElapsedMs: 0,
    gpsFixReady: false,
    completed: false,
  });
  emit();
  snapshotToStorage();
}

export function endClaim() {
  claimState.active = false;
  claimState.territoryId = null;
  claimState.completed = false;
  emit();
  snapshotToStorage();
}

export async function snapshotToStorage() {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(claimState)); }
  catch (e) { console.warn('[claimState] snapshot fail', e?.message); }
}

export async function rehydrateFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    Object.assign(claimState, parsed);
    emit();
    return true;
  } catch (e) { console.warn('[claimState] rehydrate fail', e?.message); return false; }
}
