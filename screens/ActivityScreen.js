import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import {
  initialize,
  getSdkStatus,
  getGrantedPermissions,
  requestPermission,
  openHealthConnectSettings,
  aggregateRecord,
  aggregateGroupByDuration,
  SdkAvailabilityStatus,
} from '../lib/health';
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
import { streakMilestoneItem } from '../lib/milestones';
import MilestoneTakeover from '../components/MilestoneTakeover';
import CountUpText from '../components/CountUpText';
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

// ── Axis readout formatting ────────────────────────────────────────────────
// A tier row is a gauge, not a sentence: the live value and the target are
// formatted separately so they can be set at different weights, and the
// remainder is its own readout. Real-world case is preserved on units ("km").

/** True when the axis counts whole units and so may count up on screen. */
function axisCounts(axis) {
  return axis === 'steps' || axis === 'calories';
}

/** One side of a readout — no unit, so the pair reads "4.2 / 8.0 km". */
function fmtAxisValue(axis, v) {
  const n = Math.max(0, Number(v) || 0);
  if (axis === 'distance') return (n / 1000).toFixed(1);
  if (axis === 'tempo') return `T${Math.round(n)}`;
  return Math.round(n).toLocaleString();
}

/** Unit word trailing a readout. Tempo tiers are thresholds, so they carry none. */
function axisUnitLabel(axis, t) {
  if (axis === 'distance') return t('activity.unitKm');
  if (axis === 'calories') return t('activity.unitKcal');
  if (axis === 'steps') return t('activity.unitSteps');
  return '';
}

