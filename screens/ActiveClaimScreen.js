import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, AppState, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Accelerometer, Pedometer } from 'expo-sensors';
import { createGaitAnalyzer, GAIT_CONSTANTS } from '../lib/gaitSignature';
import {
  getSdkStatus,
  SdkAvailabilityStatus,
  initialize,
  requestPermission,
  readRecords,
} from '../lib/health';
import * as claimWalkSamples from '../lib/claimWalkSamples';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { logDebug } from '../lib/debug';
import { hasFired, markFired } from '../lib/walkthroughFlags';
import * as contestWalk from '../lib/contestWalk';
import {
  claimState,
  subscribe,
  startClaim,
  endClaim,
  setTick,
  rehydrateFromStorage,
} from '../lib/claimState';
import { activateClaim } from '../lib/claimApi';
import {
  loadPlayerStride,
  stepsToMetres,
  speedSampleKmh,
  nextVehicleState,
  cadenceSpmFrom,
  CLAIM_CONSTANTS,
  isQualifyingCalibrationWindow,
  pushCalibrationSample,
  haversineMetres,
  paceSpm,
} from '../lib/claim';

// ─── Foreground-service location task (module scope) ────────────────────
const LOCATION_TASK_NAME = 'dominia-active-claim-location';

// Bridge the component's Clerk token getter into module scope so the
// background location task can authenticate its calibration-sample push and
// debug logs. The component keeps this in sync with useAuth().getToken.
let taskGetToken = null;

// ─── Walk engine (module scope — survives screen blur) ─────────────────
// Steps come from two sources with very different freshness:
//   1. The hardware pedometer (expo-sensors) — event-driven, ~1s latency.
//      This is what moves the ring.
//   2. Health Connect — authoritative daily record, but recording apps flush
//      it minutes late. Used as a reconciliation floor and as the fallback
//      when the pedometer is unavailable.
// The session total is max(pedometer, HC-delta): both measure the same walk,
// so taking the max can never double-count.
let pedoSessionSteps = 0;      // cumulative steps from the pedometer watch
let pedoActive = false;
let baselineSteps = null;      // HC absolute reading at walk start
let hcSessionSteps = 0;        // HC-delta since walk start
let countedSessionSteps = 0;   // steps already routed through ingest
let lastStepTimestamp = Date.now();
let excludedSteps = 0;

// Gait signature — does the raw motion look like a body walking, or like a
// phone being shaken to drive the step counter? The step counter itself can
// be fooled; the accelerometer stream is much harder to fake.
let gaitAnalyzer = null;
let gaitImplausibleSince = null;
let gaitGated = false;
let halfwayFired = false;
let finalStretchFired = false;
let calibrationWindowStart = null;   // { steps, timestamp, lat, lon }
let currentStrideM = 0.75;
let currentStrideSessions = 0;
let lastGpsFix = null;
let currentSpeedKmh = 0;
let vehicleFilter = { overCapSince: null, inVehicle: false };
let lastSpeedSampleAt = 0;
// Trailing [{ at, steps }] of cumulative session steps — the input to the
// cadence veto that outranks GPS in the vehicle filter.
let cadenceHistory = [];
let gpsWeakSince = null;             // ms timestamp weak GPS began, or null
let bannerStateModule = null;
let milestoneBannerTimer = null;
let lastHousekeepingAt = 0;
let lastHcPollAt = 0;
let paceAnchor = { steps: 0, at: Date.now() };

// Contest walk aggregator (module scope — 30s windows)
let contestAggregator = { startMs: Date.now(), steps: 0, distanceM: 0 };

// Set to true to drop a COMPLETE NOW button at the bottom for UI iteration without walking.
const DEV_MODE_MANUAL = false;

const HOUSEKEEPING_MS = 5000;            // ambient banners, speed decay, calibration
const HC_POLL_INTERVAL_MS = 10000;       // HC reconciliation cadence — matches ActivityScreen
const CONTEST_WINDOW_MS = 30_000;
const STALE_GPS_THRESHOLD_MS = 5000;     // skip GPS points older than this
const ZERO_MOVEMENT_WARN_MS = 30 * 1000; // 30s zero movement → show "PAUSED" banner
const GPS_WEAK_PERSIST_MS = 20 * 1000;   // weak GPS must persist this long before the banner shows
const CADENCE_WINDOW_MS = 30 * 1000;     // trailing window the cadence veto reads
// Sustained implausible motion before steps stop counting. Long enough that a
// bag jostle, a phone fumbled out of a pocket, or one bad window never costs a
// real walker anything.
const GAIT_SUSTAIN_MS = 15 * 1000;

const INK = colors.ink;
const INK2 = colors.ink2;
const INK3 = colors.ink3;
const BONE = colors.bone;
const SLATE2 = colors.slate2;
const CLAIM = colors.claim;
const AMBER = colors.caution;
const HAIRLINE_STRONG = colors.hairlineStrong;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatMetres(m) {
  return `${Math.max(0, Math.round(m))}`;
}

// Claim-intent time remaining as H:MM:SS (or MM:SS under an hour).
function formatTimeLeft(remainingMs) {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const TIME_LEFT_ESCALATE_MS = 2 * 60 * 1000; // last two minutes read as caution

function flushContestAggregatorWindow() {
  if (contestAggregator.steps > 0) {
    contestWalk.enqueueSample({
      steps: contestAggregator.steps,
      distanceM: contestAggregator.distanceM,
      windowStartMs: contestAggregator.startMs,
      windowEndMs: contestAggregator.startMs + CONTEST_WINDOW_MS,
    });
  }
  contestAggregator = {
    startMs: contestAggregator.startMs + CONTEST_WINDOW_MS,
    steps: 0,
    distanceM: 0,
  };
}

function drainContestWindows() {
  while (Date.now() - contestAggregator.startMs >= CONTEST_WINDOW_MS) {
    flushContestAggregatorWindow();
  }
}

function flushPartialContestWindow() {
  if (contestAggregator.steps > 0) {
    const endMs = Date.now();
    contestWalk.enqueueSample({
      steps: contestAggregator.steps,
      distanceM: contestAggregator.distanceM,
      windowStartMs: contestAggregator.startMs,
      windowEndMs: endMs,
    });
    contestAggregator = { startMs: endMs, steps: 0, distanceM: 0 };
  }
}

function walkErrorToastMessage(t, code, context) {
  switch (code) {
    case 'player_not_found':
      return t('activeClaim.toastLostSession');
    case 'contest_not_found':
      return t('activeClaim.toastContestGone');
    case 'contest_not_active':
      if (context?.status === 'expired') return t('activeClaim.toastContestExpired');
      if (context?.status === 'attacker_won' || context?.status === 'defender_won') {
        return t('activeClaim.toastContestResolved');
      }
      return t('activeClaim.toastContestResolved');
    case 'not_a_participant':
      return t('activeClaim.toastNotParticipant');
    default:
      return t('activeClaim.toastGenericError');
  }
}

async function readTodaySteps() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  const result = await readRecords('Steps', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  });
  const records = result?.records ?? result ?? [];
  return records.reduce((sum, r) => sum + (r?.count ?? 0), 0);
}

