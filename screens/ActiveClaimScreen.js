import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  getSdkStatus,
  SdkAvailabilityStatus,
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { supabase } from '../lib/supabase';
import { logDebug } from '../lib/debug';
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
  computeSpeedKmh,
  isVehicleSpeed,
  isQualifyingCalibrationWindow,
  pushCalibrationSample,
  haversineMetres,
  paceSpm,
} from '../lib/claim';

// ─── Foreground-service location task (module scope) ────────────────────
const LOCATION_TASK_NAME = 'dominia-active-claim-location';

let latestTaskFix = null;

// Calibration / step state (module scope — survives screen blur)
let baselineSteps = null;
let lastSteps = 0;
let lastStepTimestamp = Date.now();
let claimStartMs = Date.now();
let vehicleExcludedSteps = 0;
let halfwayFired = false;
let calibrationWindowStart = null;   // { steps, timestamp, lat, lon }
let calibrationSamples = [];
let currentStrideM = 0.75;
let currentStrideSessions = 0;
let lastGpsFix = null;
let currentSpeedKmh = 0;
let gpsWeak = false;
let bannerStateModule = null;
let halfwayResetTimer = null;

// Set to true to drop a COMPLETE NOW button at the bottom for UI iteration without walking.
const DEV_MODE_MANUAL = false;
const DIAG_CALIBRATION = true;

const POLL_INTERVAL_MS = 10000;          // HC step poll cadence — matches ActivityScreen
const STALE_GPS_THRESHOLD_MS = 5000;     // skip GPS points older than this
const ZERO_MOVEMENT_WARN_MS = 30 * 1000; // 30s zero movement → show "PAUSED" banner
const PAUSE_RESET_MS = 15 * 60 * 1000;   // 15 min zero movement → reset progress to zero

