import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';

const ACCENT = '#1D9E75';
const BG = '#F6F8F7';
const CARD = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E5E7EB';
const MISSION_HEADER = '#0F172A';
const ORANGE = '#FF6B35';

function formatToday(d) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ProgressBar({ progress }) {
  const pct = clamp(progress, 0, 1) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function StatPill({ label, value }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function WeeklyBarChart({ data, highlightIndex }) {
  const max = Math.max(...data.map((d) => d.steps), 1);
  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartRow}>
        {data.map((d, idx) => {
          const isToday = idx === highlightIndex;
          const h = clamp(d.steps / max, 0, 1) * 84;
          return (
            <View key={d.day} style={styles.chartCol}>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: h,
                      backgroundColor: isToday ? ACCENT : '#D1FAE5',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>{d.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const { userId } = useAuth();
  const [playerId, setPlayerId] = useState(null);
  const [playerXp, setPlayerXp] = useState(0);
  const [territoryCount, setTerritoryCount] = useState(0);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [isCompleting, setIsCompleting] = useState(() => new Set());

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayerActivity() {
      if (!userId) {
        setPlayerId(null);
        setPlayerXp(0);
        setTerritoryCount(0);
        setCompletedKeys(new Set());
        return;
      }

      const { data: player } = await supabase
        .from('players')
        .select('id, xp')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (!player?.id) {
        setPlayerId(null);
        setPlayerXp(0);
        setTerritoryCount(0);
        setCompletedKeys(new Set());
        return;
      }

      setPlayerId(player.id);
      setPlayerXp(Math.max(0, Number(player.xp) || 0));

      const { count } = await supabase
        .from('territories')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', player.id);

      if (cancelled) return;
      setTerritoryCount(count ?? 0);

      const { data: challenges } = await supabase
        .from('player_challenges')
        .select('challenge_key')
        .eq('player_id', player.id)
        .eq('date', todayStr);

      if (cancelled) return;
      const next = new Set((challenges ?? []).map((r) => r.challenge_key).filter(Boolean));
      setCompletedKeys(next);
    }

    loadPlayerActivity();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const chartHighlightIndex = useMemo(() => (today.getDay() + 6) % 7, [today]);

  const challenges = useMemo(
    () => [
      {
        key: 'easy',
        difficulty: 'Easy',
        task: 'Walk 5,000 steps',
        xp: 50,
        resourceLabel: 'Stone',
        resourceAmount: 8,
        badgeText: '#3B6D11',
        badgeBg: '#EAF3DE',
        iconBg: '#EAF3DE',
        iconTint: '#3B6D11',
      },
      {
        key: 'medium',
        difficulty: 'Medium',
        task: 'Walk 10,000 steps',
        xp: 120,
        resourceLabel: 'Stone',
        resourceAmount: 20,
        badgeText: '#854F0B',
        badgeBg: '#FAEEDA',
        iconBg: '#FAEEDA',
        iconTint: '#854F0B',
      },
      {
        key: 'hard',
        difficulty: 'Hard',
        task: 'Walk 15,000 steps',
        xp: 250,
        resourceLabel: 'Stone',
        resourceAmount: 40,
        badgeText: '#993C1D',
        badgeBg: '#FAECE7',
        iconBg: '#FAECE7',
        iconTint: '#993C1D',
      },
    ],
    [],
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
    const prevXp = playerXp;

    // optimistic UI
    setCompletedKeys((prev) => new Set([...prev, ch.key]));
    setPlayerXp((prev) => Math.max(0, Number(prev) || 0) + ch.xp);

    try {
      await supabase.from('player_challenges').insert({
        player_id: playerId,
        challenge_key: ch.key,
        date: todayStr,
      });

      await supabase
        .from('players')
        .update({ xp: (Math.max(0, Number(prevXp) || 0) + ch.xp) })
        .eq('id', playerId);
    } catch (e) {
      // revert if something goes wrong
      setCompletedKeys((prev) => {
        const next = new Set(prev);
        next.delete(ch.key);
        return next;
      });
      setPlayerXp(prevXp);
    } finally {
      setIsCompleting((prev) => {
        const next = new Set(prev);
        next.delete(ch.key);
        return next;
      });
    }
  }

  const weekly = [
    { day: 'Mon', steps: 5200 },
    { day: 'Tue', steps: 8300 },
    { day: 'Wed', steps: 6100 },
    { day: 'Thu', steps: 9100 },
    { day: 'Fri', steps: 6240 },
    { day: 'Sat', steps: 7400 },
    { day: 'Sun', steps: 4600 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <Text style={styles.headerSubtitle}>{formatToday(today)}</Text>
      </View>

      <View style={styles.missionCard}>
        <View style={styles.missionHeader}>
          <View style={styles.missionHeaderTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.missionLabel}>Today’s mission</Text>
              <Text style={styles.missionTitle}>Daily Challenges</Text>
            </View>
            <View style={styles.missionPill}>
              <Text style={styles.missionPillText}>{completedCount} / 3 done</Text>
            </View>
          </View>
          <View style={styles.missionProgressTrack}>
            <View style={[styles.missionProgressFill, { width: `${clamp(missionProgress, 0, 1) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.missionBody}>
          {challenges.map((ch, idx) => {
            const isDone = completedKeys.has(ch.key);
            const isBusy = isCompleting.has(ch.key);
            return (
              <View key={ch.key} style={[styles.challengeRow, idx > 0 && styles.challengeRowBorder]}>
                <View
                  style={[
                    styles.challengeIconBox,
                    { backgroundColor: isDone ? '#E7F6EF' : ch.iconBg, borderColor: isDone ? '#BFE9D5' : BORDER },
                  ]}
                >
                  <View style={[styles.challengeDot, { backgroundColor: isDone ? '#1D9E75' : ch.iconTint }]} />
                </View>

                <View style={styles.challengeMain}>
                  <View style={styles.challengeTopLine}>
                    <View style={[styles.difficultyBadge, { backgroundColor: ch.badgeBg }]}>
                      <Text style={[styles.difficultyBadgeText, { color: ch.badgeText }]}>{ch.difficulty}</Text>
                    </View>
                    <Text style={styles.challengeTask}>{ch.task}</Text>
                  </View>

                  <Text style={styles.challengeReward} numberOfLines={1}>
                    +{ch.xp} XP · +{ch.resourceAmount} {ch.resourceLabel}
                  </Text>
                </View>

                <View style={styles.challengeRight}>
                  {isDone ? (
                    <View style={styles.doneCircle}>
                      <Text style={styles.doneCheck}>✓</Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Complete ${ch.difficulty} challenge`}
                      onPress={() => onCompleteChallenge(ch)}
                      disabled={!playerId || isBusy}
                      style={({ pressed }) => [
                        styles.completeBtn,
                        (!playerId || isBusy) && { opacity: 0.55 },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.completeBtnText}>Complete</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.pillsRow}>
        <StatPill label="Territories" value={String(territoryCount)} />
        <StatPill label="Day Streak" value="12" />
        <StatPill label="Siege XP" value={String(playerXp)} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Weekly steps</Text>
          <Text style={styles.cardHint}>Today highlighted</Text>
        </View>
        <WeeklyBarChart data={weekly} highlightIndex={chartHighlightIndex} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    marginTop: 4,
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardSubtitle: {
    marginTop: 3,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  cardHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
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
    color: ACCENT,
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
    backgroundColor: ACCENT,
  },
  progressFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLeft: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  progressRight: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
  },
  missionCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
    overflow: 'hidden',
  },
  missionHeader: {
    backgroundColor: MISSION_HEADER,
    padding: 14,
    paddingRight: 14,
  },
  missionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  missionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  missionTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  missionPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  missionPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  missionProgressTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  missionProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: ORANGE,
  },
  missionBody: {
    paddingVertical: 6,
  },
  challengeRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  challengeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  challengeMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  challengeTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  difficultyBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  challengeTask: {
    flex: 1,
    minWidth: 0,
    color: TEXT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  challengeReward: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  challengeRight: {
    width: 90,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  completeBtn: {
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 90,
    flexShrink: 0,
    alignItems: 'center',
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  doneCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: -1,
  },
  pillsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  pillValue: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  pillLabel: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  chartWrap: {
    marginTop: 12,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
    paddingVertical: 6,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartBarTrack: {
    height: 92,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  chartDay: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  chartDayToday: {
    color: ACCENT,
  },
});