// GPS task: fix bookkeeping only. Steps are event-driven from the pedometer
// (ingestSessionSteps), and ambient housekeeping runs on its own interval —
// a walk indoors or through an urban canyon must never stall because GPS
// went quiet, which is exactly what the old GPS-driven tick did.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[claim] task error:', error?.message);
    return;
  }
  const loc = data?.locations?.[data.locations.length - 1];
  if (!loc?.coords) return;

  const { latitude, longitude, accuracy, speed } = loc.coords;
  const ts = loc.timestamp ?? Date.now();
  if (latitude == null || longitude == null) return;

  const taskFix = { latitude, longitude, accuracy: accuracy ?? 9999, timestamp: ts, speed };

  if (!claimState.active) return;

  // Only a fresh fix can produce a speed sample. speedSampleKmh returns null
  // when nothing trustworthy is available (weak fix, fixes too close together,
  // no OS estimate, an implausible reading) — that is "unknown".
  const now = Date.now();
  const sample = (now - taskFix.timestamp) <= STALE_GPS_THRESHOLD_MS
    ? speedSampleKmh(lastGpsFix, taskFix)
    : null;
  if (sample != null) {
    currentSpeedKmh = sample;
    lastSpeedSampleAt = now;
  }
  // Fed unconditionally, including nulls: an unknown reading has to BREAK a
  // building run of over-cap evidence. Skipping nulls (as this used to) let
  // spikes minutes apart accumulate across weak-GPS gaps into a verdict —
  // precisely the urban-canyon conditions that manufacture spikes.
  vehicleFilter = nextVehicleState(vehicleFilter, sample, {
    nowMs: now,
    cadenceSpm: cadenceSpmFrom(cadenceHistory, countedSessionSteps, now),
  });
  lastGpsFix = taskFix;
  // Same bar the speed sampler uses to trust a fix, so "GPS weak · vehicle
  // filter on hold" and the filter actually being on hold are the same
  // condition. Tracked as a since-timestamp: the banner only shows once the
  // weakness has persisted (GPS_WEAK_PERSIST_MS) — a two-second dip between
  // buildings is not something to alarm a walker about.
  const weakNow = (taskFix.accuracy ?? 9999) > CLAIM_CONSTANTS.SPEED_MAX_ACCURACY_M;
  if (weakNow && gpsWeakSince == null) gpsWeakSince = Date.now();
  if (!weakNow) gpsWeakSince = null;

  // Belt-and-braces: with the app foreground-serviced but JS timers throttled,
  // location callbacks still drive housekeeping at its own cadence.
  housekeepingTick();
});

// ─── Step ingest (event-driven) ─────────────────────────────────────────
// Single path every step source funnels through. Applies the vehicle filter,
// feeds the claim/contest sample producers, fires milestone banners, and
// publishes progress to the UI — within ~a second of the foot hitting the
// ground when the pedometer is alive.
function ingestSessionSteps() {
  if (!claimState.active) return;

  const total = Math.max(pedoSessionSteps, hcSessionSteps);
  const delta = total - countedSessionSteps;
  if (delta <= 0) return;
  countedSessionSteps = total;
  lastStepTimestamp = Date.now();

  const gate = currentStepGate();
  if (gate) excludedSteps += delta;

  if (claimState.mode === 'contest') {
    if (!gate) {
      contestAggregator.steps += delta;
      contestAggregator.distanceM += stepsToMetres(delta, currentStrideM);
      drainContestWindows();
    }
  } else {
    // Gated steps are still handed to the producer, deliberately. The minute
    // gets posted carrying the accelerometer evidence against it, the server
    // rejects it, and — the part that matters — posting claims that minute's
    // source_id. Health Connect recorded the same fake steps and would
    // otherwise post them later as a clean, unjudgeable sample; as a duplicate
    // it is now dropped instead.
    claimWalkSamples.addSteps(delta);
  }

  publishProgress();
}

/** Why steps are not counting right now, or null when they are. */
function currentStepGate() {
  if (vehicleFilter.inVehicle) return 'vehicle';
  if (gaitGated) return 'shake';
  return null;
}

function publishProgress() {
  const usableSteps = Math.max(0, countedSessionSteps - excludedSteps);
  const walkedM = stepsToMetres(usableSteps, currentStrideM);

  let distanceM = walkedM;
  let isComplete = false;
  if (claimState.mode === 'contest') {
    distanceM = contestWalk.getCumulativeDistance() + contestAggregator.distanceM;
  } else {
    isComplete = !claimState.completed
      && walkedM >= claimState.perimeterM
      && claimState.perimeterM > 0;
  }

  // Milestone beats — transient, self-clearing, never displaced by ambient
  // housekeeping (it refuses to overwrite them). Keyed off the displayed
  // distance so contest walks get the same beats against their target.
  if (claimState.perimeterM > 0) {
    const ratio = distanceM / claimState.perimeterM;
    let milestone = null;
    if (ratio >= 0.9 && !finalStretchFired) {
      finalStretchFired = true;
      milestone = 'finalStretch';
    } else if (ratio >= 0.5 && !halfwayFired) {
      halfwayFired = true;
      milestone = 'halfway';
    }
    if (milestone) {
      bannerStateModule = milestone;
      if (milestoneBannerTimer) clearTimeout(milestoneBannerTimer);
      milestoneBannerTimer = setTimeout(() => {
        bannerStateModule = null;
        setTick({ bannerState: null });
      }, 4000);
    }
  }

  setTick({
    distanceM,
    liveSteps: usableSteps,
    strideM: currentStrideM,
    strideSessions: currentStrideSessions,
    bannerState: bannerStateModule,
    completed: isComplete,
  });
}

