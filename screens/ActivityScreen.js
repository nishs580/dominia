import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import {
  initialize,
  getGrantedPermissions,
  requestPermission,
  openHealthConnectSettings,
  aggregateRecord,
  aggregateGroupByPeriod,
} from 'react-native-health-connect';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { completeChallenge as backendCompleteChallenge } from '../lib/challengeApi';
import { fetchChallengesToday } from '../lib/challengesTodayApi';
import {
  AXES,
  AXIS_CATALOG,
  TIERS,
  XP_PER_TIER,
  THEME_BOOST_MULT,
  themeAxisForDate,
  boostedAxesForTheme,
  defaultAxisForTheme,
} from '../lib/challengeAxes';
import { fetchActivityBests } from '../lib/activityBestsApi';
import { loadPlayerStride } from '../lib/claim';
import { showCard } from '../lib/notifications/cardController';
import { calcLevel, getLevelTitle, calcResourceEarn } from '../lib/formulas';
import {
  ACTIVITY_READ_PERMS,
  hasForegroundStepsRead,
  hasForegroundActiveCaloriesRead,
  hasForegroundDistanceRead,
} from '../lib/healthConnect';
import * as activityProducer from '../lib/activity';

function levelFromXp(xp) {
  const xpInt = Math.max(0, Math.floor(Number(xp) || 0));
  const level = calcLevel(xpInt);
  return { level, title: getLevelTitle(level) };
}
import { colors, fonts, spacing } from '../lib/theme';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import { maybeExplainResources } from '../lib/resourceIntro';
import { registerDemoRect } from '../lib/demoRegistry';

const DEV_MODE_MANUAL = false; // set true to show COMPLETE buttons for manual testing

// A challenge auto-complete can 403 (backend's accepted aggregate under the
// tier threshold) even when the on-device live metric is already over target:
// the live foreground counter runs ahead of the Health Connect data that gets
// flushed and aggregated server-side, and HC can take minutes to finalize
// recent steps/distance. So a 403 is usually transient — retry on a cooldown
// while the metric stays over target, letting the server catch up, rather than
// blocking the tier for the rest of the day. Bounded so an axis that never
// catches up (e.g. a stride over-estimate) doesn't retry forever.
const CHALLENGE_403_COOLDOWN_MS = 60_000;
const CHALLENGE_403_MAX_ATTEMPTS = 8;

// Per-day conscious axis choice (memory: daily-challenge-redesign). The
// server locks the axis on first completion; before that, this records the
// player's explicit "Train X today" commitment so auto-complete watches the
// chosen axis instead of the theme default.
const AXIS_CHOICE_STORAGE_KEY = 'dominia.challengeAxisChoice.v1';

function fmtAxisProgress(axis, current, target) {
  if (axis === 'distance') {
    return `${((Number(current) || 0) / 1000).toFixed(1)} / ${(target / 1000).toFixed(1)} km`;
  }
  if (axis === 'tempo') {
    return `T${Math.min(Number(current) || 0, target)} / T${target}`;
  }
  return `${Math.min(Number(current) || 0, target).toLocaleString()} / ${target.toLocaleString()}`;
}

// Locale-aware date header, e.g. "Monday, June 30". Uses Intl with the active
// i18next language so non-English locales get native day/month names.
function formatToday(d, lng) {
  return d.toLocaleDateString(lng || 'en', { weekday: 'long', month: 'long', day: 'numeric' });
}

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtKm(meters) {
  return `${((Number(meters) || 0) / 1000).toFixed(1)} km`;
}

function fmtMin(minutes) {
  return `${Math.max(0, Math.round(Number(minutes) || 0))} min`;
}