/** Distance still to cover, already carrying its unit. Null when there is none. */
function fmtRemaining(axis, current, target) {
  const left = (Number(target) || 0) - (Number(current) || 0);
  if (!(left > 0)) return null;
  if (axis === 'distance') return `${(left / 1000).toFixed(1)} km`;
  // A tempo tier is a threshold, not a quantity — "1 to go" would be nonsense.
  if (axis === 'tempo') return null;
  return Math.ceil(left).toLocaleString();
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

/** Local Monday 00:00 of the week containing `d`. The game week is Mon–Fri
 *  drills plus a Sat/Sun Attack Day, so the chart must start on Monday —
 *  a rolling seven days ending today split the weekend across both ends. */
function startOfLocalWeek(d = new Date()) {
  const x = startOfLocalDay(d);
  const mondayOffset = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

/** Mon→Sun skeleton for the current calendar week, with days after today
 *  flagged so they render as unwalked rather than as a zero. */
function calendarWeekSkeleton(weekDayLabels) {
  const monday = startOfLocalWeek();
  const todayKey = localDayKey(new Date());
  const rows = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    const key = localDayKey(day);
    rows.push({
      day: weekDayLabels[i],
      key,
      steps: 0,
      isToday: key === todayKey,
      future: day.getTime() > startOfLocalDay().getTime(),
      weekend: i >= 5,
    });
  }
  return rows;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Magnitude view of the week. Bars only: the old build drew the same series
// twice, as bars and as a Catmull-Rom spline whose control points overshot
// below zero and were then clipped flat at the floor, so a rest day read as a
// crash. One mark, an explicit baseline, a labelled goal rule, and a figure
// over every bar — a steps chart from which a step count can be read.
// At the 11pt floor a full "15,000" overflows a ~36pt column on a 360-wide
// phone, so bar figures of 1,000+ read as "15.2k" (≤5 glyphs).
function compactSteps(n, t) {
  if (n < 1000) return n.toLocaleString();
  const k = n < 100000 ? Math.round(n / 100) / 10 : Math.round(n / 1000);
  return t('activity.chartThousands', { n: k.toLocaleString() });
}

function WeeklyBarChart({ data, goal }) {
  const { t } = useTranslation();
  const BAR_MAX = 76;
  const peak = data.reduce((m, d) => Math.max(m, Number(d.steps) || 0), 0);
  // Headroom so a week that never reaches the goal still shows the rule below
  // the ceiling, and a record week does not touch the value labels.
  const scaleMax = Math.max(peak, goal) * 1.15;
  const goalOffset = scaleMax > 0 ? (1 - goal / scaleMax) * BAR_MAX : 0;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartPlot}>
        <View style={styles.chartCols}>
          {data.map((d) => {
            const steps = Number(d.steps) || 0;
            const cleared = steps >= goal;
            const h = scaleMax > 0 ? clamp(steps / scaleMax, 0, 1) * BAR_MAX : 0;
            return (
              <View key={d.key} style={styles.chartCol}>
                <View style={styles.chartValueSlot}>
                  {!d.future && steps > 0 ? (
                    <Text
                      style={[styles.chartValue, d.isToday && styles.chartValueToday]}
                      accessibilityLabel={t('activity.chartLabel', { day: d.day, steps: steps.toLocaleString() })}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.15}
                    >
                      {compactSteps(steps, t)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.chartBarSlot}>
                  {d.future ? null : (
                    // Today is marked at the axis, never by a brighter fill:
                    // painting the current bar full bone made a 400-step
                    // morning louder than a cleared 15,000-step Tuesday.
                    <View
                      style={[
                        styles.chartBar,
                        { height: steps > 0 ? Math.max(h, 2) : 0 },
                        cleared && styles.chartBarCleared,
                      ]}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
        {/* The goal rule sits over the bars; the gutter to its right holds the
            figure so the two never collide. */}
        <View style={[styles.chartGoalRule, { top: goalOffset }]} pointerEvents="none" />
        <Text style={[styles.chartGoalLabel, { top: goalOffset - 7 }]} maxFontSizeMultiplier={1.15}>
          {compactSteps(goal, t)}
        </Text>
        <View style={styles.chartBaseline} pointerEvents="none" />
        {/* Two labelled references — the floor and the daily minimum — so the
            rules the bars are measured against are both readable figures. */}
        <Text style={styles.chartZeroLabel} maxFontSizeMultiplier={1.15}>0</Text>
      </View>
      <View style={styles.chartDayRow}>
        {data.map((d) => (
          <View key={`lbl-${d.key}`} style={styles.chartCol}>
            <View style={[styles.chartDayMark, d.isToday && styles.chartDayMarkToday]} />
            <Text
              style={[
                styles.chartDay,
                d.weekend && styles.chartDayWeekend,
                d.future && styles.chartDayFuture,
                d.isToday && styles.chartDayToday,
              ]}
              maxFontSizeMultiplier={1.2}
            >
              {d.day}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// State view of the same week, pinned in the header: did each day clear the
// daily minimum. Seven cells so a streak of zero still has a shape — six
// settled cells behind and one live cell filling under your feet today.
function WeekTrack({ data, goal, a11yLabel }) {
  return (
    <View style={styles.weekTrack} accessible accessibilityLabel={a11yLabel}>
      {data.map((d) => {
        const steps = Number(d.steps) || 0;
        const cleared = steps >= goal;
        const fill = goal > 0 ? clamp(steps / goal, 0, 1) : 0;
        return (
          <View key={`cell-${d.key}`} style={styles.weekCellCol}>
            <View
              style={[
                styles.weekCell,
                d.future && styles.weekCellFuture,
                cleared && styles.weekCellCleared,
                d.isToday && styles.weekCellToday,
              ]}
            >
              {/* Today fills from the floor as the day is walked. */}
              {d.isToday && !cleared ? (
                <View style={[styles.weekCellLive, { height: `${Math.max(fill * 100, 2)}%` }]} />
              ) : null}
            </View>
            <Text
              style={[styles.weekCellLabel, d.isToday && styles.weekCellLabelToday]}
              maxFontSizeMultiplier={1.2}
            >
              {d.day.charAt(0)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Difficulty read from form, not from a word: one, two or three filled marks
// stamped ahead of the tier label. The same weight is echoed by the gauge's
// thickness below it, so a HARD row is visibly heavier instrumentation.
function TierPips({ level, done }) {
  return (
    <View style={styles.tierPips}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.tierPip,
            i <= level && (done ? styles.tierPipDone : styles.tierPipOn),
          ]}
        />
      ))}
    </View>
  );
}

// The instrument. A measured rail rather than a bare fraction: track at
// hairline strength, fill in bone (never a territory colour — progress is not
// ownership), and ink notches at the lower tiers' thresholds so each row shows
// where it sits on the day's ladder. Flat, square, no gradient.
function ChallengeGauge({ progress, thickness, ticks, done, muted }) {
  const pct = clamp(Number(progress) || 0, 0, 1);
  // A started-but-tiny gauge must still read as started.
  const width = pct <= 0 ? 0 : Math.max(pct * 100, 1.5);
  return (
    <View style={[styles.gaugeTrack, { height: thickness }]}>
      <View
        style={[
          styles.gaugeFill,
          { width: `${width}%` },
          muted && styles.gaugeFillMuted,
          done && styles.gaugeFillDone,
        ]}
      />
      {(ticks ?? []).map((f, i) => (
        <View key={`tick-${i}`} style={[styles.gaugeTick, { left: `${f * 100}%` }]} />
      ))}
    </View>
  );
}

// Today measured against the standing best. A hairline notch marks the best
// itself, so a day that ties it lands exactly on the mark.
function BestRail({ today, best }) {
  const b = Number(best) || 0;
  if (!(b > 0)) return null;
  const pct = clamp((Number(today) || 0) / b, 0, 1);
  return (
    <View style={styles.bestRailTrack}>
      <View style={[styles.bestRailFill, { width: `${pct <= 0 ? 0 : Math.max(pct * 100, 1.5)}%` }]} />
    </View>
  );
}

export default function ActivityScreen() {
  const { t, i18n } = useTranslation();
  const weekDayLabels = useMemo(() => t('activity.weekDays', { returnObjects: true }), [t]);
  const { userId, getToken } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  // The map's "earn X" dead-ends route here with the resource the player came
  // for; the menu then names it and pre-selects a paying axis.
  const needResource = route?.params?.needResource ?? null;
  const payingAxes = useMemo(
    () => (needResource ? AXES.filter((a) => AXIS_CATALOG[a].primaryResource === needResource) : []),
    [needResource],
  );

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

  const [playerId, setPlayerId] = useState(null);
  const [playerXp, setPlayerXp] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakMilestone, setStreakMilestone] = useState(null);
  const [username, setUsername] = useState('');
  const [territoryCount, setTerritoryCount] = useState(0);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [isCompleting, setIsCompleting] = useState(() => new Set());
  const [playerLevel, setPlayerLevel] = useState(() => levelFromXp(0));
  const [hcReady, setHcReady] = useState(false);
  // null until the first getSdkStatus() resolves; one of SdkAvailabilityStatus
  // after. Drives which recovery the not-ready banner offers.
  const [hcStatus, setHcStatus] = useState(null);
  const [hasStepsPerm, setHasStepsPerm] = useState(false);
  // Optional axis permissions — steps-only players still get March.
  const [hasKcalPerm, setHasKcalPerm] = useState(false);
  const [hasDistPerm, setHasDistPerm] = useState(false);
  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [menuError, setMenuError] = useState(false);
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
  const [weeklySteps, setWeeklySteps] = useState(() => calendarWeekSkeleton(weekDayLabels));
  // Attack Day runs from Saturday 00:00 to the following Monday 00:00 local,
  // when drills return. Re-read once a minute so the panel's countdown is live.
  const [nowTick, setNowTick] = useState(() => Date.now());
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

  // Re-derived from the minute tick. A tab screen never unmounts, so a date
  // frozen at mount left the header naming yesterday and the 17:00 at-risk
  // check permanently reading the hour the app happened to launch.
  const today = useMemo(() => new Date(nowTick), [nowTick]);
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
      console.error('[activity] challenges/today failed', result.status, result.error);
      // Only surface the failure if we have nothing to show yet; a transient
      // refetch failure shouldn't blank out an already-loaded menu.
      if (!challengesLoaded) setMenuError(true);
      return;
    }
    setMenuError(false);
    setTodayMenu(result.data);
    setCompletedKeys(new Set((result.data.completed ?? []).map((c) => c.challenge_key)));
    setChallengesLoaded(true);
  }, [challengesLoaded]);

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

  // Health Connect boot. This CANNOT be a mount-only effect: ActivityScreen is
  // a tab screen that never unmounts, so a single early failure (provider not
  // bound yet on a cold start, Health Connect missing or mid-update, player
  // sent to HC settings and coming back) would leave hcReady false for the
  // whole app session — and the grant button lives behind hcReady, so the app
  // would never ask for step permission again until a force-quit.
  // Re-runs on every focus; also refreshes grants, which is how a player who
  // toggles permissions in HC settings sees them without restarting.
  const bootingRef = useRef(false);
  const bootHC = useCallback(async () => {
    if (bootingRef.current) return;
    bootingRef.current = true;
    try {
      const status = await getSdkStatus();
      setHcStatus(status);
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        setHcReady(false);
        return;
      }
      const ok = await initialize();
      setHcReady(!!ok);
      if (!ok) return;
      const granted = await getGrantedPermissions();
      setHasStepsPerm(hasForegroundStepsRead(granted));
      setHasKcalPerm(hasForegroundActiveCaloriesRead(granted));
      setHasDistPerm(hasForegroundDistanceRead(granted));
    } catch (e) {
      console.warn('[HC] init failed:', e?.message ?? e);
      setHcReady(false);
    } finally {
      bootingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      bootHC();
    }, [bootHC]),
  );

  // Health Connect settings and the Play listing are separate activities, so
  // coming back from them never re-fires navigation focus — this screen is
  // still "focused" the whole time. Without an AppState hook a player who
  // grants Steps in HC settings returns to a banner that still says the
  // permission is missing.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') bootHC();
    });
    return () => sub.remove();
  }, [bootHC]);

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

  // Arriving from a map "earn X" dead-end: open the card on a paying axis that
  // isn't locked out, so the resource the player came for is one tap away.
  const didHonourNeedRef = useRef(false);
  useEffect(() => {
    if (didHonourNeedRef.current || payingAxes.length === 0) return;
    const target = payingAxes.find((a) => a !== lockedAxis) ?? null;
    if (target && lockedAxis === null) {
      didHonourNeedRef.current = true;
      setViewAxis(target);
    }
  }, [payingAxes, lockedAxis]);

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
    // Gauge weight by tier — the rail thickens as the target hardens.
    const GAUGE_THICKNESS = [3, 5, 8];
    return TIERS.map((tier, level) => {
      const def = cat.tiers[tier];
      let taskParams;
      if (activeAxis === 'steps') taskParams = { n: def.target.toLocaleString() };
      else if (activeAxis === 'distance') taskParams = { n: (def.target / 1000).toLocaleString() };
      else if (activeAxis === 'calories') taskParams = { n: def.target.toLocaleString() };
      else taskParams = {};
      // The three tiers are one ladder on one measurement, so a harder row
      // carries notches where the easier thresholds fall on its own scale.
      const ticks = TIERS.slice(0, level)
        .map((lower) => cat.tiers[lower].target / def.target)
        .filter((f) => f > 0 && f < 1);
      return {
        key: def.earnKey, // challenge_key === earn_key (axis-scoped, collision-free)
        tier,
        level,
        axis: activeAxis,
        difficulty: t(`activity.${diffKey[tier]}`),
        task: t(def.taskKey, taskParams),
        xp: XP_PER_TIER[tier],
        earnKey: def.earnKey,
        target: def.target,
        thickness: GAUGE_THICKNESS[level],
        ticks,
      };
    });
  }, [activeAxis, t]);

  // The "n / 3 DONE" count must reflect the axis that actually counts today
  // (the armed/committed one), not whichever axis the player is browsing —
  // otherwise a committed-March player viewing Range reads a false 0 / 3.
  const completedCount = useMemo(() => {
    const countedAxis = armedAxis ?? activeAxis;
    const cat = AXIS_CATALOG[countedAxis];
    if (!cat) return 0;
    let n = 0;
    for (const tier of TIERS) {
      if (completedKeys.has(cat.tiers[tier].earnKey)) n += 1;
    }
    return n;
  }, [armedAxis, activeAxis, completedKeys]);

  // Streak beats: completing any tier of the armed axis secures today's streak;
  // an incomplete challenge day after 17:00 puts an existing streak at risk.
  const AT_RISK_HOUR = 17;
  const streakSecuredToday = completedCount > 0;
  const streakAtRisk =
    isChallengeDay && !streakSecuredToday && currentStreak > 0 && today.getHours() >= AT_RISK_HOUR;

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
        console.error('[onCompleteChallenge] backend failed', result.status, result.error);
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

      // Streak milestone ceremony — server decided the crossing (7/14/21/
      // 30/60/90) and granted the XP; the client only plays the moment.
      if (d.streak_milestone) {
        setStreakMilestone(streakMilestoneItem(t, d.streak_milestone, d.streak.tier_name));
      }

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
      const start = startOfLocalWeek();

      // Per-day aggregate (deduped), not a sum of raw records — see
      // readTodaySteps: raw records overlap across sources and double-count.
      //
      // Use aggregateGroupByDuration (fixed 24h slices), NOT
      // aggregateGroupByPeriod: this version of react-native-health-connect
      // builds every time-range filter with Instant.parse (an absolute-time
      // filter), but Health Connect's Period aggregation requires a LOCAL time
      // filter and throws when given an absolute one — so aggregateGroupByPeriod
      // always rejected, the read was silently caught, and the weekly chart
      // never left its empty skeleton (blank past days, today's live count
      // landing on the last bar). Duration slices accept the absolute filter.
      // Day slices start at local midnight; with no DST (IST) they map exactly
      // to local days, and the tiny DST edge is acceptable for a bar chart.
      const groups = await aggregateGroupByDuration({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
        timeRangeSlicer: { duration: 'DAYS', length: 1 },
      });

      const buckets = {};
      for (const g of groups ?? []) {
        const t = g?.startTime;
        if (!t) continue;
        const key = localDayKey(new Date(t));
        buckets[key] = (buckets[key] || 0) + (Number(g?.result?.COUNT_TOTAL) || 0);
      }

      // Same Mon→Sun skeleton the empty state uses; fill in the measured
      // per-day totals by date key so labels and data can never diverge.
      const rows = calendarWeekSkeleton(weekDayLabels).map((row) => ({
        ...row,
        steps: buckets[row.key] ?? 0,
      }));
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

  // Health Connect is a separate Play app below Android 14 and part of the OS
  // from 14 on. Either way an unavailable / out-of-date provider is fixed in
  // the Play listing, not in the app's own settings.
  const hcNeedsProvider =
    hcStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE ||
    hcStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED;

  const openHealthConnectStore = useCallback(async () => {
    const id = 'com.google.android.apps.healthdata';
    try {
      await Linking.openURL(`market://details?id=${id}`);
    } catch (_) {
      // No Play Store app (emulator, sideloaded ROM) — the web listing works.
      Linking.openURL(`https://play.google.com/store/apps/details?id=${id}`).catch(() => {});
    }
  }, []);

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
      return calendarWeekSkeleton(weekDayLabels);
    }
    // Overlay the live count on today's cell so the track and the chart both
    // move with the 10s poll rather than waiting on the next aggregate read.
    return weeklySteps.map((row) =>
      row.isToday ? { ...row, steps: Math.max(row.steps, liveSteps) } : row,
    );
  }, [weeklySteps, liveSteps, hasStepsPerm, weekDayLabels]);

  // The daily minimum both week instruments measure against — the easy step
  // tier, so the track agrees with what the challenge ladder actually asks.
  const dailyGoal = AXIS_CATALOG.steps.tiers.easy.target;
  const daysCleared = useMemo(
    () => weekly.filter((d) => !d.future && d.steps >= dailyGoal).length,
    [weekly, dailyGoal],
  );
  const weekTotal = useMemo(
    () => weekly.reduce((sum, d) => sum + (Number(d.steps) || 0), 0),
    [weekly],
  );

  // The weekend as a measured window rather than a numeral. Attack Day opens
  // Saturday 00:00 and closes the following Monday 00:00 — the same boundary
  // themeAxisForDate uses — so the panel can show how much of it has already
  // gone as well as what is left. Nothing here is invented: it is the clock.
  const attackWindow = useMemo(() => {
    const monday = startOfLocalWeek(new Date(nowTick));
    const opens = new Date(monday);
    opens.setDate(opens.getDate() + 5); // Saturday 00:00
    const boundary = new Date(monday);
    boundary.setDate(boundary.getDate() + 6); // Sunday 00:00
    const closes = new Date(monday);
    closes.setDate(closes.getDate() + 7); // Monday 00:00
    const span = closes.getTime() - opens.getTime();
    if (!(span > 0)) return null;
    const msLeft = Math.max(0, closes.getTime() - nowTick);
    const hours = Math.floor(msLeft / 3_600_000);
    const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
    return {
      elapsed: clamp((nowTick - opens.getTime()) / span, 0, 1),
      boundary: clamp((boundary.getTime() - opens.getTime()) / span, 0, 1),
      left: `${hours}h ${String(minutes).padStart(2, '0')}m`,
      // Caution Amber is the sanctioned expiring signal. A weekend can never
      // also be showing the at-risk streak line (that needs a drill day), so
      // this is the screen's single caution element.
      closing: msLeft <= 2 * 3_600_000,
    };
  }, [nowTick]);

  // Runs every day, not only at the weekend: the date header, the window rail
  // and the 17:00 at-risk check all read from this tick.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The screen's headline. Falls back to the tab's own name only in the gap
  // before the theme resolves, so it is never blank.
  const dayTitle = !isChallengeDay
    ? t('activity.attackDay')
    : themeToken
      ? t(`activity.theme_${themeToken}`)
      : t('activity.title');

  // One line of banked effort under the week track, so a zero streak still
  // proves the walking counted. XP is the only lifetime ledger on the screen:
  // territories held belong to the Attack Day panel and the best day belongs
  // to RECORDS, and printing either figure twice one scroll apart was the
  // double-encoding the rest of this screen just spent a round removing.
  const lifetimeLine = useMemo(
    () => (playerXp > 0 ? t('activity.lifetimeXp', { n: playerXp.toLocaleString() }) : null),
    [playerXp, t],
  );

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      <View ref={walkthroughHeaderRef} collapsable={false} style={styles.headerBlock}>
        <Text style={styles.commanderLabel}>{formatToday(today, i18n.language)}</Text>
        {/* The headline names the day, not the tab. "ACTIVITY" was set three
            times the size of the streak to repeat a word the tab bar already
            prints 20px below; the theme is the thing the player does not
            already know. */}
        <Text style={styles.commanderName} maxFontSizeMultiplier={1.2}>{dayTitle}</Text>
        <Text style={styles.rankLine}>
          <Text style={styles.rankTitle}>{username || '—'} · {t('levelTitle.' + playerLevel.title).toUpperCase()}</Text>
        </Text>
        {/* Progression, as an instrument rather than a caption. Seven cells
            for the seven days of the game week — settled behind, live under
            your feet today, unwalked ahead — with the authoritative streak
            read alongside and one line of banked effort beneath. Ceremony is
            rationed: a big Archivo numeral belongs to the milestone takeover,
            not to a header that has to render a zero most mornings. */}
        <View style={styles.weekBlock}>
          <View style={styles.weekHeaderRow}>
            <Text style={styles.weekSectionLabel}>{t('activity.thisWeek')}</Text>
            <View style={styles.weekHeaderRule} />
            <Text style={styles.streakReadout} maxFontSizeMultiplier={1.3}>
              {streakSecuredToday ? (
                <CountUpText value={currentStreak} countOnMount style={styles.streakReadoutValue} />
              ) : (
                <Text style={styles.streakReadoutValue}>{currentStreak}</Text>
              )}
              <Text style={styles.streakReadoutLabel}>{`  ${t('activity.dayStreakLabel')}`}</Text>
            </Text>
          </View>

          <WeekTrack
            data={weekly}
            goal={dailyGoal}
            a11yLabel={t('activity.weekTrackCaption', {
              n: daysCleared,
              goal: dailyGoal.toLocaleString(),
            })}
          />

          <Text style={styles.weekCaption} maxFontSizeMultiplier={1.3}>
            {t('activity.weekTrackCaption', { n: daysCleared, goal: dailyGoal.toLocaleString() })}
          </Text>
          {lifetimeLine ? (
            <Text style={styles.lifetimeLine} maxFontSizeMultiplier={1.3}>{lifetimeLine}</Text>
          ) : null}
        </View>

        {/* The at-risk warning is the screen's one caution element, and it can
            only fire on a drill day — a weekend has no challenge to lose. */}
        {streakAtRisk ? (
          <Text style={styles.streakAtRiskLine}>{t('activity.streakEndsTonight')}</Text>
        ) : streakSecuredToday ? (
          <Text style={styles.streakSafeLine}>{t('activity.streakSafeToday')}</Text>
        ) : !isChallengeDay && currentStreak > 0 ? (
          // The weekend variant. A commander with a live streak and no drill to
          // secure needs to know the count survives; a commander on zero does
          // not need a second sentence saying what the panel below already says.
          <Text style={styles.streakSafeLine}>{t('activity.streakWeekendHold')}</Text>
        ) : isChallengeDay && currentStreak === 0 ? (
          // Gated on the drill day. Unconditional, this sentence sat one glance
          // above "Challenges return Monday" every weekend.
          <Text style={styles.streakZeroHint}>{t('activity.streakZeroHint')}</Text>
        ) : null}
        <View style={styles.hairlineStrong} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {needResource && payingAxes.length > 0 && isChallengeDay ? (
          <View style={styles.needBanner}>
            <Text style={styles.needBannerText}>
              {t('activity.needResourceBanner', {
                resource: t(`activity.resourceName.${needResource}`),
                axes: payingAxes.map((a) => t(AXIS_CATALOG[a].nameKey)).join(' · '),
              })}
            </Text>
          </View>
        ) : null}

        {menuError ? (
          <View style={styles.menuErrorBanner}>
            <Text style={styles.menuErrorText}>{t('activity.menuLoadError')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => { setMenuError(false); loadTodayMenu(); }}
              style={({ pressed }) => [styles.menuRetryBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.menuRetryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!hcReady ? (
          <View style={styles.permBanner}>
            <Text style={styles.permBannerLabel}>{t('activity.hcRequiredLabel')}</Text>
            <Text style={styles.permBannerText}>
              {hcNeedsProvider ? t('activity.hcInstallBody') : t('activity.hcRequiredBody')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={hcNeedsProvider ? openHealthConnectStore : bootHC}
              style={({ pressed }) => [styles.permBannerBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.permBannerBtnText}>
                {hcNeedsProvider ? t('activity.hcInstallCta') : t('common.retry')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openHealthConnectSettings()}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.permBannerLink}>{t('activity.hcRequiredCta')}</Text>
            </Pressable>
          </View>
        ) : null}

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
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.permBannerLink}>{t('activity.openHcSettings')}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {!isChallengeDay ? (
          // Two days in seven this panel is the whole screen, so it carries the
          // weight: a live countdown to close, what is at stake, what today has
          // measured, and the one action available. The section label is gone —
          // the headline above already says ATTACK DAY.
          <View ref={walkthroughChallengesRef} collapsable={false} style={styles.attackDayCard}>
            <View style={styles.attackDayRule} />
            <Text style={styles.attackDayTitle} maxFontSizeMultiplier={1.3}>
              {t('activity.attackDayTitle')}
            </Text>
            <Text style={styles.attackDayBody} maxFontSizeMultiplier={1.5}>
              {t('activity.attackDayBody')}
            </Text>

            {/* The instrument the weekend was missing. A depletion rail across
                the 48-hour window, notched at the Saturday/Sunday boundary and
                scaled by three day ticks, so "how much of Attack Day is left"
                is a shape before it is a figure. */}
            {attackWindow ? (
              <View
                style={styles.attackWindow}
                accessible
                accessibilityLabel={t('activity.attackWindowA11y', { v: attackWindow.left })}
              >
                <View style={styles.attackWindowHead}>
                  <Text style={styles.attackWindowLabel} maxFontSizeMultiplier={1.3}>
                    {t('activity.attackWindowLabel')}
                  </Text>
                  <Text
                    style={[
                      styles.attackWindowLeft,
                      attackWindow.closing && styles.attackWindowLeftClosing,
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {t('activity.attackWindowLeft', { v: attackWindow.left })}
                  </Text>
                </View>
                <View style={styles.attackWindowTrack}>
                  <View
                    style={[styles.attackWindowFill, { width: `${attackWindow.elapsed * 100}%` }]}
                  />
                  <View
                    style={[styles.attackWindowNotch, { left: `${attackWindow.boundary * 100}%` }]}
                  />
                </View>
                <View style={styles.attackWindowScale}>
                  <Text style={styles.attackWindowTick} maxFontSizeMultiplier={1.2}>
                    {String(weekDayLabels[5] ?? '').toUpperCase()}
                  </Text>
                  <Text
                    style={[styles.attackWindowTick, styles.attackWindowTickMid]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {String(weekDayLabels[6] ?? '').toUpperCase()}
                  </Text>
                  <Text
                    style={[styles.attackWindowTick, styles.attackWindowTickEnd]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {String(weekDayLabels[0] ?? '').toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* What is actually at stake for the next two days. Today's walk
                and the best day are read in RECORDS below; this panel carries
                the one figure the weekend puts at risk. */}
            <View style={styles.attackHoldRow}>
              <Text style={styles.attackHoldLabel} maxFontSizeMultiplier={1.3}>
                {t('activity.attackHeldLabel')}
              </Text>
              <Text
                style={[styles.attackHoldValue, territoryCount === 0 && styles.attackHoldValueZero]}
                maxFontSizeMultiplier={1.3}
              >
                {territoryCount.toLocaleString()}
              </Text>
            </View>

            {/* The weekend has no commit CTA, so this is the screen's single
                Claim Red — and the only thing there is to do today. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Map')}
              style={({ pressed }) => [styles.attackCta, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.attackCtaText}>{t('activity.attackDayCta')}</Text>
            </Pressable>
          </View>
        ) : (
        <View ref={walkthroughChallengesRef} collapsable={false} style={styles.challengeBlock}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.challengeSectionLabel}>{t('activity.dailyChallenges')}</Text>
            <View style={styles.challengeHairline} />
            <Text style={styles.challengeCount}>{t('activity.doneCount', { n: completedCount })}</Text>
          </View>

          {/* Three tiers, three segments — a count, not a percentage. A
              continuous bar implied a fraction of one task; this reads as the
              discrete ladder it actually is. Sits directly under its own
              readout so the number and the meter are one instrument. */}
          <View style={styles.missionTicks} accessibilityLabel={t('activity.doneCount', { n: completedCount })}>
            {TIERS.map((tier, i) => (
              <View
                key={tier}
                style={[styles.missionTick, i < completedCount && styles.missionTickDone]}
              />
            ))}
          </View>

          {/* The theme name is the screen's headline now; only the multiplier
              is left to say here. */}
          {themeToken !== null && (
            <Text style={styles.themeBadge}>
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
                  </Text>
                  {isArmed || isLockedOut ? (
                    <Text style={[styles.axisChipMeta, isArmed && styles.axisChipMetaArmed]}>
                      {isLockedOut ? t('activity.axisLocked') : t('activity.axisArmed')}
                    </Text>
                  ) : null}
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
              // No data source means no measurement — the gauge must not
              // pretend to read zero when it is simply not reading.
              const noSource = !hasStepsPerm || axisNeedsKcalPerm;
              // A measured axis has a quantity worth setting large. Tempo is a
              // threshold protocol, so its sentence stays the hero line.
              const isMeasured = ch.axis !== 'tempo';
              const shown = Math.min(Number(current) || 0, ch.target);
              const progress = isDone ? 1 : ch.target > 0 ? shown / ch.target : 0;
              const remaining = isDone || noSource ? null : fmtRemaining(ch.axis, current, ch.target);
              const rewardText = (() => {
                const r = calcResourceEarn(ch.earnKey);
                const mult = boostedAxes.includes(ch.axis) ? THEME_BOOST_MULT : 1;
                const parts = [t('activity.rewardXp', { n: ch.xp })];
                if (r.stone > 0) parts.push(t('activity.rewardStone', { n: Math.round(r.stone * mult) }));
                if (r.iron > 0) parts.push(t('activity.rewardIron', { n: Math.round(r.iron * mult) }));
                if (r.gold > 0) parts.push(t('activity.rewardGold', { n: r.gold }));
                if (r.morale > 0) parts.push(t('activity.rewardMorale', { n: r.morale }));
                return parts.join(' · ');
              })();
              return (
                <React.Fragment key={ch.key}>
                  {idx > 0 && <View style={styles.challengeDivider} />}
                  <View style={[styles.challengeRow, isDone && styles.challengeRowDone]}>
                    <View style={styles.rowHead}>
                      <View style={styles.rowHeadLeft}>
                        <TierPips level={ch.level} done={isDone} />
                        <Text
                          style={[styles.challengeDifficulty, isDone && styles.challengeDifficultyDone]}
                          maxFontSizeMultiplier={1.4}
                        >
                          {ch.difficulty.toUpperCase()}
                        </Text>
                      </View>

                      {isDone ? (
                        <View style={styles.securedTag}>
                          <View style={styles.securedMark} />
                          <Text style={styles.securedText} maxFontSizeMultiplier={1.3}>
                            {t('activity.done')}
                          </Text>
                        </View>
                      ) : noSource ? (
                        <Text style={styles.challengeLocked} maxFontSizeMultiplier={1.3}>
                          {!hasStepsPerm ? t('activity.locked') : t('activity.needsPermission')}
                        </Text>
                      ) : isMeasured ? (
                        remaining ? (
                          <Text style={styles.challengeRemain} maxFontSizeMultiplier={1.3}>
                            {t('activity.toGo', { n: remaining })}
                          </Text>
                        ) : null
                      ) : (
                        // Tempo: the tier itself is the readout; the protocol
                        // below carries the meaning, so it stays small here.
                        <Text style={styles.readoutTierLine} maxFontSizeMultiplier={1.3}>
                          {`${fmtAxisValue(ch.axis, shown)} / ${fmtAxisValue(ch.axis, ch.target)}`}
                        </Text>
                      )}
                    </View>

                    {/* The row's hero line is the measurement itself. Naming
                        the target in a sentence as well ("Walk 10,000 steps")
                        printed the same number twice, so the sentence is kept
                        only where it says something the gauge cannot: a tempo
                        protocol, or a row with no data source, where a readout
                        of "0" would be a reading we have not actually taken. */}
                    {isMeasured && !noSource ? (
                      <Text style={styles.readoutLine} maxFontSizeMultiplier={1.3}>
                        {axisCounts(ch.axis) ? (
                          <CountUpText value={shown} style={styles.readoutCurrent} />
                        ) : (
                          <Text style={styles.readoutCurrent}>{fmtAxisValue(ch.axis, shown)}</Text>
                        )}
                        <Text style={styles.readoutTarget}>
                          {` / ${fmtAxisValue(ch.axis, ch.target)} ${axisUnitLabel(ch.axis, t)}`}
                        </Text>
                      </Text>
                    ) : (
                      <Text style={styles.challengeTask} maxFontSizeMultiplier={1.5}>{ch.task}</Text>
                    )}

                    <ChallengeGauge
                      progress={progress}
                      thickness={ch.thickness}
                      ticks={ch.ticks}
                      done={isDone}
                      muted={noSource}
                    />

                    <Text
                      style={[styles.challengeReward, isDone && styles.challengeRewardDone]}
                      maxFontSizeMultiplier={1.5}
                    >
                      {rewardText}
                    </Text>

                    {!isDone && (DEV_MODE_MANUAL || offAxisClaimable) ? (
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
                    ) : null}
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>
        )}

        <View ref={walkthroughAchievementsRef} collapsable={false} style={styles.achievementsBlock}>
          <View style={styles.achievementsSectionRow}>
            {/* Renamed: the section holds two measurements read against a
                personal record, and never held an achievement. */}
            <Text style={styles.achievementsSectionLabel}>{t('activity.recordsLabel')}</Text>
            <View style={styles.achievementsHairline} />
          </View>

          <View style={styles.achievementsHeaderRow}>
            <Text style={styles.achievementsColLeft} />
            <Text style={styles.achievementsColToday}>{t('activity.today')}</Text>
            <Text style={styles.achievementsColBest}>{t('activity.best')}</Text>
          </View>

          <View style={styles.achievementsHeaderDivider} />

          {/* Today read against the personal best — the same rail language as
              the challenge rows, so "how close am I" is one glance everywhere.
              The rail only appears once a best exists to measure against. */}
          {/* Weight follows meaning: a figure that is zero has nothing to say
              and recedes, and a standing record is never the dimmest thing in
              its own row. Previously the zeros were full bone and the only
              real numbers on the screen were slate. */}
          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel} maxFontSizeMultiplier={1.4}>{t('activity.distance')}</Text>
            <Text
              style={[styles.achievementsToday, !(axisCurrent('distance') > 0) && styles.achievementsZero]}
              maxFontSizeMultiplier={1.3}
            >
              {fmtKm(axisCurrent('distance'))}
            </Text>
            <Text style={styles.achievementsBest} maxFontSizeMultiplier={1.3}>{fmtKm(bests.best.distance_m)}</Text>
          </View>
          <BestRail today={axisCurrent('distance')} best={bests.best.distance_m} />

          <View style={styles.achievementsDivider} />

          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel} maxFontSizeMultiplier={1.4}>{t('activity.activeMinutes')}</Text>
            <Text
              style={[styles.achievementsToday, !(bests.today.active_minutes > 0) && styles.achievementsZero]}
              maxFontSizeMultiplier={1.3}
            >
              {fmtMin(bests.today.active_minutes)}
            </Text>
            <Text style={styles.achievementsBest} maxFontSizeMultiplier={1.3}>{fmtMin(bests.best.active_minutes)}</Text>
          </View>
          <BestRail today={bests.today.active_minutes} best={bests.best.active_minutes} />
        </View>

        <View style={styles.weeklyBlock}>
          <View style={styles.weeklySectionRow}>
            <Text style={styles.weeklySectionLabel}>{t('activity.weeklySteps')}</Text>
            <View style={styles.weeklyHairline} />
            <Text style={styles.weeklyTotal} maxFontSizeMultiplier={1.3}>
              {t('activity.weekTotal', { n: weekTotal.toLocaleString() })}
            </Text>
          </View>
          <WeeklyBarChart data={weekly} goal={dailyGoal} />
        </View>
      </ScrollView>

      {tips.tipElement}
      <MilestoneTakeover item={streakMilestone} onDismiss={() => setStreakMilestone(null)} />
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
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.slate2,
  },
  commanderName: {
    marginTop: 0,
    fontFamily: 'Archivo_900Black',
    // Was 36. The headline no longer has to out-shout the progression block
    // below it, and it names the day rather than the tab.
    fontSize: 30,
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
    color: colors.bone,
  },
  // ── Week track: the header's progression instrument ──
  weekBlock: {
    marginTop: 16,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weekSectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  weekHeaderRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairline,
  },
  streakReadout: {
    flexShrink: 0,
  },
  streakReadoutValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  streakReadoutLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  weekTrack: {
    flexDirection: 'row',
    gap: 4,
  },
  weekCellCol: {
    flex: 1,
    alignItems: 'stretch',
  },
  // A day that fell short is a settled, empty slot — present, but unfilled.
  weekCell: {
    height: 22,
    backgroundColor: colors.ink3,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'flex-end',
  },
  weekCellFuture: {
    backgroundColor: 'transparent',
    borderColor: colors.hairline,
  },
  weekCellCleared: {
    backgroundColor: colors.bone,
    borderColor: colors.bone,
  },
  weekCellToday: {
    borderWidth: 1,
    borderColor: colors.bone,
  },
  weekCellLive: {
    width: '100%',
    backgroundColor: colors.bone2,
  },
  weekCellLabel: {
    marginTop: 5,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate,
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  weekCellLabelToday: {
    fontFamily: fonts.monoMedium,
    color: colors.bone,
  },
  weekCaption: {
    marginTop: 10,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  lifetimeLine: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.bone2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  streakZeroHint: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
    lineHeight: 18,
  },
  streakAtRiskLine: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.caution,
    lineHeight: 18,
  },
  streakSafeLine: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
    lineHeight: 18,
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
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  weeklyHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  weeklyTotal: {
    flexShrink: 0,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  permBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.bone,
    lineHeight: 18,
  },
  // Strong secondary, not red — the screen's one red is the challenge commit
  // CTA. This grant button lives in its own bordered banner and reads as
  // actionable without spending Claim Red.
  permBannerBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.ink3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  permBannerBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  permBannerLink: {
    marginTop: spacing.xs,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  needBanner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink2,
  },
  needBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.bone,
    lineHeight: 18,
  },
  menuErrorBanner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink2,
    gap: spacing.sm,
  },
  menuErrorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone,
    lineHeight: 18,
  },
  menuRetryBtn: {
    backgroundColor: colors.ink3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  menuRetryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeBlock: {
    marginTop: spacing.lg,
  },
  themeBadge: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.bone,
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.1,
  },
  axisChipTextViewing: {
    color: colors.bone,
  },
  axisChipTextLockedOut: {
    color: colors.slate2,
  },
  // Status word replacing the old ●/✕ glyphs: ARMED = the axis that counts
  // today, LOCKED = out of play because the day is committed elsewhere.
  axisChipMeta: {
    marginTop: 3,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  axisChipMetaArmed: {
    color: colors.bone,
  },
  commitBtn: {
    marginBottom: spacing.sm,
    backgroundColor: colors.claimButton,
    paddingVertical: spacing.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  // Was the weakest container on a page of borderless blocks, while being the
  // only live content two days in seven. Now a plate under a solid bone rule:
  // the strongest edge on the screen, and no 1px low-contrast outline.
  attackDayCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.ink2,
    padding: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  attackDayRule: {
    height: 2,
    backgroundColor: colors.bone,
    marginBottom: spacing.xs,
  },
  attackDayTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 20,
    color: colors.bone,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
  },
  attackDayBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
    lineHeight: 18,
  },
  // ── The Attack Day window rail ──
  attackWindow: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.md,
  },
  attackWindowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 7,
  },
  attackWindowLabel: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  attackWindowLeft: {
    flexShrink: 0,
    fontFamily: fonts.monoMedium,
    fontSize: 16,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  // Expiring, not owned — Caution Amber, and only in the final two hours.
  attackWindowLeftClosing: {
    color: colors.caution,
  },
  attackWindowTrack: {
    height: 6,
    width: '100%',
    backgroundColor: colors.hairlineStrong,
    overflow: 'hidden',
  },
  // Spent window, not progress: the fill is what has already gone.
  attackWindowFill: {
    height: '100%',
    backgroundColor: colors.slate,
  },
  attackWindowNotch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.ink,
  },
  attackWindowScale: {
    flexDirection: 'row',
    marginTop: 5,
  },
  attackWindowTick: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  attackWindowTickMid: {
    textAlign: 'center',
  },
  attackWindowTickEnd: {
    textAlign: 'right',
  },
  attackHoldRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.md,
  },
  attackHoldLabel: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  attackHoldValue: {
    flexShrink: 0,
    fontFamily: fonts.monoMedium,
    fontSize: 16,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  // Nothing held yet: the figure recedes and the CTA below carries the row.
  attackHoldValueZero: {
    fontFamily: fonts.mono,
    color: colors.slate,
  },
  attackCta: {
    marginTop: spacing.md,
    backgroundColor: colors.claimButton,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attackCtaText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  challengeSectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
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
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // Mission counter — three discrete segments, one per tier.
  missionTicks: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: spacing.sm,
  },
  missionTick: {
    flex: 1,
    height: 4,
    backgroundColor: colors.hairlineStrong,
  },
  missionTickDone: {
    backgroundColor: colors.bone,
  },
  challengeCard: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  challengeRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    // Reserved so a completed row's bone edge does not shift the text.
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    gap: spacing.sm,
  },
  // Completion is the payoff of the screen: the row settles to the next ink
  // step and takes a solid bone edge. No colour is spent — the ledger mark and
  // the ink step carry it.
  challengeRowDone: {
    backgroundColor: colors.ink3,
    borderLeftColor: colors.bone,
  },
  challengeDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  tierPips: {
    flexDirection: 'row',
    gap: 3,
  },
  tierPip: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
  },
  tierPipOn: {
    backgroundColor: colors.slate2,
    borderColor: colors.slate2,
  },
  tierPipDone: {
    backgroundColor: colors.bone,
    borderColor: colors.bone,
  },
  challengeDifficulty: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeDifficultyDone: {
    color: colors.bone2,
  },
  challengeTask: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.bone,
    lineHeight: 20,
  },
  // Two-tone readout: the live figure is the measurement, the rest is scale.
  // Set large because it is the row's subject, and in mono because it is a
  // measurement — Archivo stays reserved for ceremony.
  readoutLine: {
    marginTop: 2,
    fontFamily: fonts.monoMedium,
    fontSize: 18,
    color: colors.bone,
  },
  readoutCurrent: {
    fontFamily: fonts.monoMedium,
    fontSize: 18,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  readoutTarget: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.slate2,
    letterSpacing: 0.6,
  },
  readoutTierLine: {
    flexShrink: 0,
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: colors.bone,
    letterSpacing: 0.6,
  },
  // ── The gauge ──
  gaugeTrack: {
    width: '100%',
    backgroundColor: colors.hairlineStrong,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: colors.bone2,
  },
  gaugeFillDone: {
    backgroundColor: colors.bone,
  },
  gaugeFillMuted: {
    backgroundColor: colors.slate,
  },
  // A notch cut through the rail where an easier tier's threshold falls.
  gaugeTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.ink,
  },
  challengeReward: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  // Banked, not pending.
  challengeRewardDone: {
    color: colors.bone2,
  },
  challengeRemain: {
    flexShrink: 0,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone2,
    letterSpacing: 1.2,
    lineHeight: 14,
  },
  // Secondary, not Claim Red. This button only appears for the Iron Guard
  // off-axis claim (or dev testing), and on a drill day the screen's one red
  // is already the TRAIN commit — two reds would break the One Claim Rule.
  completeBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.ink3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  securedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  securedMark: {
    width: 7,
    height: 7,
    backgroundColor: colors.bone,
  },
  securedText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    // Bone, not alliance green — a completed challenge is a success state, not
    // an ownership state. The word carries the meaning (Locked Meaning Rule).
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  challengeLocked: {
    flexShrink: 0,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
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
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  achievementsHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
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
  // Headers were 72 wide over values 80 wide, so every column header sat 8px
  // right of the figures it labelled. Both now share COL_W.
  achievementsColToday: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 80,
    textAlign: 'right',
  },
  achievementsColBest: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 80,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  achievementsDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  achievementsLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // Geist Mono, not Archivo: these are measurements, and The Controlling Rule
  // puts every measurement in mono. Archivo is ceremony only.
  achievementsToday: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    color: colors.bone,
    letterSpacing: 0.2,
    width: 80,
    textAlign: 'right',
  },
  // A zero today has nothing to say; a standing record does.
  achievementsZero: {
    fontFamily: fonts.mono,
    color: colors.slate,
  },
  achievementsBest: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.bone2,
    letterSpacing: 0.2,
    width: 80,
    textAlign: 'right',
  },
  bestRailTrack: {
    height: 2,
    width: '100%',
    backgroundColor: colors.hairlineStrong,
    marginBottom: spacing.md,
  },
  bestRailFill: {
    height: '100%',
    backgroundColor: colors.bone2,
  },
  chartWrap: {
    marginTop: spacing.md,
  },
  // A right-hand gutter holds the goal figure so a tall bar can never collide
  // with it, and the plot has an explicit baseline rule so the floor of the
  // chart is a drawn line rather than the point where marks get clipped.
  chartPlot: {
    position: 'relative',
    paddingRight: 40,
  },
  chartCols: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  chartCol: {
    flex: 1,
  },
  chartValueSlot: {
    height: 15,
    justifyContent: 'flex-end',
  },
  chartValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  chartValueToday: {
    fontFamily: fonts.monoMedium,
    color: colors.bone,
  },
  chartBarSlot: {
    height: 76,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    backgroundColor: 'rgba(242,238,230,0.28)',
  },
  chartBarCleared: {
    backgroundColor: colors.bone2,
  },
  chartGoalRule: {
    position: 'absolute',
    left: 0,
    right: 40,
    // The value slot sits above the bars; the rule is measured from the top of
    // the bar area, so it is offset by that slot's height.
    marginTop: 15,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  chartGoalLabel: {
    position: 'absolute',
    right: 0,
    width: 36,
    marginTop: 15,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 0.6,
  },
  chartBaseline: {
    position: 'absolute',
    left: 0,
    right: 40,
    bottom: 0,
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  chartZeroLabel: {
    position: 'absolute',
    right: 0,
    bottom: -7,
    width: 36,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 0.6,
  },
  chartDayRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 40,
  },
  // An axis pointer under today's column: today is identified at the baseline,
  // so the bar heights stay a pure reading of magnitude.
  chartDayMark: {
    height: 2,
    backgroundColor: 'transparent',
  },
  chartDayMarkToday: {
    backgroundColor: colors.bone,
  },
  chartDay: {
    marginTop: 5,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  chartDayWeekend: {
    color: colors.slate,
  },
  chartDayFuture: {
    color: colors.slate,
  },
  chartDayToday: {
    fontFamily: fonts.monoMedium,
    color: colors.bone,
  },
});