// ─── Housekeeping (interval-driven, ~5s) ────────────────────────────────
// Everything that is about time passing rather than steps landing: speed
// decay, ambient banners, HC reconciliation, stride calibration, pace.
function housekeepingTick() {
  if (!claimState.active) return;
  const now = Date.now();
  if (now - lastHousekeepingAt < HOUSEKEEPING_MS) return;
  lastHousekeepingAt = now;

  // Cadence sample first — the vehicle filter's veto reads this history, so
  // it must be current before any verdict is recomputed below.
  cadenceHistory.push({ at: now, steps: countedSessionSteps });
  const cadenceCutoff = now - CADENCE_WINDOW_MS;
  while (cadenceHistory.length > 1 && cadenceHistory[1].at <= cadenceCutoff) {
    cadenceHistory.shift();
  }
  const cadenceSpm = cadenceSpmFrom(cadenceHistory, countedSessionSteps, now);

  // Decay: with no usable sample recently, speed is unknown, not "still
  // whatever it last was". Without this a single jitter spike could keep
  // steps excluded indefinitely.
  if (lastSpeedSampleAt &&
      (now - lastSpeedSampleAt) > CLAIM_CONSTANTS.SPEED_STALE_MS) {
    currentSpeedKmh = 0;
    vehicleFilter = nextVehicleState(vehicleFilter, null, { nowMs: now });
  } else if (vehicleFilter.inVehicle || vehicleFilter.overCapSince != null) {
    // Re-evaluate a live or building verdict against fresh cadence even when
    // no new fix has landed: the moment the player is demonstrably walking,
    // the flag must drop without waiting on GPS.
    vehicleFilter = nextVehicleState(vehicleFilter, currentSpeedKmh, {
      nowMs: now,
      cadenceSpm,
    });
  }

  // Pace over the last housekeeping window (dev-only display).
  const paceElapsed = now - paceAnchor.at;
  if (paceElapsed >= HC_POLL_INTERVAL_MS) {
    const paceDelta = countedSessionSteps - paceAnchor.steps;
    setTick({ livePace: paceSpm(paceDelta, paceElapsed) });
    paceAnchor = { steps: countedSessionSteps, at: now };
  }

  // HC reconciliation: a floor under the pedometer (and the whole source when
  // the pedometer is unavailable). Deliberately allowed to lag — it is never
  // what makes the ring move, so its flush cadence stops mattering to UX.
  if (claimState.hcPermission === 'granted' && (now - lastHcPollAt) >= HC_POLL_INTERVAL_MS) {
    lastHcPollAt = now;
    readTodaySteps()
      .then((currentSteps) => {
        if (!claimState.active) return;
        if (baselineSteps == null) {
          baselineSteps = currentSteps;
          return;
        }
        hcSessionSteps = Math.max(0, currentSteps - baselineSteps);
        ingestSessionSteps();
      })
      .catch((err) => console.warn('[claim] HC poll error:', err?.message));
  }

  evaluateGait(now, cadenceSpm);

  // Ambient banner — never overwrites a live milestone beat (those clear
  // themselves after 4s).
  if (bannerStateModule !== 'halfway' && bannerStateModule !== 'finalStretch') {
    const zeroMovementMs = now - lastStepTimestamp;
    let nextBanner = null;
    if (zeroMovementMs >= ZERO_MOVEMENT_WARN_MS) {
      nextBanner = 'paused';
    } else if (vehicleFilter.inVehicle) {
      nextBanner = 'vehicle';
    } else if (gaitGated) {
      nextBanner = 'shake';
    } else if (gpsWeakSince != null && (now - gpsWeakSince) >= GPS_WEAK_PERSIST_MS) {
      nextBanner = 'gpsWeak';
    }
    if (nextBanner !== bannerStateModule) {
      bannerStateModule = nextBanner;
      setTick({ bannerState: nextBanner });
    }
  }

  runCalibrationWindow(now);
}

/**
 * Score the accelerometer window and decide whether steps still count.
 *
 * The verdict is recorded against the minute either way — the server gets the
 * evidence for every minute, not just the damning ones, so a missing summary
 * means "no accelerometer", not "nothing to see".
 *
 * Gating requires GAIT_SUSTAIN_MS of continuous implausibility, and a single
 * non-implausible window drops it immediately. Asymmetric on purpose: this is
 * the third filter in this screen that can silently stop a walk counting, and
 * the previous two both shipped false positives onto real players.
 */
function evaluateGait(nowMs, cadenceSpm) {
  if (!gaitAnalyzer) return;

  const stepFreqHz = Number.isFinite(cadenceSpm) && cadenceSpm > 0
    ? cadenceSpm / 60
    : null;
  const result = gaitAnalyzer.evaluate(stepFreqHz);

  if (claimState.mode !== 'contest') {
    claimWalkSamples.noteGaitWindow(result, nowMs);
  }

  if (result.verdict === 'implausible') {
    if (gaitImplausibleSince == null) gaitImplausibleSince = nowMs;
    if (!gaitGated && nowMs - gaitImplausibleSince >= GAIT_SUSTAIN_MS) {
      gaitGated = true;
      console.warn(`[claim] gait gate raised: ${result.reason}`);
    }
    return;
  }

  gaitImplausibleSince = null;
  gaitGated = false;
}

