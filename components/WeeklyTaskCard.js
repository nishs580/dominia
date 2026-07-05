import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { getWeeklyTask } from '../lib/weeklyTaskApi';
import { formatTaskValue as formatValue, rewardLine } from '../lib/weeklyTaskFormat';

/**
 * Alliance Weekly Task card — the member-facing two-bar surface.
 *
 * Design rule (spec: alliance-weekly-tasks): every member sees exactly two
 * numbers. The ALLIANCE bar carries the tiers (half marker + end of bar);
 * the PERSONAL bar runs 0 → quota (the anchor is the full part, never the
 * floor) with the qualifying floor as a tick that flips to "share earned".
 * At 100% of quota the personal bar collapses to "your part is done". No
 * formula, snapshot or scaling rule is ever explained in-product.
 */

function pct(part, whole) {
  if (!whole || whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

function Bar({ fillPct, markerPct, fillColor }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: fillColor }]} />
      {markerPct != null && markerPct > 0 && markerPct < 100 ? (
        <View style={[styles.marker, { left: `${markerPct}%` }]} />
      ) : null}
    </View>
  );
}

export default function WeeklyTaskCard({ allianceId, getToken }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasLoadedRef = useRef(false);

  const fetchCard = useCallback(async () => {
    if (!allianceId) return;
    if (!hasLoadedRef.current) setLoading(true);
    const res = await getWeeklyTask({
      clerkGetToken: () => getTokenRef.current(),
      allianceId,
    });
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error || 'load_failed');
    }
    hasLoadedRef.current = true;
    setLoading(false);
  }, [allianceId]);

  useFocusEffect(
    useCallback(() => {
      fetchCard();
    }, [fetchCard]),
  );

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.slate2} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.card}>
        <Text style={styles.pendingText}>{t('weeklyTask.loadFailed')}</Text>
        <Pressable onPress={fetchCard} hitSlop={8}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const { task, personal, marches_from: marchesFrom, last_week: lastWeek } = data;

  // Last week's verdict strip — the "collect your share" / result moment.
  const lastWeekStrip = lastWeek ? (
    <View style={styles.lastWeekStrip}>
      <Text style={styles.lastWeekText}>
        {lastWeek.tier === 'none'
          ? t('weeklyTask.lastWeekMissed', { task: t(`weeklyTask.name.${lastWeek.task_type}`) })
          : lastWeek.personal?.rewarded
            ? t('weeklyTask.lastWeekPaid', {
                task: t(`weeklyTask.name.${lastWeek.task_type}`),
                reward: rewardLine(t, lastWeek.personal.payout),
              })
            : t('weeklyTask.lastWeekNoShare', {
                task: t(`weeklyTask.name.${lastWeek.task_type}`),
              })}
      </Text>
    </View>
  ) : null;

  if (!task || data.state !== 'active') {
    return (
      <View style={styles.card}>
        <Text style={styles.pendingText}>{t('weeklyTask.ordersPending')}</Text>
        {lastWeekStrip}
      </View>
    );
  }

  const alliancePct = pct(task.total_progress, task.target);
  const halfMarkerPct = pct(task.half_target, task.target);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.statusLabel}>{t('weeklyTask.ordersLabel')}</Text>
        <Text style={styles.timer}>{t('weeklyTask.daysLeft', { count: task.days_left })}</Text>
      </View>

      <Text style={styles.title}>{t(`weeklyTask.name.${task.task_type}`)}</Text>
      <Text style={styles.desc}>
        {t('weeklyTask.goalLine', {
          target: formatValue(t, task.unit, task.target),
        })}
      </Text>

      {/* Alliance bar — carries the tiers (half marker + end of bar). */}
      <View style={styles.barBlock}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>{t('weeklyTask.allianceBar')}</Text>
          <Text style={styles.barValue}>
            {formatValue(t, task.unit, task.total_progress)}
            <Text style={styles.barTotal}> / {formatValue(t, task.unit, task.target)}</Text>
          </Text>
        </View>
        <Bar fillPct={alliancePct} markerPct={halfMarkerPct} fillColor={colors.alliance} />
        <Text style={styles.halfNote}>
          {t('weeklyTask.halfNote', { half: formatValue(t, task.unit, task.half_target) })}
        </Text>
      </View>

      {/* Personal bar — 0 → quota, floor as a tick. Collapses at 100%. */}
      {personal ? (
        personal.part_done ? (
          <View style={styles.partDoneBlock}>
            <Text style={styles.partDoneText}>{t('weeklyTask.partDone')}</Text>
            <Text style={styles.partDoneSub}>{t('weeklyTask.partDoneSub')}</Text>
          </View>
        ) : (
          <View style={styles.barBlock}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>{t('weeklyTask.personalBar')}</Text>
              <Text style={styles.barValue}>
                {formatValue(t, task.unit, personal.contribution)}
                <Text style={styles.barTotal}> / {formatValue(t, task.unit, personal.quota)}</Text>
              </Text>
            </View>
            <Bar
              fillPct={pct(personal.contribution, personal.quota)}
              markerPct={pct(personal.floor, personal.quota)}
              fillColor={colors.claim}
            />
            <Text style={personal.share_earned ? styles.shareEarnedNote : styles.halfNote}>
              {personal.share_earned
                ? t('weeklyTask.shareEarned')
                : t('weeklyTask.shareAt', {
                    floor: formatValue(t, task.unit, personal.floor),
                  })}
            </Text>
          </View>
        )
      ) : (
        <View style={styles.partDoneBlock}>
          <Text style={styles.marchesFromText}>
            {t('weeklyTask.marchesFrom', { date: marchesFrom ?? '' })}
          </Text>
        </View>
      )}

      <Text style={styles.reward}>
        {t('weeklyTask.rewardLabel')} {rewardLine(t, task.personal_payout)}
      </Text>

      {lastWeekStrip}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    padding: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.alliance,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.alliance,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  timer: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.bone,
    lineHeight: 22,
  },
  desc: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    marginTop: 6,
    lineHeight: 16,
  },

  barBlock: { marginTop: 14 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  barLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  barValue: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.bone },
  barTotal: { fontFamily: fonts.mono, fontSize: 11, color: colors.slate2 },
  track: {
    marginTop: 8,
    height: 6,
    backgroundColor: colors.ink3,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  marker: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 10,
    backgroundColor: colors.bone2,
    opacity: 0.55,
  },
  halfNote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate,
    marginTop: 6,
    letterSpacing: 0.4,
  },
  shareEarnedNote: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    color: colors.alliance,
    marginTop: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  partDoneBlock: { marginTop: 14 },
  partDoneText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.alliance,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  partDoneSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.slate2,
    marginTop: 4,
  },
  marchesFromText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.slate2,
  },

  reward: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginTop: 14,
  },

  pendingText: { fontFamily: fonts.body, fontSize: 12, color: colors.slate2 },
  retryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.claim,
    marginTop: 8,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },

  lastWeekStrip: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: colors.hairline,
  },
  lastWeekText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate2, lineHeight: 16 },
});
