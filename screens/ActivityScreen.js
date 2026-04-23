import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';
import { updateStreakOnChallengeComplete } from '../lib/streak';
import { getLevelForXp } from '../lib/level';
import { colors, fonts, spacing } from '../lib/theme';

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

function WeeklyBarChart({ data, highlightIndex }) {
  const max = Math.max(...data.map((d) => d.steps), 1);
  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartRow}>
        {data.map((d, idx) => {
          const isToday = idx === highlightIndex;
          const h = clamp(d.steps / max, 0, 1) * 80;
          return (
            <View key={d.day} style={styles.chartCol}>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: h,
                      backgroundColor: isToday ? colors.bone : 'rgba(242,238,230,0.16)',
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
  const [currentStreak, setCurrentStreak] = useState(0);
  const [username, setUsername] = useState('');
  const [territoryCount, setTerritoryCount] = useState(0);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [isCompleting, setIsCompleting] = useState(() => new Set());
  const [playerLevel, setPlayerLevel] = useState(getLevelForXp(0));

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
        return;
      }

      setPlayerId(player.id);
      const xp = Math.max(0, Number(player.xp) || 0);
      setPlayerXp(xp);
      setPlayerLevel(getLevelForXp(xp));
      setCurrentStreak(Math.max(0, Number(player.current_streak) || 0));
      setUsername(player.username ?? '');

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
      },
      {
        key: 'medium',
        difficulty: 'Medium',
        task: 'Walk 10,000 steps',
        xp: 120,
        resourceLabel: 'Stone',
        resourceAmount: 20,
      },
      {
        key: 'hard',
        difficulty: 'Hard',
        task: 'Walk 15,000 steps',
        xp: 250,
        resourceLabel: 'Stone',
        resourceAmount: 40,
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
    const prevLevel = getLevelForXp(prevXp);
    const shouldUpdateStreak = completedKeys.size === 0;

    // optimistic UI
    setCompletedKeys((prev) => new Set([...prev, ch.key]));
    setPlayerXp((prev) => Math.max(0, Number(prev) || 0) + ch.xp);
    setPlayerLevel(getLevelForXp(Math.max(0, Number(prevXp) || 0) + ch.xp));

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

      const newXp = Math.max(0, Number(prevXp) || 0) + ch.xp;
      const newLevel = getLevelForXp(newXp);
      if (newLevel.level > prevLevel.level) {
        await supabase.from('players').update({ level: newLevel.level }).eq('id', playerId);
      }

      if (shouldUpdateStreak) {
        await updateStreakOnChallengeComplete(playerId, prevXp);
        const { data: streakRow } = await supabase
          .from('players')
          .select('current_streak')
          .eq('id', playerId)
          .maybeSingle();
        setCurrentStreak(Math.max(0, Number(streakRow?.current_streak) || 0));
      }
    } catch (e) {
      // revert if something goes wrong
      setCompletedKeys((prev) => {
        const next = new Set(prev);
        next.delete(ch.key);
        return next;
      });
      setPlayerXp(prevXp);
      setPlayerLevel(getLevelForXp(prevXp));
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
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Text style={styles.commanderLabel}>{formatToday(today)}</Text>
        <Text style={styles.commanderName}>ACTIVITY</Text>
        <Text style={styles.rankLine}>
          <Text style={styles.rankTitle}>{username || '—'} · {playerLevel.title.toUpperCase()}</Text>
          <Text style={styles.rankSeparator}> · </Text>
          <Text style={styles.rankStreak}>{currentStreak} DAY STREAK</Text>
        </Text>
        <View style={styles.hairlineStrong} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.challengeBlock}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.challengeSectionLabel}>DAILY CHALLENGES</Text>
            <View style={styles.challengeHairline} />
            <Text style={styles.challengeCount}>{completedCount} / 3 DONE</Text>
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
                        +{ch.xp} XP · +{ch.resourceAmount} {ch.resourceLabel}
                      </Text>
                    </View>
                    <View style={styles.challengeAction}>
                      {isDone ? (
                        <Text style={styles.challengeDone}>DONE</Text>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Complete ${ch.difficulty} challenge`}
                          onPress={() => onCompleteChallenge(ch)}
                          disabled={!playerId || isBusy}
                          style={({ pressed }) => [
                            styles.completeBtn,
                            (!playerId || isBusy) && { opacity: 0.45 },
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Text style={styles.completeBtnText}>COMPLETE</Text>
                        </Pressable>
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
            <Text style={styles.achievementsSectionLabel}>DAILY ACHIEVEMENTS</Text>
            <View style={styles.achievementsHairline} />
          </View>

          <View style={styles.achievementsHeaderRow}>
            <Text style={styles.achievementsColLeft} />
            <Text style={styles.achievementsColToday}>TODAY</Text>
            <Text style={styles.achievementsColBest}>BEST</Text>
          </View>

          <View style={styles.achievementsHeaderDivider} />

          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel}>DISTANCE</Text>
            <Text style={styles.achievementsToday}>6.2 km</Text>
            <Text style={styles.achievementsBest}>12.4 km</Text>
          </View>

          <View style={styles.achievementsDivider} />

          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel}>CALORIES BURNT</Text>
            <Text style={styles.achievementsToday}>340 kcal</Text>
            <Text style={styles.achievementsBest}>820 kcal</Text>
          </View>

          <View style={styles.achievementsDivider} />

          <View style={styles.achievementsRow}>
            <Text style={styles.achievementsLabel}>ACTIVE MINUTES</Text>
            <Text style={styles.achievementsToday}>47 min</Text>
            <Text style={styles.achievementsBest}>94 min</Text>
          </View>
        </View>

        <View style={styles.weeklyBlock}>
          <View style={styles.weeklySectionRow}>
            <Text style={styles.weeklySectionLabel}>WEEKLY STEPS</Text>
            <View style={styles.weeklyHairline} />
          </View>
          <WeeklyBarChart data={weekly} highlightIndex={chartHighlightIndex} />
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