// Stride calibration: GPS-distance-over-steps windows, pushed to the server
// which owns the bounds and the rolling mean. Uses the session step counter —
// only differences matter, so the counter's origin is irrelevant.
function runCalibrationWindow(now) {
  const fix = lastGpsFix;
  if (!fix || vehicleFilter.inVehicle || (fix.accuracy ?? 9999) > 20) {
    calibrationWindowStart = null;
    return;
  }
  if (!calibrationWindowStart) {
    calibrationWindowStart = { steps: countedSessionSteps, timestamp: now, lat: fix.latitude, lon: fix.longitude };
    return;
  }
  const windowMs = now - calibrationWindowStart.timestamp;
  if (windowMs < 30000) return;

  const stepsInWindow = countedSessionSteps - calibrationWindowStart.steps;
  const gpsDist = haversineMetres(calibrationWindowStart.lat, calibrationWindowStart.lon, fix.latitude, fix.longitude);
  const accuracyM = fix.accuracy ?? 9999;
  const { qualifies, rejectReason } = isQualifyingCalibrationWindow({ accuracyM, speedKmh: currentSpeedKmh, windowMs });

  if (__DEV__) {
    const round3 = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);
    logDebug(() => (taskGetToken ? taskGetToken() : null), 'claim_calibration_tick', {
      accuracyM: round3(accuracyM),
      speedKmh: round3(currentSpeedKmh),
      windowMs: round3(windowMs),
      stepsInWindow,
      gpsDistM: round3(gpsDist),
      qualifies,
      rejectReason,
    }).catch(() => {});
  }

  if (qualifies && stepsInWindow > 0 && gpsDist > 0) {
    pushCalibrationSample(() => (taskGetToken ? taskGetToken() : null), gpsDist, stepsInWindow)
      .then((result) => {
        if (result) {
          currentStrideM = result.strideM;
          currentStrideSessions = result.sessions;
          setTick({ strideM: result.strideM, strideSessions: result.sessions });
        }
      })
      .catch(() => {});
  }
  calibrationWindowStart = { steps: countedSessionSteps, timestamp: now, lat: fix.latitude, lon: fix.longitude };
}