const INK = '#0E1014';
const INK2 = '#1A1D24';
const INK3 = '#252932';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';
const ALLIANCE = '#3F8F4E';
const AMBER = '#D49A2B';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

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

  if (lastGpsFix && lastGpsFix.timestamp !== taskFix.timestamp &&
      (Date.now() - taskFix.timestamp) <= STALE_GPS_THRESHOLD_MS) {
    currentSpeedKmh = computeSpeedKmh(lastGpsFix, taskFix);
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
    const speedKmh = currentSpeedKmh;
    const inVehicle = isVehicleSpeed(speedKmh);

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
      lastStepTimestamp = now;
      claimStartMs = now;
      didReset = true;
      nextBanner = 'reset';
    } else if (zeroMovementMs >= ZERO_MOVEMENT_WARN_MS) {
      nextBanner = 'paused';
    } else if (inVehicle) {
      nextBanner = 'vehicle';
    } else if (gpsWeak && !lastGpsFix) {
      nextBanner = 'gpsWeak';
    } else if (claimState.perimeterM > 0 && walkedM / claimState.perimeterM >= 0.5 && !halfwayFired) {
      halfwayFired = true;
      nextBanner = 'halfway';
      if (halfwayResetTimer) clearTimeout(halfwayResetTimer);
      halfwayResetTimer = setTimeout(() => {
        bannerStateModule = null;
        setTick({ bannerState: null });
      }, 4000);
    } else if (bannerStateModule !== 'halfway') {
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
            const result = await pushCalibrationSample(claimState.playerId, gpsDist, stepsInWindow, calibrationSamples);
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
      logDebug(claimState.playerId, 'claim_calibration_tick', {
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

    const isComplete = !claimState.completed && newDistance >= claimState.perimeterM && claimState.perimeterM > 0;

    setTick({
      distanceM: newDistance,
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

  const { territoryName = 'Territory', perimeterDistance = 0, territoryId, playerId, mode = 'claim', goldPaid, freeClaim } = route?.params ?? {};
  const perimeterM = Math.max(0, Number(perimeterDistance) || 0);

  const progress = useRef(new Animated.Value(0)).current;
  const navigatingRef = useRef(false);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  const opponentNameRef = useRef('opponent');
  const attackerAllianceRef = useRef(null);

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
    if (claimState.completed && !navigatingRef.current) {
      navigatingRef.current = true;
      setTimeout(() => completeClaim(claimState.distanceM, claimState.liveSteps), 600);
    }
  });

  useEffect(() => {
    const nextPct = claimState.perimeterM > 0
      ? clamp(claimState.distanceM / claimState.perimeterM, 0, 1)
      : 0;
    Animated.timing(progress, {
      toValue: nextPct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  });

  useEffect(() => {
    return () => {
      if (!navigatingRef.current) endClaim();
    };
  }, []);

  // ─── Mount: load stride, init HC, fetch contest metadata ────────────────
  useEffect(() => {
    let cancelled = false;

    baselineSteps = null;
    lastSteps = 0;
    lastStepTimestamp = Date.now();
    claimStartMs = Date.now();
    vehicleExcludedSteps = 0;
    halfwayFired = false;
    calibrationWindowStart = null;
    calibrationSamples = [];
    bannerStateModule = null;
    lastGpsFix = null;
    currentSpeedKmh = 0;
    gpsWeak = false;
    if (halfwayResetTimer) {
      clearTimeout(halfwayResetTimer);
      halfwayResetTimer = null;
    }

    startClaim({ territoryId, playerId, perimeterM, mode, territoryName });

    (async () => {
      const { strideM: loadedStride, sessions, samples } = await loadPlayerStride(playerId);
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
          claimStartMs = Date.now();
        }
      } catch (err) {
        console.warn('[claim] HC init failed:', err?.message);
        if (!cancelled) setTick({ hcPermission: 'denied' });
      }
    })();

    if (mode === 'contest' && territoryId && playerId) {
      supabase
        .from('territories')
        .select('players(username)')
        .eq('id', territoryId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.players?.username) opponentNameRef.current = data.players.username;
        });
      supabase
        .from('players')
        .select('alliance_id')
        .eq('id', playerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.alliance_id) attackerAllianceRef.current = data.alliance_id;
        });
    }

    return () => {
      cancelled = true;
    };
  }, [playerId, mode, territoryId, perimeterM, territoryName]);

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
            notificationTitle: 'Dominia · Active Claim',
            notificationBody: 'Tracking your walk',
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
    if (mode === 'contest') {
      navigation.navigate('ContestResultScreen', {
        contestState: 'attack_won',
        territoryName,
        territoryId,
        playerId,
        myDistance: Math.round(walkedM),
        opponentDistance: 0,
        opponentName: opponentNameRef.current,
        attackerAlliance: attackerAllianceRef.current,
      });
    } else {
      navigation.navigate('ClaimSuccessScreen', {
        territoryName,
        perimeterDistance: perimeterM,
        territoryId,
        playerId,
        goldPaid,
        freeClaim,
      });
    }
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

  const pct = perimeterM > 0 ? Math.round(clamp((claimState.distanceM / perimeterM) * 100, 0, 100)) : 0;
  const isCalibrated = claimState.strideSessions >= 3;

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.claimingLabel, { marginTop: 32 }]}>{mode === 'contest' ? 'CONTESTING' : 'CLAIMING'}</Text>
          <Text style={styles.territoryName}>{territoryName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>In Progress</Text>
        </View>
      </View>

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
            <Text style={styles.pctText}>{pct}%</Text>
            <Text style={styles.metresText}>{`${formatMetres(claimState.distanceM)} / ${formatMetres(perimeterM)} m`}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsPanel}>
        <StatRow label="STEPS WALKED" value={String(claimState.liveSteps)} />
        <StatRow label="DISTANCE" value={`${formatMetres(claimState.distanceM)} m`} />
        <StatRow label={isCalibrated ? 'STRIDE (CAL)' : 'STRIDE (DEFAULT)'} value={`${claimState.strideM.toFixed(2)} m`} />
        <StatRow label="PACE" value={`${claimState.livePace} spm`} last />
      </View>

      <View style={styles.bannerZone}>
        {claimState.hcPermission === 'denied' && (
          <Banner color={CLAIM} label="HEALTH CONNECT NOT GRANTED · Steps cannot be read" />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'vehicle' && (
          <Banner color={CLAIM} label="VEHICLE DETECTED · Steps paused" />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'paused' && (
          <Banner color={AMBER} label={`PAUSED · ${formatPauseCountdown(claimState.pauseElapsedMs)} until reset`} />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'reset' && (
          <Banner color={CLAIM} label="PROGRESS RESET · Walk to resume" />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'gpsWeak' && (
          <Banner color={SLATE2} label="GPS WEAK · Vehicle filter on hold" />
        )}
        {claimState.hcPermission === 'granted' && claimState.bannerState === 'halfway' && (
          <Banner color={BONE} label="50% — KEEP GOING" />
        )}
      </View>

      <View style={{ flex: 1 }} />

      {DEV_MODE_MANUAL && (
        <Pressable onPress={handleManualComplete} style={styles.devBtn}>
          <Text style={styles.devBtnText}>COMPLETE NOW (DEV)</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel claim"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.cancelText}>Cancel claim</Text>
      </Pressable>
    </View>
  );
}

function StatRow({ label, value, last }) {
  return (
    <View style={[styles.statRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
  screen: { flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  claimingLabel: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 },
  territoryName: { fontFamily: 'Archivo_900Black', color: BONE, fontSize: 24, letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 28 },
  badge: { marginTop: 4, backgroundColor: CLAIM_SOFT, borderColor: HAIRLINE_STRONG, borderWidth: 1, borderRadius: 0, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: 'GeistMono_500Medium', color: CLAIM, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  ringWrap: { marginTop: 24, alignItems: 'center', justifyContent: 'center' },
  ringStack: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pctText: { fontFamily: 'Archivo_700Bold', color: BONE, fontSize: 48, letterSpacing: -1 },
  metresText: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 11, letterSpacing: 0.8, marginTop: 4 },

  statsPanel: { marginTop: 24, backgroundColor: INK2, borderWidth: 1, borderColor: HAIRLINE_STRONG, borderRadius: 0 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE_STRONG },
  statLabel: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  statValue: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 14, letterSpacing: 0.2 },

  bannerZone: { marginTop: 12, minHeight: 36 },
  banner: { borderWidth: 1, borderRadius: 0, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'transparent' },
  bannerText: { fontFamily: 'GeistMono_500Medium', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },

  devBtn: { marginBottom: 8, backgroundColor: CLAIM, borderRadius: 0, paddingVertical: 12, alignItems: 'center' },
  devBtnText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  cancelBtn: { backgroundColor: INK2, borderRadius: 0, borderWidth: 1, borderColor: HAIRLINE_STRONG, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'GeistMono_400Regular', color: SLATE2, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
});
