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
  readRecords,
} from 'react-native-health-connect';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { completeChallenge as backendCompleteChallenge } from '../lib/challengeApi';
import { fetchActivityBests } from '../lib/activityBestsApi';
import { loadPlayerStride } from '../lib/claim';
import { showCard } from '../lib/notifications/cardController';
import { calcLevel, getLevelTitle, calcResourceEarn } from '../lib/formulas';
import { STEPS_READ_PERM, hasForegroundStepsRead } from '../lib/healthConnect';
import * as activityProducer from '../lib/activity';

function levelFromXp(xp) {
  const xpInt = Math.max(0, Math.floor(Number(xp) || 0));
  const level = calcLevel(xpInt);
  return { level, title: getLevelTitle(level) };
}
import { colors, fonts, spacing } from '../lib/theme';

const DEV_MODE_MANUAL = false; // set true to show COMPLETE buttons for manual testing

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
  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [permRequesting, setPermRequesting] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [strideM, setStrideM] = useState(0.75);
  // Daily Achievements: today's totals + all-time best single-day totals,
  // aggregated server-side from accepted activity_samples. Distance today is
  // shown from on-device steps × stride (live); everything else comes from here.
  const [bests, setBests] = useState({
    today: { distance_m: 0, active_minutes: 0 },
    best: { distance_m: 0, active_minutes: 0 },
  });
  const [weeklySteps, setWeeklySteps] = useState(() =>
    weekDayLabels.map((d) => ({ day: d, steps: 0 })),
  );
  const pollRef = useRef(null);
  const inFlightTiersRef = useRef(new Set());
  // Challenges the backend has rejected this session because its accepted
  // daily_steps total is still under threshold (a deterministic 403). Maps
  // ch.key -> the liveSteps reading when it was rejected, so the auto-complete
  // effect won't re-attempt until the player has actually walked further.
  // Without this, the effect re-fires on every completedKeys/isCompleting
  // toggle and floods the backend with identical, doomed requests.
  const blockedKeysRef = useRef(new Map());

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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

      const [terrResult, challengeResult] = await Promise.all([
        supabase.from('territories').select('id', { count: 'exact', head: true }).eq('owner_id', player.id),
        supabase.from('player_challenges').select('challenge_key').eq('player_id', player.id).eq('date', todayStr),
      ]);
      if (cancelled) return;
      setTerritoryCount(terrResult.count ?? 0);
      const next = new Set((challengeResult.data ?? []).map((r) => r.challenge_key).filter(Boolean));
      setCompletedKeys(next);
      setChallengesLoaded(true);
    }

    loadPlayerActivity();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      } catch (e) {
        console.warn('[HC] init failed:', e?.message ?? e);
      }
    }
    bootHC();
    return () => { cancelled = true; };
  }, []);

  const challenges = useMemo(
    () => [
      {
        key: 'easy',
        difficulty: t('activity.diffEasy'),
        task: t('activity.taskEasy'),
        xp: 50,
        earnKey: 'easy_step_challenge',
        target: 5000,
      },
      {
        key: 'medium',
        difficulty: t('activity.diffMedium'),
        task: t('activity.taskMedium'),
        xp: 150,
        earnKey: 'medium_step_challenge',
        target: 10000,
      },
      {
        key: 'hard',
        difficulty: t('activity.diffHard'),
        task: t('activity.taskHard'),
        xp: 400,
        earnKey: 'hard_step_challenge',
        target: 15000,
      },
    ],
    [t],
  );

  const completedCount = useMemo(() => {
    let n = 0;
    for (const c of challenges) if (completedKeys.has(c.key)) n += 1;
    return n;
  }, [challenges, completedKeys]);

  const missionProgress = completedCount / 3;

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
        tier: ch.key,
        earnKey: ch.earnKey,
      });

      if (!result.ok) {
        // Revert optimistic UI.
        console.log('[onCompleteChallenge] backend failed', result.status, result.error);
        // A 403 here is the under-threshold gate: the backend's accepted
        // daily_steps total is below this tier's target even after we flushed.
        // It's deterministic, so block auto-retries until liveSteps grows —
        // otherwise the auto-complete effect spins on it forever.
        if (result.status === 403) {
          blockedKeysRef.current.set(ch.key, liveSteps);
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

      // Completion forced a full-day flush, so today's distance/active-minutes
      // moved server-side — refresh the achievements panel (fire-and-forget).
      loadBests();

      // Sync UI to authoritative backend state.
      const d = result.data;
      setPlayerXp(d.total_xp);
      setPlayerLevel(levelFromXp(d.total_xp));
      setCurrentStreak(d.streak.current);

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
      const result = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const total = (result?.records ?? []).reduce(
        (s, r) => s + (Number(r?.count) || 0),
        0,
      );
      setLiveSteps(total);
    } catch (e) {
      console.warn('[HC] read failed:', e?.message ?? e);
    }
  }, [hcReady, hasStepsPerm]);

  const readWeeklySteps = useCallback(async () => {
    if (!hcReady || !hasStepsPerm) return;
    try {
      const end = new Date();
      const start = startOfLocalDay();
      start.setDate(start.getDate() - 6);

      const result = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });

      const buckets = {};
      for (const r of result?.records ?? []) {
        const t = r?.startTime ?? r?.endTime;
        if (!t) continue;
        const key = localDayKey(new Date(t));
        buckets[key] = (buckets[key] || 0) + (Number(r?.count) || 0);
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
        const { strideM: m } = await loadPlayerStride(playerId);
        if (!cancelled && Number.isFinite(m) && m > 0) setStrideM(m);
      } catch (e) {
        console.warn('[activity] loadPlayerStride failed:', e?.message ?? e);
      }
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  const loadBests = useCallback(async () => {
    const result = await fetchActivityBests({ clerkGetToken: getToken });
    if (result.ok) setBests(result.data);
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      if (!hcReady || !hasStepsPerm) return;
      readTodaySteps();
      readWeeklySteps();
      loadBests();
      pollRef.current = setInterval(readTodaySteps, 10000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      };
    }, [hcReady, hasStepsPerm, readTodaySteps, readWeeklySteps, loadBests]),
  );

  async function handleRequestStepsPerm() {
    if (!hcReady || permRequesting) return;
    setPermRequesting(true);
    try {
      await requestPermission([STEPS_READ_PERM]);
      const granted = await getGrantedPermissions();
      const hasIt = hasForegroundStepsRead(granted);
      setHasStepsPerm(hasIt);
      if (hasIt) activityProducer.onPermissionGranted();
    } catch (e) {
      console.warn('[HC] permission request failed:', e?.message ?? e);
    } finally {
      setPermRequesting(false);
    }
  }

  useEffect(() => {
    if (!playerId || !hasStepsPerm || !challengesLoaded) return;
    (async () => {
      for (const ch of challenges) {
        if (liveSteps < ch.target) continue;
        if (completedKeys.has(ch.key)) continue;
        if (inFlightTiersRef.current.has(ch.key)) continue;
        if (isCompleting.has(ch.key)) continue;
        // Skip a challenge the backend already rejected as under-threshold
        // until the player has walked further than when it was rejected. Each
        // time liveSteps grows we allow one more attempt (re-blocking at the
        // higher count if it 403s again), so retries track real progress
        // instead of hammering a doomed request.
        const blockedAt = blockedKeysRef.current.get(ch.key);
        if (blockedAt != null && liveSteps <= blockedAt) continue;
        inFlightTiersRef.current.add(ch.key);
        try {
          await onCompleteChallenge(ch);
        } finally {
          inFlightTiersRef.current.delete(ch.key);
        }
      }
    })();
  }, [liveSteps, playerId, hasStepsPerm, challenges, completedKeys, isCompleting, challengesLoaded]);

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
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Text style={styles.commanderLabel}>{formatToday(today, i18n.language)}</Text>
        <Text style={styles.commanderName}>{t('activity.title')}</Text>
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
        {hcReady && !hasStepsPerm ? (
          <View style={styles.permBanner}>
            <Text style={styles.permBannerLabel}>{t('activity.permLabel')}</Text>
            <Text style={styles.permBannerText}>
              {t('activity.permText')}
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
          </View>
        ) : null}

        <View style={styles.challengeBlock}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.challengeSectionLabel}>{t('activity.dailyChallenges')}</Text>
            <View style={styles.challengeHairline} />
            <Text style={styles.challengeCount}>{t('activity.doneCount', { n: completedCount })}</Text>
          </View>

          <View style={styles.challengeProgressTrack}>
            <View style={[styles.challengeProgressFill, { width: `${clamp(missionProgress, 0, 1) * 100}%` }]} />
          </View>

          <View style={styles.challengeCard}>
            {challenges.map((ch, idx) => {
              const isDone = completedKeys.has(ch.key);
              const isBusy = isCompleting.has(ch.key);
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
                          const parts = [];
                          parts.push(t('activity.rewardXp', { n: ch.xp }));
                          if (r.stone > 0) parts.push(t('activity.rewardStone', { n: r.stone }));
                          if (r.iron > 0) parts.push(t('activity.rewardIron', { n: r.iron }));
                          if (r.gold > 0) parts.push(t('activity.rewardGold', { n: r.gold }));
                          if (r.morale > 0) parts.push(t('activity.rewardMorale', { n: r.morale }));
                          return parts.join(' · ');
                        })()}
                      </Text>
                    </View>
                    <View style={styles.challengeAction}>
                      {isDone ? (
                        <Text style={styles.challengeDone}>{t('activity.done')}</Text>
                      ) : DEV_MODE_MANUAL ? (
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
                      ) : (
                        <Text style={styles.challengeProgress}>
                          {Math.min(liveSteps, ch.target).toLocaleString()} / {ch.target.toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        <View style={styles.achievementsBlock}>
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
            <Text style={styles.achievementsToday}>{fmtKm(liveSteps * strideM)}</Text>
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
  challengeBlock: {
    marginTop: spacing.lg,
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

