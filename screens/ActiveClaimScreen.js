import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, AppState, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  getSdkStatus,
  SdkAvailabilityStatus,
  initialize,
  requestPermission,
  readRecords,
} from '../lib/health';
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
import {
  loadPlayerStride,
  stepsToMetres,
  speedSampleKmh,
  nextVehicleState,
  CLAIM_CONSTANTS,
  isQualifyingCalibrationWindow,
  pushCalibrationSample,
  haversineMetres,
  paceSpm,
} from '../lib/claim';

// ─── Foreground-service location task (module scope) ────────────────────
const LOCATION_TASK_NAME = 'dominia-active-claim-location';

let latestTaskFix = null;

// Bridge the component's Clerk token getter into module scope so the
// background location task can authenticate its calibration-sample push and
// debug logs. The component keeps this in sync with useAuth().getToken.
let taskGetToken = null;

// Calibration / step state (module scope — survives screen blur)
let baselineSteps = null;
let lastSteps = 0;
let lastStepTimestamp = Date.now();
let vehicleExcludedSteps = 0;
let halfwayFired = false;
let finalStretchFired = false;
let calibrationWindowStart = null;   // { steps, timestamp, lat, lon }
let calibrationSamples = [];
let currentStrideM = 0.75;
let currentStrideSessions = 0;
let lastGpsFix = null;
let currentSpeedKmh = 0;
let vehicleFilter = { hits: 0, inVehicle: false };
let lastSpeedSampleAt = 0;
let gpsWeak = false;
let bannerStateModule = null;
let halfwayResetTimer = null;

// Contest walk aggregator (module scope — 30s windows)
let contestAggregator = { startMs: Date.now(), steps: 0, distanceM: 0 };

// Set to true to drop a COMPLETE NOW button at the bottom for UI iteration without walking.
const DEV_MODE_MANUAL = false;
const DIAG_CALIBRATION = true;

const POLL_INTERVAL_MS = 10000;          // HC step poll cadence — matches ActivityScreen
const CONTEST_WINDOW_MS = 30_000;
const STALE_GPS_THRESHOLD_MS = 5000;     // skip GPS points older than this
const ZERO_MOVEMENT_WARN_MS = 30 * 1000; // 30s zero movement → show "PAUSED" banner
const PAUSE_RESET_MS = 15 * 60 * 1000;   // 15 min zero movement → reset progress to zero

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

