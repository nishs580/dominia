import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
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
// Task callback runs outside React. It writes the latest fix to a module-level
// holder; the screen reads it on every poll tick.
const LOCATION_TASK_NAME = 'dominia-active-claim-location';

let latestTaskFix = null;

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.warn('[claim] location task error:', error?.message);
    return;
  }
  const loc = data?.locations?.[data.locations.length - 1];
  if (!loc?.coords) return;
  const { latitude, longitude, accuracy } = loc.coords;
  const ts = loc.timestamp ?? Date.now();
  if (latitude == null || longitude == null) return;
  latestTaskFix = { latitude, longitude, accuracy: accuracy ?? 9999, timestamp: ts };
});

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

export default function ActiveClaimScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { territoryName = 'Territory', perimeterDistance = 0, territoryId, playerId, mode = 'claim' } = route?.params ?? {};
  const perimeterM = Math.max(0, Number(perimeterDistance) || 0);

  // UI state
  const [distanceWalkedM, setDistanceWalkedM] = useState(0);
  const [liveSteps, setLiveSteps] = useState(0);
  const [livePace, setLivePace] = useState(0);
  const [strideM, setStrideM] = useState(0.75);
  const [strideSessions, setStrideSessions] = useState(0);
  const [hcPermission, setHcPermission] = useState('unknown'); // 'granted' | 'denied' | 'unknown'
  const [bannerState, setBannerState] = useState(null); // 'vehicle' | 'paused' | 'reset' | 'gpsWeak' | 'halfway' | null
  const [pauseElapsedMs, setPauseElapsedMs] = useState(0);

  const progress = useRef(new Animated.Value(0)).current;
  const navigatingRef = useRef(false);

  // Step tracking refs
  const baselineStepsRef = useRef(null);            // steps at claim start
  const lastStepsRef = useRef(0);                   // last polled total
  const lastStepTimestampRef = useRef(Date.now()); // when steps last changed
  const claimStartMsRef = useRef(Date.now());
  const vehicleExcludedStepsRef = useRef(0);
  const halfwayFiredRef = useRef(false);
  const samplesRef = useRef([]);

  // Calibration window tracking
  const calibrationWindowStartRef = useRef(null); // { steps, timestamp, lat, lon }

  // GPS refs
  const locationWatchRef = useRef(null);
  const lastGpsFixRef = useRef(null); // { latitude, longitude, accuracy, timestamp }
  const currentSpeedKmhRef = useRef(0);
  const gpsWeakRef = useRef(false);

  // Polling
  const pollIntervalRef = useRef(null);

  // Contest-only metadata
  const opponentNameRef = useRef('opponent');
  const attackerAllianceRef = useRef(null);

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false, tabBarStyle: { display: 'none' } });
  }, [navigation]);

  // ─── Mount: load stride, init HC, fetch contest metadata ────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Load player stride from DB
      const { strideM: loadedStride, sessions, samples } = await loadPlayerStride(playerId);
      if (cancelled) return;
      setStrideM(loadedStride);
      setStrideSessions(sessions);
      samplesRef.current = samples;

      // 2. Init Health Connect
      try {
        const status = await getSdkStatus();
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
          setHcPermission('denied');
          return;
        }
        await initialize();
        const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
        const hasSteps = granted?.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
        if (cancelled) return;
        setHcPermission(hasSteps ? 'granted' : 'denied');

        if (hasSteps) {
          const steps = await readTodaySteps();
          if (cancelled) return;
          baselineStepsRef.current = steps;
          lastStepsRef.current = steps;
          lastStepTimestampRef.current = Date.now();
          claimStartMsRef.current = Date.now();
        }
      } catch (err) {
        console.warn('[claim] HC init failed:', err?.message);
        if (!cancelled) setHcPermission('denied');
      }
    })();

    // Contest metadata fetch (preserved from original)
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
  }, [playerId, mode, territoryId]);

  // ─── GPS watch via foreground service ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let started = false;

    (async () => {
      try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted' || cancelled) return;

        // Background permission is also needed for the foreground service to
        // continue receiving updates while the app is backgrounded.
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

  // ─── HC step poll + claim progress ──────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      if (hcPermission !== 'granted') return undefined;

      const tick = async () => {
        try {
          // Bridge: copy the latest task-scope GPS fix into the component refs.
          // The foreground-service task writes to `latestTaskFix` outside React;
          // we sync into the refs here so the vehicle filter + calibration logic
          // (which were written for component-scope refs) work unchanged.
          if (latestTaskFix) {
            const taskFix = latestTaskFix;
            // Skip stale fixes
            if (Date.now() - taskFix.timestamp <= STALE_GPS_THRESHOLD_MS) {
              const prev = lastGpsFixRef.current;
              if (prev && prev.timestamp !== taskFix.timestamp) {
                currentSpeedKmhRef.current = computeSpeedKmh(prev, taskFix);
              }
              lastGpsFixRef.current = taskFix;
              gpsWeakRef.current = (taskFix.accuracy ?? 9999) > 20;
            }
          }
          const currentSteps = await readTodaySteps();
          if (baselineStepsRef.current == null) {
            baselineStepsRef.current = currentSteps;
            lastStepsRef.current = currentSteps;
            return;
          }

          const stepDeltaTick = Math.max(0, currentSteps - lastStepsRef.current);
          const now = Date.now();
          const speedKmh = currentSpeedKmhRef.current;
          const inVehicle = isVehicleSpeed(speedKmh);

          // Vehicle filter — exclude this tick's steps if speed > 25 km/h
          if (inVehicle) {
            vehicleExcludedStepsRef.current += stepDeltaTick;
          }

          // Track when steps last changed (for pause detection)
          if (stepDeltaTick > 0) {
            lastStepTimestampRef.current = now;
          }

          const totalSteps = currentSteps - baselineStepsRef.current;
          const usableSteps = Math.max(0, totalSteps - vehicleExcludedStepsRef.current);
          const walkedM = stepsToMetres(usableSteps, strideM);

          // Pause logic
          const zeroMovementMs = now - lastStepTimestampRef.current;
          setPauseElapsedMs(zeroMovementMs);

          if (zeroMovementMs >= PAUSE_RESET_MS) {
            // Reset claim progress
            baselineStepsRef.current = currentSteps;
            vehicleExcludedStepsRef.current = 0;
            halfwayFiredRef.current = false;
            lastStepTimestampRef.current = now;
            claimStartMsRef.current = now;
            setDistanceWalkedM(0);
            setLiveSteps(0);
            progress.setValue(0);
            setBannerState('reset');
          } else if (zeroMovementMs >= ZERO_MOVEMENT_WARN_MS) {
            setBannerState('paused');
          } else if (inVehicle) {
            setBannerState('vehicle');
          } else if (gpsWeakRef.current && !lastGpsFixRef.current) {
            setBannerState('gpsWeak');
          } else if (walkedM / perimeterM >= 0.5 && !halfwayFiredRef.current) {
            halfwayFiredRef.current = true;
            setBannerState('halfway');
            setTimeout(() => setBannerState(null), 4000);
          } else if (bannerState !== 'halfway') {
            setBannerState(null);
          }

          // Update UI
          setLiveSteps(usableSteps);
          setDistanceWalkedM(walkedM);
          setLivePace(paceSpm(stepDeltaTick, POLL_INTERVAL_MS));

          const nextPct = perimeterM > 0 ? clamp(walkedM / perimeterM, 0, 1) : 0;
          Animated.timing(progress, {
            toValue: nextPct,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();

          // ─── Calibration window ─────────────────────────────────────────
          let calTickDiag = null;
          const fix = lastGpsFixRef.current;
          if (fix && !inVehicle && (fix.accuracy ?? 9999) <= 20) {
            const winStart = calibrationWindowStartRef.current;
            if (!winStart) {
              calibrationWindowStartRef.current = {
                steps: currentSteps,
                timestamp: now,
                lat: fix.latitude,
                lon: fix.longitude,
              };
            } else {
              const windowMs = now - winStart.timestamp;
              const stepsInWindow = currentSteps - winStart.steps;
              const gpsDist = haversineMetres(winStart.lat, winStart.lon, fix.latitude, fix.longitude);
              const accuracyM = fix.accuracy ?? 9999;
              const { qualifies, rejectReason } = isQualifyingCalibrationWindow({
                accuracyM,
                speedKmh,
                windowMs,
              });
              const candidateStride = stepsInWindow > 0 ? gpsDist / stepsInWindow : null;
              calTickDiag = {
                accuracyM,
                speedKmh,
                windowMs,
                stepsInWindow,
                gpsDistM: gpsDist,
                candidateStride,
                qualifies,
                rejectReason,
              };
              if (windowMs >= 30000) {
                if (qualifies && stepsInWindow > 0 && gpsDist > 0) {
                  const result = await pushCalibrationSample(
                    playerId,
                    gpsDist,
                    stepsInWindow,
                    samplesRef.current,
                  );
                  if (result) {
                    samplesRef.current = result.samples;
                    setStrideM(result.strideM);
                    setStrideSessions(result.sessions);
                  }
                }
                // Reset window regardless of qualification
                calibrationWindowStartRef.current = {
                  steps: currentSteps,
                  timestamp: now,
                  lat: fix.latitude,
                  lon: fix.longitude,
                };
              }
            }
          } else {
            // Invalid conditions — reset window
            calibrationWindowStartRef.current = null;
          }

          if (DIAG_CALIBRATION && playerId) {
            const round3 = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);
            logDebug(playerId, 'claim_calibration_tick', {
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

          lastStepsRef.current = currentSteps;

          // ─── Claim complete? ────────────────────────────────────────────
          if (walkedM >= perimeterM && !navigatingRef.current) {
            navigatingRef.current = true;
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            locationWatchRef.current?.remove?.();
            locationWatchRef.current = null;
            setTimeout(() => {
              completeClaim(walkedM, usableSteps);
            }, 600);
          }
        } catch (err) {
          console.warn('[claim] poll tick error:', err?.message);
        }
      };

      tick();
      pollIntervalRef.current = setInterval(tick, POLL_INTERVAL_MS);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      };
    }, [hcPermission, strideM, perimeterM, playerId, bannerState]),
  );

  // ─── Completion handler ────────────────────────────────────────────────
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
      });
    }
  }

  function handleManualComplete() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    locationWatchRef.current?.remove?.();
    locationWatchRef.current = null;
    completeClaim(perimeterM, liveSteps);
  }

  // ─── Ring geometry ─────────────────────────────────────────────────────
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

  const pct = perimeterM > 0 ? Math.round(clamp((distanceWalkedM / perimeterM) * 100, 0, 100)) : 0;
  const isCalibrated = strideSessions >= 3;

  // ─── Render ────────────────────────────────────────────────────────────
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
            <Text style={styles.metresText}>{`${formatMetres(distanceWalkedM)} / ${formatMetres(perimeterM)} m`}</Text>
          </View>
        </View>
      </View>

      {/* Stats panel */}
      <View style={styles.statsPanel}>
        <StatRow label="STEPS WALKED" value={String(liveSteps)} />
        <StatRow label="DISTANCE" value={`${formatMetres(distanceWalkedM)} m`} />
        <StatRow label={isCalibrated ? 'STRIDE (CAL)' : 'STRIDE (DEFAULT)'} value={`${strideM.toFixed(2)} m`} />
        <StatRow label="PACE" value={`${livePace} spm`} last />
      </View>

      {/* Banner zone */}
      <View style={styles.bannerZone}>
        {hcPermission === 'denied' && (
          <Banner color={CLAIM} label="HEALTH CONNECT NOT GRANTED · Steps cannot be read" />
        )}
        {hcPermission === 'granted' && bannerState === 'vehicle' && (
          <Banner color={CLAIM} label="VEHICLE DETECTED · Steps paused" />
        )}
        {hcPermission === 'granted' && bannerState === 'paused' && (
          <Banner color={AMBER} label={`PAUSED · ${formatPauseCountdown(pauseElapsedMs)} until reset`} />
        )}
        {hcPermission === 'granted' && bannerState === 'reset' && (
          <Banner color={CLAIM} label="PROGRESS RESET · Walk to resume" />
        )}
        {hcPermission === 'granted' && bannerState === 'gpsWeak' && (
          <Banner color={SLATE2} label="GPS WEAK · Vehicle filter on hold" />
        )}
        {hcPermission === 'granted' && bannerState === 'halfway' && (
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
