import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { getWeeklyTask } from '../lib/weeklyTaskApi';
import { formatInt, formatTaskValue as formatValue, rewardLine } from '../lib/weeklyTaskFormat';
import { allianceCardModel } from '../lib/missions';
import { CutCard } from './ui';

/**
 * Alliance Weekly Task card — the member-facing two-bar surface.
 *
 * Design rule (spec: alliance-weekly-tasks): every member sees exactly two
 * numbers. The ALLIANCE bar carries the tiers (half marker + end of bar);
 * the PERSONAL bar runs 0 → quota (the anchor is the full part, never the
 * floor) with the qualifying floor as a tick that flips to "share earned".
 * At 100% of quota the personal bar collapses to "your part is done". No
 * formula, snapshot or scaling rule is ever explained in-product.
 *
 * variant="mission" is the Missions-tab card (Dominia-Temp board 30): task
 * name, RESETS IN, the goal line, "12 km / 100 km" and one two-tone bar
 * splitting the alliance total into teammates and you. Same API data; only
 * the presentation differs.
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

/** Progress figure without its unit ("12"), matching formatValue's scale. */
function progressFigure(unit, value) {
  if (unit === 'm') return String(Math.round((value / 1000) * 10) / 10);
  return formatInt(value);
}

function MissionShell({ children, accessibilityLabel }) {
  return (
    <CutCard padding={0} accessibilityLabel={accessibilityLabel} style={styles.missionShell}>
      <View style={styles.missionRule} />
      <View style={styles.missionInner}>{children}</View>
    </CutCard>
  );
}

// Board 30: lime left rule, task name + RESETS IN, goal line, metric label
// with "12 km / 100 km", a two-tone bar (teammates grey, you lime) and the
// legend. Teammates = total_progress − personal.contribution.
function MissionCard({ t, data, allianceName }) {
  const m = allianceCardModel(data);
  if (m.state !== 'active') {
    return (
      <MissionShell>
        <Text style={styles.pendingText}>{t('weeklyTask.ordersPending')}</Text>
      </MissionShell>
    );
  }
  const name = t(`weeklyTask.name.${m.taskType}`);
  const target = formatValue(t, m.unit, m.target);
  const goal = t('weeklyTask.goalLine', { target });
  const resets = t('weeklyTask.daysLeft', { count: m.daysLeft });
  const metric = t(m.metric.key, { defaultValue: m.metric.defaultValue });
  const half = t('missions.allianceHalf', {
    defaultValue: 'Half reward at {{half}}',
    half: formatValue(t, m.unit, m.halfTarget),
  });
  const teammatesLabel = t('missions.allianceTeammates', { defaultValue: 'Teammates contribution' });
  const yoursLabel = t('missions.allianceYours', { defaultValue: 'Your contribution' });
  const progressText = `${progressFigure(m.unit, m.progress)} / ${target}`;
  return (
    <MissionShell
      accessibilityLabel={t('missions.allianceCardA11yV2', {
        defaultValue: '{{name}}{{alliance}}. {{goal}} {{resets}}. {{metric}} {{progress}}. {{teammatesLabel}} {{teammates}}, {{yoursLabel}} {{yours}}. {{half}}.',
        name,
        alliance: allianceName ? `, ${allianceName}` : '',
        goal,
        resets,
        metric,
        progress: progressText,
        teammatesLabel,
        teammates: formatValue(t, m.unit, m.teammates),
        yoursLabel,
        yours: formatValue(t, m.unit, m.yours),
        half,
      })}
    >
      <View style={styles.missionHead}>
        <Text style={styles.missionTitle} maxFontSizeMultiplier={1.3} numberOfLines={2}>{name}</Text>
        <Text style={styles.missionResets} maxFontSizeMultiplier={1.3}>{resets}</Text>
      </View>
      <Text style={styles.missionGoal} maxFontSizeMultiplier={1.4}>{goal}</Text>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel} maxFontSizeMultiplier={1.3}>{metric}</Text>
        <Text style={styles.metricValue} maxFontSizeMultiplier={1.3}>
          {formatValue(t, m.unit, m.progress)}
          <Text style={styles.metricTotal}>{` / ${target}`}</Text>
        </Text>
      </View>
      <View style={styles.splitTrack}>
        <View style={[styles.splitTeam, { width: `${m.teammatesFraction * 100}%` }]} />
        <View style={[styles.splitYours, { width: `${m.yoursFraction * 100}%` }]} />
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText} maxFontSizeMultiplier={1.3}>{half}</Text>
        <View style={styles.legendItem}>
          <Text style={styles.legendText} maxFontSizeMultiplier={1.3}>{teammatesLabel}</Text>
          <View style={[styles.swatch, styles.swatchTeam]} />
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendText} maxFontSizeMultiplier={1.3}>{yoursLabel}</Text>
          <View style={[styles.swatch, styles.swatchYours]} />
        </View>
      </View>
    </MissionShell>
  );
}

export default function WeeklyTaskCard({ allianceId, getToken, variant, allianceName }) {
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

  const Shell = variant === 'mission' ? MissionShell : View;
  const shellProps = variant === 'mission' ? {} : { style: styles.card };

  if (loading) {
    return (
      <Shell {...shellProps}>
        <ActivityIndicator color={colors.slate2} />
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell {...shellProps}>
        <Text style={styles.pendingText}>{t('weeklyTask.loadFailed')}</Text>
        <Pressable onPress={fetchCard} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </Shell>
    );
  }

  if (variant === 'mission') {
    return <MissionCard t={t} data={data} allianceName={allianceName} />;
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
              fillColor={colors.lime}
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
    fontSize: 11,
    color: colors.alliance,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  timer: {
    fontFamily: fonts.mono,
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
    color: colors.slate,
    marginTop: 6,
    letterSpacing: 0.4,
  },
  shareEarnedNote: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
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
    fontSize: 11,
    color: colors.slate2,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginTop: 14,
  },

  pendingText: { fontFamily: fonts.body, fontSize: 12, color: colors.slate2 },
  retryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.lime,
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

  // ── variant="mission" (Dominia-Temp board 30) ──
  missionShell: { flexDirection: 'row' },
  missionRule: { width: 3, backgroundColor: colors.lime },
  missionInner: { flex: 1, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  missionHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  missionTitle: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  missionResets: {
    marginTop: 3,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  missionGoal: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted2 },
  metricRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricLabel: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  metricValue: { fontFamily: fonts.mono, fontSize: 18, color: colors.white },
  metricTotal: { fontFamily: fonts.body, fontSize: 13, color: colors.muted2 },
  splitTrack: {
    marginTop: 10,
    height: 8,
    flexDirection: 'row',
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  splitTeam: { height: '100%', backgroundColor: 'rgba(253,253,253,0.7)' },
  splitYours: { height: '100%', backgroundColor: colors.lime },
  legend: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.body, fontSize: 11, color: colors.muted2 },
  swatch: { width: 8, height: 8 },
  swatchTeam: { backgroundColor: 'rgba(253,253,253,0.7)' },
  swatchYours: { backgroundColor: colors.lime },
});
