import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#1D9E75';
const BG = '#F6F8F7';
const CARD = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E5E7EB';

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
  const today = useMemo(() => new Date(), []);

  const steps = 6240;
  const stepsGoal = 10000;
  const stepsProgress = steps / stepsGoal;
  const stepsPct = Math.round(clamp(stepsProgress, 0, 1) * 100);
  const distanceKm = (steps * 0.0008).toFixed(2);

  const territoryName = 'Vondelpark';
  const claimDistanceM = 890;
  const walkedSoFarM = 312;
  const claimProgress = walkedSoFarM / claimDistanceM;
  const claimPct = Math.round(clamp(claimProgress, 0, 1) * 100);

  const weekly = [
    { day: 'Mon', steps: 5200 },
    { day: 'Tue', steps: 8300 },
    { day: 'Wed', steps: 6100 },
    { day: 'Thu', steps: 9100 },
    { day: 'Fri', steps: steps },
    { day: 'Sat', steps: 7400 },
    { day: 'Sun', steps: 4600 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <Text style={styles.headerSubtitle}>{formatToday(today)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Today’s steps</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stepsPct}%</Text>
          </View>
        </View>

        <View style={styles.stepsRow}>
          <View style={styles.stepsMetric}>
            <Text style={styles.bigNumber}>{steps.toLocaleString()}</Text>
            <Text style={styles.muted}>steps</Text>
          </View>
          <View style={styles.stepsMeta}>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Distance</Text>
              <Text style={styles.metaValue}> {distanceKm} km</Text>
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Goal</Text>
              <Text style={styles.metaValue}> {stepsGoal.toLocaleString()} steps</Text>
            </Text>
          </View>
        </View>

        <ProgressBar progress={stepsProgress} />
        <View style={styles.progressFooter}>
          <Text style={styles.progressLeft}>{Math.min(steps, stepsGoal).toLocaleString()} / {stepsGoal.toLocaleString()}</Text>
          <Text style={styles.progressRight}>{stepsPct}% complete</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View>
            <Text style={styles.cardTitle}>Active claim</Text>
            <Text style={styles.cardSubtitle}>{territoryName}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{claimPct}%</Text>
          </View>
        </View>

        <View style={styles.claimGrid}>
          <View style={styles.claimItem}>
            <Text style={styles.claimLabel}>Claim distance</Text>
            <Text style={styles.claimValue}>{claimDistanceM}m</Text>
          </View>
          <View style={styles.claimItem}>
            <Text style={styles.claimLabel}>Walked so far</Text>
            <Text style={styles.claimValue}>{walkedSoFarM}m</Text>
          </View>
        </View>

        <ProgressBar progress={claimProgress} />
        <View style={styles.progressFooter}>
          <Text style={styles.progressLeft}>{Math.min(walkedSoFarM, claimDistanceM)}m / {claimDistanceM}m</Text>
          <Text style={styles.progressRight}>{claimPct}% complete</Text>
        </View>
      </View>

      <View style={styles.pillsRow}>
        <StatPill label="Territories" value="3" />
        <StatPill label="Day Streak" value="12" />
        <StatPill label="Siege XP" value="840" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Weekly steps</Text>
          <Text style={styles.cardHint}>Today highlighted</Text>
        </View>
        <WeeklyBarChart data={weekly} highlightIndex={4} />
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
  stepsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepsMetric: {
    flex: 1,
  },
  bigNumber: {
    color: TEXT,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  muted: {
    marginTop: 2,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  stepsMeta: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
  },
  metaLine: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  metaLabel: {
    color: MUTED,
    fontWeight: '700',
  },
  metaValue: {
    color: TEXT,
    fontWeight: '800',
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
  claimGrid: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  claimItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  claimLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  claimValue: {
    marginTop: 6,
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
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