function formatPauseCountdown(ms) {
  const remainingMs = Math.max(0, PAUSE_RESET_MS - ms);
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
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
  latestTaskFix = taskFix;

  if (!claimState.active) return;

  // Only a fresh fix can produce a speed sample. speedSampleKmh returns null
  // when nothing trustworthy is available (weak fix, fixes too close together,
  // no OS estimate) — that is "unknown", and clears the vehicle flag rather
  // than holding the last reading, which used to persist forever once GPS went
  // quiet and silently froze the walk.
  if (lastGpsFix !== taskFix &&
      (Date.now() - taskFix.timestamp) <= STALE_GPS_THRESHOLD_MS) {
    const sample = speedSampleKmh(lastGpsFix, taskFix);
    if (sample != null) {
      currentSpeedKmh = sample;
      lastSpeedSampleAt = Date.now();
      vehicleFilter = nextVehicleState(vehicleFilter, sample);
    }
  }
  lastGpsFix = taskFix;
  gpsWeak = (taskFix.accuracy ?? 9999) > 20;

  const now = Date.now();
  if (claimState.lastTickAt && (now - claimState.lastTickAt) < POLL_INTERVAL_MS) return;

  try {
    if (claimState.hcPermission !== 'granted') {
      setTick({});
      return;
    }

    const currentSteps = await readTodaySteps();
    if (baselineSteps == null) {
      baselineSteps = currentSteps;
      lastSteps = currentSteps;
      setTick({});
      return;
    }

    const stepDeltaTick = Math.max(0, currentSteps - lastSteps);

    // Decay: with no usable sample recently, speed is unknown, not "still
    // whatever it last was". Without this a single jitter spike could keep
    // steps excluded indefinitely.
    if (lastSpeedSampleAt &&
        (now - lastSpeedSampleAt) > CLAIM_CONSTANTS.SPEED_STALE_MS) {
      currentSpeedKmh = 0;
      vehicleFilter = nextVehicleState(vehicleFilter, null);
    }

    const speedKmh = currentSpeedKmh;
    const inVehicle = vehicleFilter.inVehicle;

    if (inVehicle) vehicleExcludedSteps += stepDeltaTick;
    if (stepDeltaTick > 0) lastStepTimestamp = now;

    const totalSteps = currentSteps - baselineSteps;
    const usableSteps = Math.max(0, totalSteps - vehicleExcludedSteps);
    const walkedM = stepsToMetres(usableSteps, currentStrideM);

    const zeroMovementMs = now - lastStepTimestamp;
    const pauseElapsedMs = zeroMovementMs;

    let nextBanner = bannerStateModule;
    let didReset = false;

    if (zeroMovementMs >= PAUSE_RESET_MS) {
      baselineSteps = currentSteps;
      vehicleExcludedSteps = 0;
      halfwayFired = false;
      finalStretchFired = false;
      lastStepTimestamp = now;
      if (claimState.mode === 'contest') {
        contestAggregator = { startMs: Date.now(), steps: 0, distanceM: 0 };
      }
      didReset = true;
      nextBanner = 'reset';
    } else if (zeroMovementMs >= ZERO_MOVEMENT_WARN_MS) {
      nextBanner = 'paused';
    } else if (inVehicle) {
      nextBanner = 'vehicle';
    } else if (gpsWeak) {
      // Weak fix means the vehicle filter is unreliable — say so.
      nextBanner = 'gpsWeak';
    } else if (claimState.perimeterM > 0 && walkedM / claimState.perimeterM >= 0.9 && !finalStretchFired) {
      // Final-stretch beat — the last encouragement before the ring closes.
      finalStretchFired = true;
      nextBanner = 'finalStretch';
      if (halfwayResetTimer) clearTimeout(halfwayResetTimer);
      halfwayResetTimer = setTimeout(() => {
        bannerStateModule = null;
        setTick({ bannerState: null });
      }, 4000);
    } else if (claimState.perimeterM > 0 && walkedM / claimState.perimeterM >= 0.5 && !halfwayFired) {
      halfwayFired = true;
      nextBanner = 'halfway';
      if (halfwayResetTimer) clearTimeout(halfwayResetTimer);
      halfwayResetTimer = setTimeout(() => {
        bannerStateModule = null;
        setTick({ bannerState: null });
      }, 4000);
    } else if (bannerStateModule !== 'halfway' && bannerStateModule !== 'finalStretch') {
      nextBanner = null;
    }
    bannerStateModule = nextBanner;

    const newDistance = didReset ? 0 : walkedM;
    const newSteps = didReset ? 0 : usableSteps;
    const newPace = paceSpm(stepDeltaTick, POLL_INTERVAL_MS);

    let calTickDiag = null;
    const fix = lastGpsFix;
    if (fix && !inVehicle && (fix.accuracy ?? 9999) <= 20) {
      if (!calibrationWindowStart) {
        calibrationWindowStart = { steps: currentSteps, timestamp: now, lat: fix.latitude, lon: fix.longitude };
      } else {
        const windowMs = now - calibrationWindowStart.timestamp;
        const stepsInWindow = currentSteps - calibrationWindowStart.steps;
        const gpsDist = haversineMetres(calibrationWindowStart.lat, calibrationWindowStart.lon, fix.latitude, fix.longitude);
        const accuracyM = fix.accuracy ?? 9999;
        const { qualifies, rejectReason } = isQualifyingCalibrationWindow({ accuracyM, speedKmh, windowMs });
        const candidateStride = stepsInWindow > 0 ? gpsDist / stepsInWindow : null;
        calTickDiag = { accuracyM, speedKmh, windowMs, stepsInWindow, gpsDistM: gpsDist, candidateStride, qualifies, rejectReason };
        if (windowMs >= 30000) {
          if (qualifies && stepsInWindow > 0 && gpsDist > 0) {
            const result = await pushCalibrationSample(() => (taskGetToken ? taskGetToken() : null), gpsDist, stepsInWindow);
            if (result) {
              calibrationSamples = result.samples;
              currentStrideM = result.strideM;
              currentStrideSessions = result.sessions;
            }
          }
          calibrationWindowStart = { steps: currentSteps, timestamp: now, lat: fix.latitude, lon: fix.longitude };
        }
      }
    } else {
      calibrationWindowStart = null;
    }

    if (DIAG_CALIBRATION && claimState.playerId) {
      const round3 = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);
      logDebug(() => (taskGetToken ? taskGetToken() : null), 'claim_calibration_tick', {
        accuracyM: round3(calTickDiag?.accuracyM ?? (fix ? fix.accuracy ?? 9999 : null)),
        speedKmh: round3(speedKmh),
        windowMs: round3(calTickDiag?.windowMs ?? null),
        stepsInWindow: calTickDiag?.stepsInWindow ?? null,
        gpsDistM: round3(calTickDiag?.gpsDistM ?? null),
        candidateStride: round3(calTickDiag?.candidateStride ?? null),
        qualifies: calTickDiag?.qualifies ?? null,
        rejectReason: calTickDiag?.rejectReason ?? null,
      }).catch(() => {});
    }

    lastSteps = currentSteps;

    let tickDistanceM = newDistance;
    let isComplete = false;

    if (claimState.mode === 'contest') {
      const deltaSteps = inVehicle ? 0 : stepDeltaTick;
      const deltaDistance = stepsToMetres(deltaSteps, currentStrideM);
      contestAggregator.steps += deltaSteps;
      contestAggregator.distanceM += deltaDistance;
      drainContestWindows();
      tickDistanceM = contestWalk.getCumulativeDistance() + contestAggregator.distanceM;
    } else {
      isComplete = !claimState.completed
        && newDistance >= claimState.perimeterM
        && claimState.perimeterM > 0;
    }

    setTick({
      distanceM: tickDistanceM,
      liveSteps: newSteps,
      livePace: newPace,
      strideM: currentStrideM,
      strideSessions: currentStrideSessions,
      lastAccuracyM: calTickDiag?.accuracyM ?? null,
      lastSpeedKmh: speedKmh,
      lastWindowMs: calTickDiag?.windowMs ?? null,
      lastStepsInWindow: calTickDiag?.stepsInWindow ?? null,
      lastQualifies: calTickDiag?.qualifies ?? null,
      lastRejectReason: calTickDiag?.rejectReason ?? null,
      bannerState: nextBanner,
      pauseElapsedMs,
      gpsFixReady: !!lastGpsFix,
      completed: isComplete,
    });
  } catch (err) {
    console.warn('[claim] task tick error:', err?.message);
  }
});

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

  // Claim-window countdown (claim mode only). One second tick — the GPS watch
  // already runs at 1s, so this adds no meaningful battery cost.
  const expiryMs = useMemo(() => {
    if (mode !== 'claim' || !intentExpiresAt) return null;
    const ms = new Date(intentExpiresAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [mode, intentExpiresAt]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (expiryMs == null) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiryMs]);
  const timeLeftMs = expiryMs == null ? null : Math.max(0, expiryMs - nowMs);
  const timeLeftCritical = timeLeftMs != null && timeLeftMs <= TIME_LEFT_ESCALATE_MS;

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
      if (!navigatingRef.current) endClaim();
    };
  }, [mode]);

  // ─── Mount: load stride, init HC, fetch contest metadata ────────────────
  useEffect(() => {
    let cancelled = false;

    baselineSteps = null;
    lastSteps = 0;
    lastStepTimestamp = Date.now();
    vehicleExcludedSteps = 0;
    halfwayFired = false;
    finalStretchFired = false;
    calibrationWindowStart = null;
    calibrationSamples = [];
    bannerStateModule = null;
    lastGpsFix = null;
    currentSpeedKmh = 0;
    vehicleFilter = { hits: 0, inVehicle: false };
    lastSpeedSampleAt = 0;
    gpsWeak = false;
    if (halfwayResetTimer) {
      clearTimeout(halfwayResetTimer);
      halfwayResetTimer = null;
    }
    if (mode === 'contest') {
      contestAggregator = { startMs: Date.now(), steps: 0, distanceM: 0 };
    }

    startClaim({ territoryId, playerId, perimeterM, mode, territoryName });

    (async () => {
      const { strideM: loadedStride, sessions, samples } = await loadPlayerStride(() => getTokenRef.current());
      if (cancelled) return;
      currentStrideM = loadedStride;
      currentStrideSessions = sessions;
      calibrationSamples = samples;
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
          lastSteps = steps;
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
    };
  }, [playerId, mode, territoryId, perimeterM, territoryName, role]);

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

        latestTaskFix = null;
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
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
      latestTaskFix = null;
    };
  }, []);

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
  const hcDenied = claimState.hcPermission === 'denied';

  const cancelConfirmBody = mode === 'contest'
    ? t('activeClaim.cancelConfirmContest')
    : (freeClaim || !goldPaid
        ? t('activeClaim.cancelConfirmFree')
        : t('activeClaim.cancelConfirmPaid', { gold: goldPaid }));

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
      </View>

      {timeLeftMs != null && (
        <View style={styles.timeLeftBlock}>
          <Text style={styles.timeLeftLabel}>{t('activeClaim.statTimeLeft')}</Text>
          <Text
            style={[
              styles.timeLeftValue,
              // One caution element per screen: the readout yields amber to any
              // caution banner currently showing.
              timeLeftCritical && !['paused', 'vehicle', 'reset'].includes(claimState.bannerState)
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
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'vehicle' && (
          <Banner color={AMBER} label={t('activeClaim.bannerVehicle')} />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'paused' && (
          <Banner color={AMBER} label={t('activeClaim.bannerPaused', { countdown: formatPauseCountdown(claimState.pauseElapsedMs) })} />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'reset' && (
          <Banner color={AMBER} label={t('activeClaim.bannerReset')} />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'gpsWeak' && (
          <Banner color={SLATE2} label={t('activeClaim.bannerGpsWeak')} />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'halfway' && (
          <Banner color={BONE} label={t('activeClaim.bannerHalfway')} />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'finalStretch' && (
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

  firstWalkHint: { fontFamily: 'Inter_400Regular', color: SLATE2, fontSize: 12, textAlign: 'center', marginTop: 14, paddingHorizontal: 24 },
  bannerZone: { marginTop: 12, minHeight: 36 },
  banner: { borderWidth: 1, borderRadius: 0, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'transparent' },
  bannerText: { fontFamily: 'GeistMono_500Medium', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },

  devBtn: { marginBottom: 8, backgroundColor: CLAIM, borderRadius: 0, paddingVertical: 12, alignItems: 'center' },
  devBtnText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  cancelBtn: { backgroundColor: INK2, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  cancelConfirmBlock: { gap: 10 },
  cancelConfirmText: { fontFamily: 'Inter_400Regular', color: BONE, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 12 },
  keepWalkingBtn: { backgroundColor: INK2, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  keepWalkingText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  // Health-Connect blocking state — the walk cannot count; say so and route out.
  hcBlocked: { marginTop: 32, backgroundColor: INK2, borderWidth: 1, borderColor: HAIRLINE_STRONG, borderRadius: 0, padding: 16, gap: 12 },
  hcBlockedTitle: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  hcBlockedBody: { fontFamily: 'Inter_400Regular', color: BONE, fontSize: 13, lineHeight: 19 },
  hcBlockedBtn: { backgroundColor: INK, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  hcBlockedBtnText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
});