function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildSmoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const tension = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function ProgressBar({ progress }) {
  const pct = clamp(progress, 0, 1) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function WeeklyBarChart({ data }) {
  const { t } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [chartWidth, setChartWidth] = useState(0);
  const max = Math.max(...data.map((d) => d.steps), 1);
  const highlightIndex = data.length - 1;
  const BAR_TRACK_HEIGHT = 88;
  const MAX_BAR_HEIGHT = 80;

  // Compute centre-x of each bar based on measured chart width
  const trendPoints =
    chartWidth > 0
      ? data.map((d, idx) => {
          const colWidth = chartWidth / data.length;
          const x = colWidth * idx + colWidth / 2;
          const barH = clamp(d.steps / max, 0, 1) * MAX_BAR_HEIGHT;
          const y = BAR_TRACK_HEIGHT - barH;
          return { x, y };
        })
      : [];
  const pathD = buildSmoothPath(trendPoints);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartLabelSlot}>
        {selectedIdx !== null ? (
          <Text style={styles.chartLabelText}>
            {t('activity.chartLabel', { day: data[selectedIdx].day, steps: data[selectedIdx].steps.toLocaleString() })}
          </Text>
        ) : (
          <Text style={styles.chartLabelText}> </Text>
        )}
      </View>
      <View
        style={styles.chartCanvas}
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.chartRow}>
          {data.map((d, idx) => {
            const isToday = idx === highlightIndex;
            const isSelected = idx === selectedIdx;
            const h = clamp(d.steps / max, 0, 1) * MAX_BAR_HEIGHT;
            return (
              <Pressable
                key={`${d.day}-${idx}`}
                style={styles.chartCol}
                onPress={() => setSelectedIdx(isSelected ? null : idx)}
              >
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: h,
                        backgroundColor: isToday
                          ? colors.bone
                          : isSelected
                          ? 'rgba(242,238,230,0.45)'
                          : 'rgba(242,238,230,0.16)',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartDay, (isToday || isSelected) && styles.chartDayToday]}>
                  {d.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {chartWidth > 0 ? (
          <Svg
            width={chartWidth}
            height={BAR_TRACK_HEIGHT}
            style={styles.chartTrendOverlay}
            pointerEvents="none"
          >
            <Path d={pathD} stroke={colors.claim} strokeWidth={2} fill="none" />
            {trendPoints.map((p, idx) => (
              <Circle
                key={`pt-${idx}`}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill={colors.claim}
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const { t, i18n } = useTranslation();
  const weekDayLabels = useMemo(() => t('activity.weekDays', { returnObjects: true }), [t]);
  const { userId, getToken } = useAuth();

  // First-tap tips. A tip fires when the player's finger first lands on the
  // section (a missing section — e.g. perm card already granted — has a null
  // ref and simply never matches).
  const walkthroughHeaderRef = useRef(null);
  const walkthroughPermRef = useRef(null);
  const walkthroughChallengesRef = useRef(null);
  const walkthroughAchievementsRef = useRef(null);
  const activityTips = useMemo(
    () => [
      { key: 'streak', text: t('walkthrough.activity.streak'), getRect: () => rectFromRef(walkthroughHeaderRef) },
      { key: 'health', text: t('walkthrough.activity.health'), getRect: () => rectFromRef(walkthroughPermRef) },
      { key: 'challenges', text: t('walkthrough.activity.challenges'), getRect: () => rectFromRef(walkthroughChallengesRef) },
      { key: 'achievements', text: t('walkthrough.activity.achievements'), getRect: () => rectFromRef(walkthroughAchievementsRef) },
    ],
    [t],
  );
  const tips = useFirstTapTips({ screenKey: 'activity', userId, tips: activityTips });

  // Guided-demo targets (read beats 6 and 7 of the first-run tour).
  useEffect(() => registerDemoRect('activity.streak', () => rectFromRef(walkthroughHeaderRef)), []);
  useEffect(() => registerDemoRect('activity.challenges', () => rectFromRef(walkthroughChallengesRef)), []);

  const [playerId, setPlayerId] = useState(null);
  const [playerXp, setPlayerXp] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [username, setUsername] = useState('');
  const [territoryCount, setTerritoryCount] = useState(0);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [isCompleting, setIsCompleting] = useState(() => new Set());
  const [playerLevel, setPlayerLevel] = useState(() => levelFromXp(0));
  const [hcReady, setHcReady] = useState(false);
  const [hasStepsPerm, setHasStepsPerm] = useState(false);
  // Optional axis permissions — steps-only players still get March.
  const [hasKcalPerm, setHasKcalPerm] = useState(false);
  const [hasDistPerm, setHasDistPerm] = useState(false);
  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [permRequesting, setPermRequesting] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  // Live measured distance (HC Distance aggregate) — the same metric the backend
  // gates distance challenges on. Kept separate from the steps×stride estimate,
  // which is now only a fallback for players without the Distance permission.
  const [liveDistanceM, setLiveDistanceM] = useState(0);
  const [strideM, setStrideM] = useState(0.75);
  // 4-axis daily menu — server-authoritative state from /me/challenges/today.
  const [todayMenu, setTodayMenu] = useState(null);
  // Conscious per-day axis choice (persisted). null = no choice yet.
  const [committedAxis, setCommittedAxis] = useState(null);
  // Which axis's ladder the card is currently showing (browsing is free).
  const [viewAxis, setViewAxis] = useState(null);
  // Daily Achievements: today's totals + all-time best single-day totals,
  // aggregated server-side from accepted activity_samples. Distance today is
  // shown live from measured HC distance (axisCurrent); the best column and
  // active-minutes come from here.
  const [bests, setBests] = useState({
    today: { distance_m: 0, active_minutes: 0 },
    best: { distance_m: 0, active_minutes: 0 },
  });
  const [weeklySteps, setWeeklySteps] = useState(() =>
    weekDayLabels.map((d) => ({ day: d, steps: 0 })),
  );
  const pollRef = useRef(null);
  const inFlightTiersRef = useRef(new Set());
  // Clerk's getToken identity churns with session state (notably while a
  // token refresh is failing/retrying). Route all fetch callbacks through a
  // ref so their identity stays stable and effects don't re-fire per churn —
  // otherwise a failing refresh floods the backend with doomed 401 calls.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  // Challenges the backend rejected this session with a 403 (accepted aggregate
  // still under the tier threshold). Maps ch.key -> { at, attempts }: `at` is
  // the last-rejection time (cooldown anchor) and `attempts` caps total retries.
  // A 403 is treated as transient (see CHALLENGE_403_* above) — the tier is
  // retried after each cooldown while its live metric stays over target, so a
  // completion that's only blocked by HC/flush lag lands once the server catches
  // up, instead of being stuck for the rest of the day.
  const blockedKeysRef = useRef(new Map());
  // Bumped by a timer while any tier is in 403 cooldown, so the auto-complete
  // effect re-evaluates even when liveSteps is flat (player idle, waiting for
  // the server aggregate to catch up).
  const [retryTick, setRetryTick] = useState(0);

  const today = useMemo(() => new Date(), []);
  // Device-local day key — used only for the per-day axis-choice storage.
  const todayStr = useMemo(() => localDayKey(new Date()), []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayerActivity() {
      if (!userId) {
        setPlayerId(null);
        setPlayerXp(0);
        setCurrentStreak(0);
        setTerritoryCount(0);
        setCompletedKeys(new Set());
        setChallengesLoaded(false);
        return;
      }

      const { data: player } = await supabase
        .from('players')
        .select('id, xp, current_streak, username')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (!player?.id) {
        setPlayerId(null);
        setPlayerXp(0);
        setCurrentStreak(0);
        setTerritoryCount(0);
        setCompletedKeys(new Set());
        setChallengesLoaded(false);
        return;
      }

      setPlayerId(player.id);
      const xp = Math.max(0, Number(player.xp) || 0);
      setPlayerXp(xp);
      setPlayerLevel(levelFromXp(xp));
      setCurrentStreak(Math.max(0, Number(player.current_streak) || 0));
      setUsername(player.username ?? '');

      const terrResult = await supabase
        .from('territories')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', player.id);
      if (cancelled) return;
      setTerritoryCount(terrResult.count ?? 0);
    }

    loadPlayerActivity();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Server-authoritative daily menu: theme, locked axis, Iron Guard slot,
  // completions and gating aggregates. Replaces the former direct Supabase
  // player_challenges read (RLS migration path).
  const loadTodayMenu = useCallback(async () => {
    const result = await fetchChallengesToday({
      clerkGetToken: () => getTokenRef.current(),
    });
    if (!result.ok) {
      console.log('[activity] challenges/today failed', result.status, result.error);
      return;
    }
    setTodayMenu(result.data);
    setCompletedKeys(new Set((result.data.completed ?? []).map((c) => c.challenge_key)));
    setChallengesLoaded(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadTodayMenu();
  }, [userId, loadTodayMenu]);

  // Rehydrate today's conscious axis choice; stale (yesterday's) choices drop.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AXIS_CHOICE_STORAGE_KEY);
        if (cancelled || !raw) return;
        const stored = JSON.parse(raw);
        if (stored?.date === todayStr && AXES.includes(stored?.axis)) {
          setCommittedAxis(stored.axis);
        }
      } catch (_) { /* choice is a nicety — ignore */ }
    })();
    return () => { cancelled = true; };
  }, [todayStr]);

  useEffect(() => {
    let cancelled = false;
    async function bootHC() {
      try {
        const ok = await initialize();
        if (cancelled) return;
        if (!ok) return;
        setHcReady(true);
        const granted = await getGrantedPermissions();
        if (cancelled) return;
        setHasStepsPerm(hasForegroundStepsRead(granted));
        setHasKcalPerm(hasForegroundActiveCaloriesRead(granted));
        setHasDistPerm(hasForegroundDistanceRead(granted));
      } catch (e) {
        console.warn('[HC] init failed:', e?.message ?? e);
      }
    }
    bootHC();
    return () => { cancelled = true; };
  }, []);

  // ---- 4-axis daily menu derivations ---------------------------------------
  // Theme: server value once /me/challenges/today loads; device-weekday
  // fallback before that so the header renders immediately.
  const clientThemeToken = themeAxisForDate(today); // axis name | 'war_prep' | null
  const isChallengeDay = todayMenu ? todayMenu.is_challenge_day : clientThemeToken !== null;
  const boostedAxes = todayMenu?.theme?.boosted_axes
    ?? boostedAxesForTheme(clientThemeToken);
  const serverThemeToken = todayMenu?.theme
    ? (todayMenu.theme.key === 'war_prep'
        ? 'war_prep'
        : { march: 'steps', range: 'distance', drill: 'calories', tempo: 'tempo' }[todayMenu.theme.key] ?? null)
    : null;
  const themeToken = todayMenu ? serverThemeToken : clientThemeToken;

  const lockedAxis = todayMenu?.locked_axis ?? null;
  const offAxisSlot = todayMenu?.off_axis_slot ?? { eligible: false, used: false };

  // The axis auto-complete watches: server lock > conscious choice > theme
  // default (steps fallback when the theme axis has no data source).
  const armedAxis =
    lockedAxis
    ?? committedAxis
    ?? defaultAxisForTheme(themeToken, { hasKcalPerm });

  // The card follows the armed axis until the player browses.
  useEffect(() => {
    if (viewAxis === null && armedAxis !== null) setViewAxis(armedAxis);
  }, [viewAxis, armedAxis]);

  // Live per-axis progress: on-device steps (and stride distance) are ahead
  // of the server between flushes; server aggregates cover the rest.
  const axisCurrent = useCallback(
    (axis) => {
      const agg = todayMenu?.aggregates;
      if (axis === 'steps') return Math.max(liveSteps, Number(agg?.daily_steps) || 0);
      if (axis === 'distance') {
        // Prefer measured distance — the same source the backend accumulates in
        // daily_distance_m — so the row and the completion gate agree. The
        // steps×stride estimate is only a fallback when the Distance permission
        // isn't granted, mirroring the backend's per-sample sensor-else-stride rule.
        const liveM = hasDistPerm ? liveDistanceM : Math.floor(liveSteps * strideM);
        return Math.max(liveM, Number(agg?.daily_distance_m) || 0);
      }
      if (axis === 'calories') return Number(agg?.daily_calories) || 0;
      return Number(agg?.daily_tempo_tier) || 0;
    },
    [todayMenu, liveSteps, liveDistanceM, hasDistPerm, strideM],
  );

  const activeAxis = viewAxis ?? armedAxis ?? 'steps';

  const challenges = useMemo(() => {
    const cat = AXIS_CATALOG[activeAxis];
    const diffKey = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard' };
    return TIERS.map((tier) => {
      const def = cat.tiers[tier];
      let taskParams;
      if (activeAxis === 'steps') taskParams = { n: def.target.toLocaleString() };
      else if (activeAxis === 'distance') taskParams = { n: (def.target / 1000).toLocaleString() };
      else if (activeAxis === 'calories') taskParams = { n: def.target.toLocaleString() };
      else taskParams = {};
      return {
        key: def.earnKey, // challenge_key === earn_key (axis-scoped, collision-free)
        tier,
        axis: activeAxis,
        difficulty: t(`activity.${diffKey[tier]}`),
        task: t(def.taskKey, taskParams),
        xp: XP_PER_TIER[tier],
        earnKey: def.earnKey,
        target: def.target,
      };
    });
  }, [activeAxis, t]);

  const completedCount = useMemo(() => {
    let n = 0;
    for (const c of challenges) if (completedKeys.has(c.key)) n += 1;
    return n;
  }, [challenges, completedKeys]);

  const missionProgress = completedCount / 3;

  async function handleCommitAxis(axis) {
    setCommittedAxis(axis);
    try {
      await AsyncStorage.setItem(
        AXIS_CHOICE_STORAGE_KEY,
        JSON.stringify({ date: todayStr, axis }),
      );
    } catch (_) { /* non-fatal */ }
  }

  async function onCompleteChallenge(ch) {
    if (!playerId) return;
    if (completedKeys.has(ch.key)) return;
    if (isCompleting.has(ch.key)) return;

    setIsCompleting((prev) => new Set([...prev, ch.key]));

    // Snapshot pre-state for rollback on failure.
    const prevXp = playerXp;
    const prevLevel = playerLevel;
    const prevStreak = currentStreak;

    // Optimistic UI — mark done immediately, add expected XP optimistically.
    setCompletedKeys((prev) => new Set([...prev, ch.key]));
    setPlayerXp((prev) => Math.max(0, Number(prev) || 0) + ch.xp);
    setPlayerLevel(levelFromXp(Math.max(0, Number(prevXp) || 0) + ch.xp));

    try {
      // Slice 7 (S63): force a producer flush so backend sees fresh daily_steps/daily_calories
      // aggregates before CC enforcement runs. flushNow is non-throwing (lib/activity.js R.3);
      // if the producer is not started, the buffer is empty, or shouldFlush gates the call,
      // it resolves as a no-op and CC proceeds. The 403 daily_*_under_threshold path remains
      // a valid outcome — §B-15 will surface it in a later session.
      await activityProducer.flushNow();

      const result = await backendCompleteChallenge({
        clerkGetToken: getToken,
        challengeKey: ch.key,
        tier: ch.tier,
        earnKey: ch.earnKey,
      });

      if (!result.ok) {
        // Revert optimistic UI.
        console.log('[onCompleteChallenge] backend failed', result.status, result.error);
        // A 403 here is the under-threshold gate: the backend's accepted
        // aggregate is below this tier's target even after we flushed. This is
        // usually transient HC/flush lag, so arm a cooldown + attempt counter
        // (CHALLENGE_403_*) instead of blocking for the day — the auto-complete
        // effect retries after each cooldown until it lands or runs out of budget.
        if (result.status === 403) {
          const prev = blockedKeysRef.current.get(ch.key);
          blockedKeysRef.current.set(ch.key, {
            at: Date.now(),
            attempts: (prev?.attempts ?? 0) + 1,
          });
        }
        // 409 axis_locked: the server knows a lock this client hasn't seen
        // yet (another device, or a stale menu). Resync and inform.
        if (result.status === 409) {
          loadTodayMenu();
          Toast.show({ type: 'info', text1: t('activity.toastAxisLocked'), position: 'top' });
        }
        setCompletedKeys((prev) => {
          const next = new Set(prev);
          next.delete(ch.key);
          return next;
        });
        setPlayerXp(prevXp);
        setPlayerLevel(prevLevel);
        return;
      }

      // Authoritative success — clear any prior block for this challenge.
      blockedKeysRef.current.delete(ch.key);

      // Completion forced a full-day flush, so today's aggregates moved
      // server-side — refresh the menu (locks/completions) and the
      // achievements panel (fire-and-forget).
      loadTodayMenu();
      loadBests();

      // Sync UI to authoritative backend state.
      const d = result.data;
      setPlayerXp(d.total_xp);
      setPlayerLevel(levelFromXp(d.total_xp));
      setCurrentStreak(d.streak.current);

      // First-earn resource education (one lesson per completion, fires once
      // per resource per player — see lib/resourceIntro.js).
      try {
        maybeExplainResources(userId, { xp: ch.xp, ...calcResourceEarn(ch.earnKey) });
      } catch {
        // Unknown earnKey must never break the completion path.
      }

      if (d.streak_re_entry === true) {
        Toast.show({
          type: 'info',
          text1: t('activity.toastStreakReentry'),
          position: 'top',
        });
      }

      if (d.grace_day_granted === true) {
        Toast.show({
          type: 'info',
          text1: t('activity.toastGraceDay'),
          position: 'top',
        });
      }

      if (d.leveled_up === true && d.level_after === 4) {
        showCard({
          kind: 'level_up_4',
          data: {
            title: t('activity.levelUp4Title'),
            body: t('activity.levelUp4Body'),
          },
          target: 'Map',
        });
      }

      // If backend says it was already completed, keep optimistic completedKeys mark
      // (it's correct — challenge IS done) but ensure XP reflects authoritative total.
      // If newly completed, completedKeys already has ch.key from the optimistic insert.

      return d;
    } catch (e) {
      // Should not reach here — backendCompleteChallenge never throws — but defensive.
      console.error('onCompleteChallenge unexpected throw:', e?.message ?? e);
      setCompletedKeys((prev) => {
        const next = new Set(prev);
        next.delete(ch.key);
        return next;
      });
      setPlayerXp(prevXp);
      setPlayerLevel(prevLevel);
      setCurrentStreak(prevStreak);
    } finally {
      setIsCompleting((prev) => {
        const next = new Set(prev);
        next.delete(ch.key);
        return next;
      });
    }
  }

  const readTodaySteps = useCallback(async () => {
    if (!hcReady || !hasStepsPerm) return;
    try {
      const start = startOfLocalDay();
      const end = new Date();
      // Use the aggregate API (COUNT_TOTAL), NOT a sum of raw records. Health
      // Connect holds step records from multiple sources (Google Fit, the phone
      // provider, other fitness apps) that overlap in time; summing raw records
      // double-counts that overlap, which inflated liveSteps to ~2x. Aggregation
      // de-duplicates by source priority — the same deduped total the producer
      // flushes and the backend gates challenges on, so display == server truth.
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      setLiveSteps(Number(result?.COUNT_TOTAL) || 0);
    } catch (e) {
      console.warn('[HC] read failed:', e?.message ?? e);
    }
  }, [hcReady, hasStepsPerm]);

  // Live measured distance for the day — deduped HC Distance aggregate, matching
  // the backend's daily_distance_m source. Only meaningful with the Distance
  // permission; without it the distance axis falls back to the step estimate.
  const readTodayDistance = useCallback(async () => {
    if (!hcReady || !hasDistPerm) return;
    try {
      const start = startOfLocalDay();
      const end = new Date();
      const result = await aggregateRecord({
        recordType: 'Distance',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      setLiveDistanceM(Number(result?.DISTANCE?.inMeters) || 0);
    } catch (e) {
      console.warn('[HC] distance read failed:', e?.message ?? e);
    }
  }, [hcReady, hasDistPerm]);

  const readWeeklySteps = useCallback(async () => {
    if (!hcReady || !hasStepsPerm) return;
    try {
      const end = new Date();
      const start = startOfLocalDay();
      start.setDate(start.getDate() - 6);

      // Per-day aggregate (deduped), not a sum of raw records — see
      // readTodaySteps: raw records overlap across sources and double-count.
      const groups = await aggregateGroupByPeriod({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });

      const buckets = {};
      for (const g of groups ?? []) {
        const t = g?.startTime;
        if (!t) continue;
        const key = localDayKey(new Date(t));
        buckets[key] = (buckets[key] || 0) + (Number(g?.result?.COUNT_TOTAL) || 0);
      }

      const rows = [];
      for (let i = 6; i >= 0; i -= 1) {
        const day = startOfLocalDay();
        day.setDate(day.getDate() - i);
        const key = localDayKey(day);
        const jsDayIdx = day.getDay();
        const labelIdx = (jsDayIdx + 6) % 7;
        rows.push({
          day: weekDayLabels[labelIdx],
          steps: buckets[key] ?? 0,
        });
      }
      setWeeklySteps(rows);
    } catch (e) {
      console.warn('[HC] weekly read failed:', e?.message ?? e);
    }
  }, [hcReady, hasStepsPerm, weekDayLabels]);

  // Load stride once per player so distance-today can be shown live from steps.
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    (async () => {
      try {
        const { strideM: m } = await loadPlayerStride(() => getTokenRef.current());
        if (!cancelled && Number.isFinite(m) && m > 0) setStrideM(m);
      } catch (e) {
        console.warn('[activity] loadPlayerStride failed:', e?.message ?? e);
      }
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  const loadBests = useCallback(async () => {
    const result = await fetchActivityBests({
      clerkGetToken: () => getTokenRef.current(),
    });
    if (result.ok) setBests(result.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hcReady || !hasStepsPerm) return;
      const pollLive = () => {
        readTodaySteps();
        readTodayDistance();
      };
      pollLive();
      readWeeklySteps();
      loadBests();
      loadTodayMenu();
      pollRef.current = setInterval(pollLive, 10000);
      // kcal / tempo aggregates only move server-side (producer flushes every
      // ~2 min) — refresh the menu on a slower cadence.
      const menuPoll = setInterval(loadTodayMenu, 60000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        clearInterval(menuPoll);
      };
    }, [hcReady, hasStepsPerm, readTodaySteps, readTodayDistance, readWeeklySteps, loadBests, loadTodayMenu]),
  );

  async function handleRequestStepsPerm() {
    if (!hcReady || permRequesting) return;
    setPermRequesting(true);
    try {
      // One sheet for all axis data: Steps + ActiveCaloriesBurned + Distance.
      // Each is individually grantable; steps-only players keep the March axis.
      const before = await getGrantedPermissions();
      await requestPermission(ACTIVITY_READ_PERMS);
      const granted = await getGrantedPermissions();
      const hasIt = hasForegroundStepsRead(granted);
      const hasKcal = hasForegroundActiveCaloriesRead(granted);
      const hasDist = hasForegroundDistanceRead(granted);
      setHasStepsPerm(hasIt);
      setHasKcalPerm(hasKcal);
      setHasDistPerm(hasDist);
      if (hasIt) activityProducer.onPermissionGranted();

      // Android only shows the Health Connect system sheet once per app;
      // later requestPermission() calls for a NEW permission type silently
      // no-op if the app has already been through that sheet (e.g. Steps
      // was granted before this feature shipped). Detect a request that
      // changed nothing and fall back to the Health Connect settings deep
      // link, where the player can toggle the missing grants directly.
      if (granted.length === before.length && (!hasKcal || !hasDist)) {
        openHealthConnectSettings();
      }
    } catch (e) {
      console.warn('[HC] permission request failed:', e?.message ?? e);
    } finally {
      setPermRequesting(false);
    }
  }

  // Auto-complete watches ONLY the armed axis (server lock > conscious
  // choice > theme default). Never any other axis — completion locks the
  // day, so auto-firing a non-armed axis would steal the player's choice.
  useEffect(() => {
    if (!playerId || !hasStepsPerm || !challengesLoaded) return;
    if (!isChallengeDay || armedAxis === null) return;
    const cat = AXIS_CATALOG[armedAxis];
    const current = axisCurrent(armedAxis);
    (async () => {
      for (const tier of TIERS) {
        const def = cat.tiers[tier];
        if (current < def.target) continue;
        if (completedKeys.has(def.earnKey)) continue;
        if (inFlightTiersRef.current.has(def.earnKey)) continue;
        if (isCompleting.has(def.earnKey)) continue;
        // A challenge the backend rejected as under-threshold is retried on a
        // cooldown (the rejection is usually just HC/flush lag) until it either
        // lands or exhausts its attempt budget — see CHALLENGE_403_* above.
        const blocked = blockedKeysRef.current.get(def.earnKey);
        if (blocked != null) {
          if (blocked.attempts >= CHALLENGE_403_MAX_ATTEMPTS) continue;
          if (Date.now() - blocked.at < CHALLENGE_403_COOLDOWN_MS) continue;
        }
        inFlightTiersRef.current.add(def.earnKey);
        try {
          await onCompleteChallenge({
            key: def.earnKey,
            tier,
            axis: armedAxis,
            earnKey: def.earnKey,
            xp: XP_PER_TIER[tier],
          });
        } finally {
          inFlightTiersRef.current.delete(def.earnKey);
        }
      }
    })();
  }, [
    liveSteps,
    todayMenu,
    playerId,
    hasStepsPerm,
    armedAxis,
    isChallengeDay,
    axisCurrent,
    completedKeys,
    isCompleting,
    challengesLoaded,
    retryTick,
  ]);

  // Drive 403-cooldown retries when liveSteps is flat (idle player): while any
  // rejected tier still has retry budget, poke the auto-complete effect once
  // per cooldown so it re-attempts as the server aggregate catches up.
  useEffect(() => {
    const id = setInterval(() => {
      let anyRetryable = false;
      for (const b of blockedKeysRef.current.values()) {
        if (b.attempts < CHALLENGE_403_MAX_ATTEMPTS) {
          anyRetryable = true;
          break;
        }
      }
      if (anyRetryable) setRetryTick((n) => n + 1);
    }, CHALLENGE_403_COOLDOWN_MS);
    return () => clearInterval(id);
  }, []);

  const weekly = useMemo(() => {
    if (!hasStepsPerm) {
      return weekDayLabels.map((d) => ({ day: d, steps: 0 }));
    }
    // Today is the last entry; overlay live count so today's bar updates with the 10s poll
    return weeklySteps.map((row, idx) =>
      idx === 6 ? { ...row, steps: Math.max(row.steps, liveSteps) } : row,
    );
  }, [weeklySteps, liveSteps, hasStepsPerm, weekDayLabels]);

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      <View ref={walkthroughHeaderRef} collapsable={false} style={styles.headerBlock}>
        <Text style={styles.commanderLabel}>{formatToday(today, i18n.language)}</Text>
        <Text style={styles.commanderName} maxFontSizeMultiplier={1.2}>{t('activity.title')}</Text>
        <Text style={styles.rankLine}>
          <Text style={styles.rankTitle}>{username || '—'} · {t('levelTitle.' + playerLevel.title).toUpperCase()}</Text>
          <Text style={styles.rankSeparator}> · </Text>
          <Text style={styles.rankStreak}>{t('activity.dayStreak', { n: currentStreak })}</Text>
        </Text>
        <View style={styles.hairlineStrong} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hcReady && !(hasStepsPerm && hasKcalPerm && hasDistPerm) ? (
          <View ref={walkthroughPermRef} collapsable={false} style={styles.permBanner}>
            <Text style={styles.permBannerLabel}>{t('activity.permLabel')}</Text>
            <Text style={styles.permBannerText}>
              {!hasStepsPerm ? t('activity.permText') : t('activity.permTextPartial')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleRequestStepsPerm}
              disabled={permRequesting}
              style={({ pressed }) => [
                styles.permBannerBtn,
                permRequesting && { opacity: 0.45 },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={styles.permBannerBtnText}>
                {permRequesting ? t('activity.requesting') : t('activity.grantPermission')}
              </Text>
            </Pressable>
            {hasStepsPerm && (
              // Android shows its permission sheet once per app; if Steps was
              // already granted before this feature shipped, the sheet won't
              // reappear for the new grants. Always offer the direct settings
              // path rather than relying on the auto-fallback heuristic alone.
              <Pressable
                accessibilityRole="button"
                onPress={() => openHealthConnectSettings()}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.permBannerLink}>{t('activity.openHcSettings')}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {!isChallengeDay ? (
          <View ref={walkthroughChallengesRef} collapsable={false} style={styles.challengeBlock}>
            <View style={styles.challengeHeaderRow}>
              <Text style={styles.challengeSectionLabel}>{t('activity.attackDay')}</Text>
              <View style={styles.challengeHairline} />
            </View>
            <View style={styles.attackDayCard}>
              <Text style={styles.attackDayTitle}>{t('activity.attackDayTitle')}</Text>
              <Text style={styles.attackDayBody}>{t('activity.attackDayBody')}</Text>
            </View>
          </View>
        ) : (
        <View ref={walkthroughChallengesRef} collapsable={false} style={styles.challengeBlock}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.challengeSectionLabel}>{t('activity.dailyChallenges')}</Text>
            <View style={styles.challengeHairline} />
            <Text style={styles.challengeCount}>{t('activity.doneCount', { n: completedCount })}</Text>
          </View>

          {themeToken !== null && (
            <Text style={styles.themeBadge}>
              {t(`activity.theme_${themeToken}`)}
              {'  ·  '}
              {t('activity.themeBoost', { mult: THEME_BOOST_MULT })}
            </Text>
          )}

          <View style={styles.axisChipRow}>
            {AXES.map((axis) => {
              const isViewing = axis === activeAxis;
              const isArmed = axis === armedAxis;
              const isBoosted = boostedAxes.includes(axis);
              // Once the server has locked the day, other axes are out —
              // unless the Iron Guard off-axis slot is still open.
              const isLockedOut =
                lockedAxis !== null &&
                axis !== lockedAxis &&
                !(offAxisSlot.eligible && !offAxisSlot.used);
              return (
                <Pressable
                  key={axis}
                  accessibilityRole="button"
                  accessibilityLabel={t(AXIS_CATALOG[axis].nameKey)}
                  onPress={() => setViewAxis(axis)}
                  style={({ pressed }) => [
                    styles.axisChip,
                    isViewing && styles.axisChipViewing,
                    isLockedOut && styles.axisChipLockedOut,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text
                    style={[
                      styles.axisChipText,
                      isViewing && styles.axisChipTextViewing,
                      isLockedOut && styles.axisChipTextLockedOut,
                    ]}
                  >
                    {t(AXIS_CATALOG[axis].nameKey).toUpperCase()}
                    {isBoosted ? ' ×1.5' : ''}
                    {isLockedOut ? ' ✕' : isArmed ? ' ●' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Conscious axis choice: viewing a different axis than the one
              armed, before the server lock — commit switches auto-complete. */}
          {lockedAxis === null && activeAxis !== armedAxis && (
            <Pressable
              accessibilityRole="button"
              onPress={() => handleCommitAxis(activeAxis)}
              style={({ pressed }) => [styles.commitBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.commitBtnText}>
                {t('activity.trainAxisToday', { axis: t(AXIS_CATALOG[activeAxis].nameKey).toUpperCase() })}
              </Text>
            </Pressable>
          )}

          <View style={styles.challengeProgressTrack}>
            <View style={[styles.challengeProgressFill, { width: `${clamp(missionProgress, 0, 1) * 100}%` }]} />
          </View>

          <View style={styles.challengeCard}>
            {challenges.map((ch, idx) => {
              const isDone = completedKeys.has(ch.key);
              const isBusy = isCompleting.has(ch.key);
              const current = axisCurrent(ch.axis);
              // Iron Guard off-axis claim: day locked to another axis, slot
              // open, this row's threshold met → manual claim (never auto).
              const offAxisClaimable =
                lockedAxis !== null &&
                ch.axis !== lockedAxis &&
                offAxisSlot.eligible &&
                !offAxisSlot.used &&
                current >= ch.target;
              const axisNeedsKcalPerm = ch.axis === 'calories' && !hasKcalPerm;
              return (
                <React.Fragment key={ch.key}>
                  {idx > 0 && <View style={styles.challengeDivider} />}
                  <View style={styles.challengeRow}>
                    <View style={styles.challengeMain}>
                      <Text style={styles.challengeDifficulty}>{ch.difficulty.toUpperCase()}</Text>
                      <Text style={styles.challengeTask}>{ch.task}</Text>
                      <Text style={styles.challengeReward}>
                        {(() => {
                          const r = calcResourceEarn(ch.earnKey);
                          const boosted = boostedAxes.includes(ch.axis);
                          const mult = boosted ? THEME_BOOST_MULT : 1;
                          const parts = [];
                          parts.push(t('activity.rewardXp', { n: ch.xp }));
                          if (r.stone > 0) parts.push(t('activity.rewardStone', { n: Math.round(r.stone * mult) }));
                          if (r.iron > 0) parts.push(t('activity.rewardIron', { n: Math.round(r.iron * mult) }));
                          if (r.gold > 0) parts.push(t('activity.rewardGold', { n: r.gold }));
                          if (r.morale > 0) parts.push(t('activity.rewardMorale', { n: r.morale }));
                          return parts.join(' · ');
                        })()}
                      </Text>
                    </View>
                    <View style={styles.challengeAction}>
                      {isDone ? (
                        <Text style={styles.challengeDone}>{t('activity.done')}</Text>
                      ) : (DEV_MODE_MANUAL || offAxisClaimable) ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('activity.completeA11y', { difficulty: ch.difficulty })}
                          onPress={() => onCompleteChallenge(ch)}
                          disabled={!playerId || isBusy}
                          style={({ pressed }) => [
                            styles.completeBtn,
                            (!playerId || isBusy) && { opacity: 0.45 },
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Text style={styles.completeBtnText}>{t('activity.complete')}</Text>
                        </Pressable>
                      ) : !hasStepsPerm ? (
                        <Text style={styles.challengeLocked}>{t('activity.locked')}</Text>
                      ) : axisNeedsKcalPerm ? (
                        <Text style={styles.challengeLocked}>{t('activity.needsPermission')}</Text>
                      ) : (
                        <Text style={styles.challengeProgress}>
                          {fmtAxisProgress(ch.axis, current, ch.target)}
                        </Text>
                      )}
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>
        )}

        <View ref={walkthroughAchievementsRef} collapsable={false} style={styles.achievementsBlock}>
          <View style={styles.achievementsSectionRow}>
            <Text style={styles.achievementsSectionLabel}>{t('activity.dailyAchievements')}</Text>
            <View style={styles.achievementsHairline} />
          </View>

          <View style={styles.achievementsHeaderRow}>
            <Text style={styles.achievementsColLeft} />
            <Text style={styles.achievementsColToday}>{t('activity.today')}</Text>
            <Text style={styles.achievementsColBest}>{t('activity.best')}</Text>
          </View>

          <View style={styles.achievementsHeaderDivider} />

          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel}>{t('activity.distance')}</Text>
            <Text style={styles.achievementsToday}>{fmtKm(axisCurrent('distance'))}</Text>
            <Text style={styles.achievementsBest}>{fmtKm(bests.best.distance_m)}</Text>
          </View>

          <View style={styles.achievementsDivider} />

          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel}>{t('activity.activeMinutes')}</Text>
            <Text style={styles.achievementsToday}>{fmtMin(bests.today.active_minutes)}</Text>
            <Text style={styles.achievementsBest}>{fmtMin(bests.best.active_minutes)}</Text>
          </View>
        </View>

        <View style={styles.weeklyBlock}>
          <View style={styles.weeklySectionRow}>
            <Text style={styles.weeklySectionLabel}>{t('activity.weeklySteps')}</Text>
            <View style={styles.weeklyHairline} />
          </View>
          <WeeklyBarChart data={weekly} />
        </View>
      </ScrollView>

      {tips.tipElement}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  headerBlock: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  commanderLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.slate2,
  },
  commanderName: {
    marginTop: 0,
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: colors.bone,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
  },
  rankLine: {
    marginTop: 6,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
  },
  rankTitle: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: colors.claim,
  },
  rankSeparator: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: colors.slate2,
  },
  rankStreak: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: colors.slate2,
  },
  hairlineStrong: {
    marginTop: 14,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl3,
  },
  weeklyBlock: {
    marginTop: spacing.lg,
  },
  weeklySectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weeklySectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  weeklyHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  badge: {
    backgroundColor: '#E8F6F1',
    borderColor: '#C7EADF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.alliance,
    fontWeight: '900',
    fontSize: 12,
  },
  progressTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E9EEF0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.alliance,
  },
  progressFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLeft: {
    color: colors.slate2,
    fontSize: 12,
    fontWeight: '700',
  },
  progressRight: {
    color: colors.bone,
    fontSize: 12,
    fontWeight: '800',
  },
  permBanner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink2,
    gap: spacing.sm,
  },
  permBannerLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.claim,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  permBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.bone,
    lineHeight: 18,
  },
  permBannerBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.claim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  permBannerBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  permBannerLink: {
    marginTop: spacing.xs,
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  challengeBlock: {
    marginTop: spacing.lg,
  },
  themeBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.claim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  axisChipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  axisChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: colors.ink2,
  },
  axisChipViewing: {
    borderColor: colors.bone,
  },
  axisChipLockedOut: {
    opacity: 0.4,
  },
  axisChipText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.1,
  },
  axisChipTextViewing: {
    color: colors.bone,
  },
  axisChipTextLockedOut: {
    color: colors.slate2,
  },
  commitBtn: {
    marginBottom: spacing.sm,
    backgroundColor: colors.claim,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  commitBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  attackDayCard: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink2,
    padding: spacing.md,
    gap: spacing.xs,
  },
  attackDayTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 18,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  attackDayBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.slate2,
    lineHeight: 18,
  },
  challengeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  challengeSectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  challengeCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  challengeProgressTrack: {
    height: 2,
    backgroundColor: colors.hairlineStrong,
    marginBottom: spacing.sm,
  },
  challengeProgressFill: {
    height: '100%',
    backgroundColor: colors.claim,
  },
  challengeCard: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  challengeDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  challengeMain: {
    flex: 1,
    gap: spacing.xs,
  },
  challengeDifficulty: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeTask: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.bone,
  },
  challengeReward: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.2,
  },
  challengeAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  completeBtn: {
    backgroundColor: colors.claim,
    borderRadius: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeDone: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.alliance,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeProgress: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.2,
  },
  challengeLocked: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  achievementsBlock: {
    marginTop: spacing.lg,
  },
  achievementsSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  achievementsSectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  achievementsHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  achievementsCard: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  achievementsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: spacing.sm,
  },
  achievementsColLeft: {
    flex: 1,
  },
  achievementsColToday: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 72,
    textAlign: 'right',
  },
  achievementsColBest: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 72,
    textAlign: 'right',
  },
  achievementsHeaderDivider: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  achievementsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: spacing.md,
  },
  achievementsDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  achievementsLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  achievementsToday: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    color: colors.bone,
    letterSpacing: 16 * -0.02,
    width: 72,
    textAlign: 'right',
  },
  achievementsBest: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    color: colors.slate2,
    letterSpacing: 16 * -0.02,
    width: 72,
    textAlign: 'right',
  },
  chartWrap: {
    marginTop: spacing.sm,
  },
  chartLabelSlot: {
    height: 16,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLabelText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.bone,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chartCanvas: {
    position: 'relative',
  },
  chartTrendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  chartBarTrack: {
    height: 88,
    width: '100%',
    borderRadius: 0,
    backgroundColor: colors.ink3,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
  },
  chartDay: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chartDayToday: {
    fontFamily: fonts.monoMedium,
    color: colors.bone,
  },
});