export default function ActiveClaimScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { userId, getToken } = useAuth();

  // One-time first-walk hint (fires once per player, ever — the first claim
  // walk is the only time the fill mechanic needs words).
  const [showFirstWalkHint, setShowFirstWalkHint] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await hasFired(userId, 'activeClaimHint')) return;
      if (cancelled) return;
      markFired(userId, 'activeClaimHint');
      setShowFirstWalkHint(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
    taskGetToken = getToken; // keep the module-scope location task authenticated
  }, [getToken]);

  const {
    territoryName = t('activeClaim.territoryFallback'),
    perimeterDistance = 0,
    territoryId,
    territoryGeojson = null,
    playerId,
    mode = 'claim',
    goldPaid,
    freeClaim,
    intentExpiresAt = null,
    armExpiresAt = null,
    walkWindowMinutes = null,
    contestId,
    requiredWalkM: requiredWalkMParam,
    attackerAllianceId,
    role = 'attacker',
    attackerUsername,
  } = route?.params ?? {};

  const requiredWalkM = Math.max(0, Number(requiredWalkMParam) || 0);
  const perimeterM = mode === 'contest'
    ? requiredWalkM
    : Math.max(0, Number(perimeterDistance) || 0);
  const progressThresholdM = perimeterM;

  const progress = useRef(new Animated.Value(0)).current;
  const navigatingRef = useRef(false);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  // Arm gate (claim mode only): the fee is paid but the walk clock has not
  // started. The player has a short window to tap START WALK; letting it run
  // out refunds the gold. 'walking' is the only phase that tracks movement.
  const [armPhase, setArmPhase] = useState(() =>
    mode === 'claim' && armExpiresAt ? 'arming' : 'walking',
  );
  const [activating, setActivating] = useState(false);
  const [armError, setArmError] = useState(null);
  const [lapsedRefund, setLapsedRefund] = useState(null);
  const [windowExpiresAt, setWindowExpiresAt] = useState(intentExpiresAt);

  const armExpiryMs = useMemo(() => {
    if (!armExpiresAt) return null;
    const ms = new Date(armExpiresAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [armExpiresAt]);

  // Claim-window countdown (claim mode only). One second tick — the GPS watch
  // already runs at 1s, so this adds no meaningful battery cost.
  const expiryMs = useMemo(() => {
    if (mode !== 'claim' || !windowExpiresAt) return null;
    const ms = new Date(windowExpiresAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [mode, windowExpiresAt]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (expiryMs == null && armExpiryMs == null) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiryMs, armExpiryMs]);
  const timeLeftMs =
    armPhase !== 'walking' || expiryMs == null
      ? null
      : Math.max(0, expiryMs - nowMs);
  const timeLeftCritical = timeLeftMs != null && timeLeftMs <= TIME_LEFT_ESCALATE_MS;

  const armSecondsLeft =
    armExpiryMs == null ? null : Math.max(0, Math.ceil((armExpiryMs - nowMs) / 1000));

  const handleStartWalk = async () => {
    if (activating) return;
    setActivating(true);
    setArmError(null);
    try {
      const result = await activateClaim({
        clerkGetToken: () => getTokenRef.current(),
        territoryId,
      });
      if (result.ok) {
        setWindowExpiresAt(result.data.window_expires_at ?? null);
        setArmPhase('walking');
        return;
      }
      if (result.code === 'intent_lapsed') {
        setLapsedRefund(result.context?.gold_refunded ?? goldPaid ?? 0);
        setArmPhase('lapsed');
        return;
      }
      setArmError(result.code);
    } finally {
      setActivating(false);
    }
  };

  // The arm window running out is a client-visible fact, but the refund is the
  // server's call — ask it rather than assuming, so the number shown is real.
  // The 2.5s grace matters: activate COMMITS the walk if the server still sees
  // the intent armed, so calling at the client's zero with a fast client clock
  // could start a walk the player deliberately let lapse. Waiting past zero
  // makes the server's answer almost certainly "lapsed, refunded".
  useEffect(() => {
    if (armPhase !== 'arming' || armSecondsLeft == null || armSecondsLeft > 0) return;
    let cancelled = false;
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (cancelled) return;
      const result = await activateClaim({
        clerkGetToken: () => getTokenRef.current(),
        territoryId,
      });
      if (cancelled) return;
      if (result.ok) {
        // Activated in the same instant the timer hit zero — the walk is on.
        setWindowExpiresAt(result.data.window_expires_at ?? null);
        setArmPhase('walking');
        return;
      }
      setLapsedRefund(result.context?.gold_refunded ?? goldPaid ?? 0);
      setArmPhase('lapsed');
    })();
    return () => { cancelled = true; };
  }, [armPhase, armSecondsLeft, territoryId, goldPaid]);

  // Two-step cancel: the first tap swaps the button for a confirmation that
  // names the stakes; nothing destructive happens on a single stray tap.
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const opponentNameRef = useRef(
    role === 'defender' ? (attackerUsername ?? 'opponent') : 'opponent',
  );
  const territoryNameRef = useRef(territoryName);
  const territoryIdRef = useRef(territoryId);
  const playerIdRef = useRef(playerId);
  const attackerAllianceIdRef = useRef(attackerAllianceId);

  useEffect(() => {
    territoryNameRef.current = territoryName;
    territoryIdRef.current = territoryId;
    playerIdRef.current = playerId;
    attackerAllianceIdRef.current = attackerAllianceId;
  }, [territoryName, territoryId, playerId, attackerAllianceId]);

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false, tabBarStyle: { display: 'none' } });
  }, [navigation]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await rehydrateFromStorage();
      if (mounted) forceRender();
    })();
    const unsub = subscribe(() => { if (mounted) forceRender(); });
    return () => { mounted = false; unsub(); };
  }, []);

  useEffect(() => {
    if (mode !== 'claim') return;
    if (claimState.completed && !navigatingRef.current) {
      navigatingRef.current = true;
      setTimeout(() => completeClaim(claimState.distanceM, claimState.liveSteps), 600);
    }
  });

  // Runs every render (distance lives outside React state), but only issues a
  // new animation when the target actually moved.
  const lastAnimatedPctRef = useRef(-1);
  useEffect(() => {
    const nextPct = progressThresholdM > 0
      ? clamp(claimState.distanceM / progressThresholdM, 0, 1)
      : 0;
    if (nextPct === lastAnimatedPctRef.current) return;
    lastAnimatedPctRef.current = nextPct;
    Animated.timing(progress, {
      toValue: nextPct,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  });

  useEffect(() => {
    return () => {
      if (mode === 'contest') {
        flushPartialContestWindow();
        contestWalk.stop();
      }
      if (!navigatingRef.current) {
        // Cancel path. A completed claim keeps its sample producer alive —
        // ClaimSuccessScreen flushes it before asking the server to verify.
        claimWalkSamples.stop();
        endClaim();
      }
    };
  }, [mode]);

  // ─── Walk start: load stride, start step sources, fetch contest metadata ─
  // Gated on the arm phase so nothing is tracked — and no local progress is
  // banked — until the player has actually committed by tapping START WALK.
  useEffect(() => {
    if (armPhase !== 'walking') return undefined;
    let cancelled = false;
    let pedoSub = null;
    let accelSub = null;
    let housekeepingInterval = null;

    pedoSessionSteps = 0;
    pedoActive = false;
    baselineSteps = null;
    hcSessionSteps = 0;
    countedSessionSteps = 0;
    lastStepTimestamp = Date.now();
    excludedSteps = 0;
    gaitAnalyzer = createGaitAnalyzer();
    gaitImplausibleSince = null;
    gaitGated = false;
    halfwayFired = false;
    finalStretchFired = false;
    calibrationWindowStart = null;
    bannerStateModule = null;
    lastGpsFix = null;
    currentSpeedKmh = 0;
    vehicleFilter = { overCapSince: null, inVehicle: false };
    lastSpeedSampleAt = 0;
    cadenceHistory = [];
    gpsWeakSince = null;
    lastHousekeepingAt = 0;
    lastHcPollAt = 0;
    paceAnchor = { steps: 0, at: Date.now() };
    if (milestoneBannerTimer) {
      clearTimeout(milestoneBannerTimer);
      milestoneBannerTimer = null;
    }
    if (mode === 'contest') {
      contestAggregator = { startMs: Date.now(), steps: 0, distanceM: 0 };
    }

    startClaim({ territoryId, playerId, perimeterM, mode, territoryName });

    if (mode === 'claim' && playerId) {
      claimWalkSamples.start({
        playerId,
        clerkGetToken: () => getTokenRef.current(),
        getStrideM: () => currentStrideM,
      });
    }

    housekeepingInterval = setInterval(() => housekeepingTick(), HOUSEKEEPING_MS);

    // Live steps: the hardware pedometer. Event-driven — the ring moves with
    // the walker, not with whenever Google Fit deigns to flush Health Connect.
    (async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available || cancelled) return;
        const perm = await Pedometer.requestPermissionsAsync();
        if (!perm?.granted || cancelled) return;
        const sub = Pedometer.watchStepCount(({ steps }) => {
          if (!Number.isFinite(steps)) return;
          pedoSessionSteps = Math.max(pedoSessionSteps, Math.floor(steps));
          ingestSessionSteps();
        });
        if (cancelled) {
          sub.remove();
          return;
        }
        pedoSub = sub;
        pedoActive = true;
        setTick({ stepSource: 'pedometer' });
      } catch (err) {
        console.warn('[claim] pedometer unavailable:', err?.message);
      }
    })();

    // Raw motion, for the gait-signature check. Bounded by the walk window, so
    // the sampling cost is paid only while a claim is actually running.
    (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(1000 / GAIT_CONSTANTS.SAMPLE_HZ);
        const sub = Accelerometer.addListener((sample) => {
          if (gaitAnalyzer) gaitAnalyzer.push(sample);
        });
        if (cancelled) {
          sub.remove();
          return;
        }
        accelSub = sub;
      } catch (err) {
        // No accelerometer means no gait evidence — the walk proceeds
        // ungated rather than being blocked on a missing sensor.
        console.warn('[claim] accelerometer unavailable:', err?.message);
      }
    })();

    (async () => {
      const { strideM: loadedStride, sessions } = await loadPlayerStride(() => getTokenRef.current());
      if (cancelled) return;
      currentStrideM = loadedStride;
      currentStrideSessions = sessions;
      setTick({ strideM: loadedStride, strideSessions: sessions });

      try {
        const status = await getSdkStatus();
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
          setTick({ hcPermission: 'denied' });
          return;
        }
        await initialize();
        const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
        const hasSteps = granted?.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
        if (cancelled) return;
        setTick({ hcPermission: hasSteps ? 'granted' : 'denied' });

        if (hasSteps) {
          const steps = await readTodaySteps();
          if (cancelled) return;
          baselineSteps = steps;
          lastStepTimestamp = Date.now();
        }
      } catch (err) {
        console.warn('[claim] HC init failed:', err?.message);
        if (!cancelled) setTick({ hcPermission: 'denied' });
      }
    })();

    if (mode === 'contest' && territoryId && role === 'attacker') {
      supabase
        .from('territories')
        .select('players(username)')
        .eq('id', territoryId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.players?.username) opponentNameRef.current = data.players.username;
        });
    }

    return () => {
      cancelled = true;
      if (pedoSub) pedoSub.remove();
      pedoActive = false;
      if (accelSub) accelSub.remove();
      gaitAnalyzer = null;
      if (housekeepingInterval) clearInterval(housekeepingInterval);
    };
  }, [armPhase, playerId, mode, territoryId, perimeterM, territoryName, role]);

  useEffect(() => {
    if (mode !== 'contest' || !contestId || !playerId || requiredWalkM <= 0) return;

    const navigateToResult = (env) => {
      navigatingRef.current = true;
      flushPartialContestWindow();
      navigation.replace('ContestResultScreen', {
        outcome: env.outcome,
        role,
        territoryName: territoryNameRef.current,
        territoryId: territoryIdRef.current,
        territoryGeojson,
        playerId: playerIdRef.current,
        opponentName: opponentNameRef.current,
        attackerAlliance: attackerAllianceIdRef.current ?? null,
        myDistance: role === 'defender' ? env.defender_walked_m : env.attacker_walked_m,
        opponentDistance: role === 'defender' ? env.attacker_walked_m : 0,
        resourcesAwarded: env.resources_awarded,
        xpGained: env.xp_awarded,
        balances: {
          iron_after: env.player_resources?.iron,
          stone_after: env.player_resources?.stone,
          gold_after: env.player_resources?.gold,
          morale_after: env.player_resources?.morale,
          xp_after: env.total_xp,
          level_after: env.level_after,
        },
        leveledUp: env.leveled_up,
        firstContestWin: env.first_contest_win,
      });
    };

    const navigateBackWithToast = (code, context) => {
      navigatingRef.current = true;
      flushPartialContestWindow();
      contestWalk.stop();
      const message = walkErrorToastMessage(t, code, context);
      navigation.reset({
        index: 0,
        routes: [{
          name: 'MainTabs',
          params: { screen: 'Map', params: { topBannerMessage: message } },
        }],
      });
    };

    contestWalk.start({
      contestId,
      requiredWalkM,
      playerId,
      clerkGetToken: () => getTokenRef.current(),
      onResolved: navigateToResult,
      onWalkError: navigateBackWithToast,
    });

    const appStateSub = AppState.addEventListener('change', contestWalk.onAppStateChange);

    return () => {
      appStateSub.remove();
      flushPartialContestWindow();
      contestWalk.stop();
    };
  }, [mode, contestId, playerId, requiredWalkM, navigation, role, territoryGeojson]);

  // ─── GPS watch via foreground service ──────────────────────────────────
  useEffect(() => {
    if (armPhase !== 'walking') return undefined;
    let cancelled = false;
    let started = false;

    (async () => {
      try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted' || cancelled) return;

        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          console.warn('[claim] background location not granted — service may be killed on screen off');
        }

        // 3s cadence: the OS speed estimate rides along on every fix and the
        // positional-differencing fallback needs >=3s gaps anyway (SPEED_MIN_DT_MS)
        // — 1s fixes bought nothing but battery drain.
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 0,
          showsBackgroundLocationIndicator: false,
          foregroundService: {
            notificationTitle: t('activeClaim.fgServiceTitle'),
            notificationBody: t('activeClaim.fgServiceBody'),
            notificationColor: '#D64525',
          },
          pausesUpdatesAutomatically: false,
        });
        started = true;
      } catch (err) {
        console.warn('[claim] startLocationUpdatesAsync failed:', err?.message);
      }
    })();

    return () => {
      cancelled = true;
      if (started) {
        Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
      }
    };
  }, [armPhase]);

  function completeClaim(walkedM, finalSteps) {
    navigation.navigate('ClaimSuccessScreen', {
      territoryName,
      perimeterDistance: perimeterM,
      territoryId,
      territoryGeojson,
      playerId,
      goldPaid,
      freeClaim,
      // The payoff celebrates the distance actually walked, not just the requirement.
      walkedM: Math.round(Math.max(0, Number(walkedM) || 0)),
      walkedSteps: Math.max(0, Number(finalSteps) || 0),
    });
  }

  function exitClaim() {
    if (mode === 'contest') {
      flushPartialContestWindow();
      contestWalk.stop();
    }
    navigation.goBack();
  }

  function handleManualComplete() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    completeClaim(perimeterM, claimState.liveSteps);
  }

  const ring = useMemo(() => {
    const size = 230;
    const strokeWidth = 16;
    const radius = (size - strokeWidth) / 2;
    return { size, strokeWidth, radius, cx: size / 2, cy: size / 2, circumference: 2 * Math.PI * radius };
  }, []);

  const strokeDashoffset = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [ring.circumference, 0] }),
    [progress, ring.circumference],
  );

  const pct = progressThresholdM > 0
    ? Math.round(clamp((claimState.distanceM / progressThresholdM) * 100, 0, 100))
    : 0;
  const isCalibrated = claimState.strideSessions >= 3;
  // The walk can count with EITHER source. Health Connect being denied only
  // blocks the walk when the pedometer is dead too.
  const pedometerLive = claimState.stepSource === 'pedometer';
  const hcDenied = claimState.hcPermission === 'denied' && !pedometerLive;

  const cancelConfirmBody = mode === 'contest'
    ? t('activeClaim.cancelConfirmContest')
    : (freeClaim || !goldPaid
        ? t('activeClaim.cancelConfirmFree')
        : t('activeClaim.cancelConfirmPaid', { gold: goldPaid }));

  if (armPhase === 'lapsed') {
    return (
      <View
        style={[
          styles.screen,
          { flex: 1, backgroundColor: INK, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.armBlock}>
          <Text style={styles.armLabel}>{t('activeClaim.arm.lapsedLabel')}</Text>
          <Text style={styles.armTitle}>{t('activeClaim.arm.lapsedTitle')}</Text>
          <Text style={styles.armBody}>
            {lapsedRefund > 0
              ? t('activeClaim.arm.lapsedBodyPaid', { gold: lapsedRefund })
              : t('activeClaim.arm.lapsedBodyFree')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={exitClaim}
            style={({ pressed }) => [styles.armPrimary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.armPrimaryText}>{t('activeClaim.arm.backToMap')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (armPhase === 'arming') {
    return (
      <View
        style={[
          styles.screen,
          { flex: 1, backgroundColor: INK, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.claimingLabel, { marginTop: 32 }]}>{t('activeClaim.claiming')}</Text>
            <Text style={styles.territoryName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>
              {territoryName}
            </Text>
          </View>
        </View>

        <View style={styles.armBlock}>
          <Text style={styles.armCountdown} maxFontSizeMultiplier={1.2}>
            {armSecondsLeft ?? 0}
          </Text>
          <Text style={styles.armLabel}>{t('activeClaim.arm.countdownLabel')}</Text>
          <Text style={styles.armTitle}>
            {t('activeClaim.arm.title', { metres: formatMetres(perimeterM) })}
          </Text>
          <Text style={styles.armBody}>
            {walkWindowMinutes
              ? t('activeClaim.arm.body', { minutes: walkWindowMinutes })
              : t('activeClaim.arm.bodyNoWindow')}
          </Text>
          {goldPaid > 0 ? (
            <Text style={styles.armStake}>{t('activeClaim.arm.stake', { gold: goldPaid })}</Text>
          ) : null}

          {armError ? (
            <Text style={styles.armError}>{t('activeClaim.arm.error')}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={activating}
            onPress={handleStartWalk}
            style={({ pressed }) => [
              styles.armPrimary,
              (pressed || activating) && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.armPrimaryText}>
              {activating ? t('activeClaim.arm.starting') : t('activeClaim.arm.startWalk')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={exitClaim}
            style={({ pressed }) => [styles.armSecondary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.armSecondaryText}>{t('activeClaim.arm.notYet')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INK }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.claimingLabel, { marginTop: 32 }]}>{mode === 'contest' ? t('activeClaim.contesting') : t('activeClaim.claiming')}</Text>
          <Text style={styles.territoryName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{territoryName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('activeClaim.inProgress')}</Text>
        </View>
      </View>

      {hcDenied ? (
        <View style={styles.hcBlocked}>
          <Text style={styles.hcBlockedTitle}>{t('activeClaim.hcBlockedTitle')}</Text>
          <Text style={styles.hcBlockedBody}>{t('activeClaim.hcBlockedBody')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openSettings()}
            style={({ pressed }) => [styles.hcBlockedBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.hcBlockedBtnText}>{t('activeClaim.hcOpenSettings')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={exitClaim}
            style={({ pressed }) => [styles.hcBlockedBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.hcBlockedBtnText}>{t('activeClaim.hcBack')}</Text>
          </Pressable>
        </View>
      ) : (
      <>
      <View style={styles.ringWrap}>
        <View style={styles.ringStack}>
          <Svg width={ring.size} height={ring.size}>
            <Circle cx={ring.cx} cy={ring.cy} r={ring.radius} stroke={INK3} strokeWidth={ring.strokeWidth} fill="none" />
            <AnimatedCircle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.radius}
              stroke={CLAIM}
              strokeWidth={ring.strokeWidth}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${ring.circumference} ${ring.circumference}`}
              strokeDashoffset={strokeDashoffset}
              rotation="-90"
              originX={ring.cx}
              originY={ring.cy}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.pctText} maxFontSizeMultiplier={1.2}>{pct}%</Text>
            <Text style={styles.metresText}>{`${formatMetres(claimState.distanceM)} / ${formatMetres(progressThresholdM)} m`}</Text>
          </View>
        </View>
        {showFirstWalkHint ? (
          <Text style={styles.firstWalkHint}>{t('firstClaim.activeHint')}</Text>
        ) : null}
        {/* 'unknown' is neither granted nor denied: no HC steps can count in
            it, and without a live pedometer the ring would silently never
            progress. Say so — but only when the pedometer isn't carrying
            the walk already. */}
        {claimState.hcPermission === 'unknown' && !pedometerLive ? (
          <Text style={styles.firstWalkHint}>{t('activeClaim.hcChecking')}</Text>
        ) : null}
      </View>

      {timeLeftMs != null && (
        <View style={styles.timeLeftBlock}>
          <Text style={styles.timeLeftLabel}>{t('activeClaim.statTimeLeft')}</Text>
          <Text
            style={[
              styles.timeLeftValue,
              // One caution element per screen: the readout yields amber to any
              // caution banner currently showing.
              timeLeftCritical && !['paused', 'vehicle'].includes(claimState.bannerState)
                ? { color: AMBER }
                : null,
            ]}
            maxFontSizeMultiplier={1.2}
          >
            {formatTimeLeft(timeLeftMs)}
          </Text>
        </View>
      )}

      <View style={styles.statsPanel}>
        {/* Distance lives in the ring centre; stride/pace are calibration
            diagnostics a walker never acts on — dev builds only. */}
        <StatRow label={t('activeClaim.statSteps')} value={String(claimState.liveSteps)} last={!__DEV__} />
        {__DEV__ && (
          <StatRow label={isCalibrated ? t('activeClaim.statStrideCal') : t('activeClaim.statStrideDefault')} value={`${claimState.strideM.toFixed(2)} m`} />
        )}
        {__DEV__ && (
          <StatRow label={t('activeClaim.statPace')} value={`${claimState.livePace} spm`} last />
        )}
      </View>

      <View style={styles.bannerZone}>
        {claimState.bannerState === 'vehicle' && (
          <Banner color={AMBER} label={t('activeClaim.bannerVehicle')} />
        )}
        {claimState.bannerState === 'shake' && (
          <Banner color={AMBER} label={t('activeClaim.bannerShake')} />
        )}
        {claimState.bannerState === 'paused' && (
          <Banner color={AMBER} label={t('activeClaim.bannerPaused')} />
        )}
        {claimState.bannerState === 'gpsWeak' && (
          <Banner color={SLATE2} label={t('activeClaim.bannerGpsWeak')} />
        )}
        {claimState.bannerState === 'halfway' && (
          <Banner color={BONE} label={t('activeClaim.bannerHalfway')} />
        )}
        {claimState.bannerState === 'finalStretch' && (
          <Banner color={BONE} label={t('activeClaim.bannerFinalStretch')} />
        )}
      </View>
      </>
      )}

      <View style={{ flex: 1 }} />

      {DEV_MODE_MANUAL && !hcDenied && (
        <Pressable onPress={handleManualComplete} style={styles.devBtn}>
          <Text style={styles.devBtnText}>{t('activeClaim.devComplete')}</Text>
        </Pressable>
      )}

      {hcDenied ? null : confirmingCancel ? (
        <View style={styles.cancelConfirmBlock}>
          <Text style={styles.cancelConfirmText}>{cancelConfirmBody}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmingCancel(false)}
            style={({ pressed }) => [styles.keepWalkingBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.keepWalkingText}>{t('activeClaim.keepWalking')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={exitClaim}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.cancelText}>
              {mode === 'contest' ? t('activeClaim.endWalk') : t('activeClaim.endClaim')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('activeClaim.cancelClaim')}
          onPress={() => setConfirmingCancel(true)}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.cancelText}>{t('activeClaim.cancelClaim')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function StatRow({ label, value, valueStyle = null, last }) {
  return (
    <View style={[styles.statRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function Banner({ color, label }) {
  return (
    <View style={[styles.banner, { borderColor: color }]}>
      <Text style={[styles.bannerText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  claimingLabel: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 },
  territoryName: { fontFamily: 'Archivo_900Black', color: BONE, fontSize: 24, letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 28 },
  // Neutral instrument — the progress ring is this screen's one red element.
  badge: { marginTop: 4, backgroundColor: INK2, borderColor: HAIRLINE_STRONG, borderWidth: 1, borderRadius: 0, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  ringWrap: { marginTop: 24, alignItems: 'center', justifyContent: 'center' },
  ringStack: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pctText: { fontFamily: 'Archivo_700Bold', color: BONE, fontSize: 48, letterSpacing: -1 },
  // Bone, not slate — this is the real number, read mid-walk in direct sun.
  metresText: { fontFamily: 'GeistMono_400Regular', color: BONE, fontSize: 11, letterSpacing: 0.8, marginTop: 4 },

  // The deadline is a first-class instrument, not a table row.
  timeLeftBlock: { marginTop: 18, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10 },
  timeLeftLabel: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase' },
  timeLeftValue: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 18, letterSpacing: 1 },

  statsPanel: { marginTop: 24, backgroundColor: INK2, borderWidth: 1, borderColor: HAIRLINE_STRONG, borderRadius: 0 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE_STRONG },
  statLabel: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  statValue: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 14, letterSpacing: 0.2 },

  firstWalkHint: { fontFamily: 'InstrumentSans_400Regular', color: SLATE2, fontSize: 12, textAlign: 'center', marginTop: 14, paddingHorizontal: 24 },
  bannerZone: { marginTop: 12, minHeight: 36 },
  banner: { borderWidth: 1, borderRadius: 0, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'transparent' },
  bannerText: { fontFamily: 'GeistMono_500Medium', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },

  devBtn: { marginBottom: 8, backgroundColor: CLAIM, borderRadius: 0, paddingVertical: 12, alignItems: 'center' },
  devBtnText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  cancelBtn: { backgroundColor: INK2, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  cancelConfirmBlock: { gap: 10 },
  cancelConfirmText: { fontFamily: 'InstrumentSans_400Regular', color: BONE, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 12 },
  keepWalkingBtn: { backgroundColor: INK2, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  keepWalkingText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  // Health-Connect blocking state — the walk cannot count; say so and route out.
  hcBlocked: { marginTop: 32, backgroundColor: INK2, borderWidth: 1, borderColor: HAIRLINE_STRONG, borderRadius: 0, padding: 16, gap: 12 },
  hcBlockedTitle: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  hcBlockedBody: { fontFamily: 'InstrumentSans_400Regular', color: BONE, fontSize: 13, lineHeight: 19 },
  hcBlockedBtn: { backgroundColor: INK, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  hcBlockedBtnText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  // Arm gate — fee paid, walk clock not started. The countdown is the one loud
  // element; everything else stays quiet so START WALK is the obvious target.
  armBlock: { flex: 1, justifyContent: 'center', gap: 12 },
  armCountdown: { fontFamily: 'Archivo_700Bold', color: CLAIM, fontSize: 72, letterSpacing: -2, textAlign: 'center' },
  armLabel: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center' },
  armTitle: { fontFamily: 'Archivo_700Bold', color: BONE, fontSize: 22, lineHeight: 28, marginTop: 8 },
  armBody: { fontFamily: 'InstrumentSans_400Regular', color: BONE, fontSize: 14, lineHeight: 21 },
  armStake: { fontFamily: 'GeistMono_500Medium', color: AMBER, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  armError: { fontFamily: 'InstrumentSans_400Regular', color: AMBER, fontSize: 13, lineHeight: 19 },
  armPrimary: { backgroundColor: CLAIM, borderRadius: 0, paddingVertical: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  armPrimaryText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  armSecondary: { backgroundColor: INK, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  armSecondaryText: { fontFamily: 'GeistMono_500Medium', color: SLATE2, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
});
