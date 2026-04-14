import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#1D9E75';
const ALLIANCE = '#534AB7';
const BG = '#F6F8F7';
const CARD = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E5E7EB';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ProgressBar({ progress, tint = ACCENT }) {
  const pct = clamp(progress, 0, 1) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tint }]} />
    </View>
  );
}

function Badge({ text, variant }) {
  const isAlliance = variant === 'alliance';
  const bg = isAlliance ? '#F0EFFF' : '#E8F6F1';
  const border = isAlliance ? '#DAD7FF' : '#C7EADF';
  const color = isAlliance ? ALLIANCE : ACCENT;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TerritoryRow({ name, daysHeld, distanceM, status }) {
  const statusLower = status.toLowerCase();
  const isContested = statusLower === 'contested';
  const pillBg = isContested ? '#FEF3C7' : '#E8F6F1';
  const pillBorder = isContested ? '#FDE68A' : '#C7EADF';
  const pillText = isContested ? '#92400E' : ACCENT;

  return (
    <View style={styles.territoryRow}>
      <View style={styles.territoryLeft}>
        <Text style={styles.territoryName}>{name}</Text>
        <Text style={styles.territoryMeta}>
          Held {daysHeld} day{daysHeld === 1 ? '' : 's'} • {distanceM}m
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
        <Text style={[styles.statusText, { color: pillText }]}>{status}</Text>
      </View>
    </View>
  );
}

function SettingsRow({ label }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={styles.settingsChevron}>›</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const today = useMemo(() => new Date(), []);

  const playerName = 'Jonas K.';
  const allianceName = 'Iron Wolves';
  const rankBadge = 'Lv 2 Pathfinder';
  const streakDays = 12;

  const xp = 840;
  const xpNeeded = 1000;
  const nextLevel = 'Lv 3 Claimer';
  const xpProgress = xp / xpNeeded;
  const xpPct = Math.round(clamp(xpProgress, 0, 1) * 100);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>
          {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.identityTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playerName}>{playerName}</Text>
            <View style={styles.identitySubRow}>
              <Badge text={allianceName} variant="alliance" />
              <Badge text={rankBadge} />
            </View>
          </View>
          <View style={styles.streakPill}>
            <Text style={styles.streakValue}>{streakDays}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>

        <View style={styles.identityDivider} />

        <View style={styles.xpTopRow}>
          <Text style={styles.cardTitle}>XP progress</Text>
          <Text style={styles.xpPct}>{xpPct}%</Text>
        </View>
        <Text style={styles.xpLine}>
          <Text style={styles.xpStrong}>{xp}</Text>
          <Text style={styles.xpMuted}> / {xpNeeded} XP</Text>
          <Text style={styles.xpMuted}> • next: </Text>
          <Text style={[styles.xpStrong, { color: ALLIANCE }]}>{nextLevel}</Text>
        </Text>

        <ProgressBar progress={xpProgress} tint={ALLIANCE} />

        <View style={styles.unlockCard}>
          <Text style={styles.unlockTitle}>Next level unlock</Text>
          <Text style={styles.unlockText}>Contest other players territories</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Territories held" value="3" />
        <StatCard label="Total claimed" value="11" />
        <StatCard label="Distance walked" value="47km" />
        <StatCard label="Contests won" value="0" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Your territories</Text>
          <Text style={styles.cardHint}>Status</Text>
        </View>

        <View style={styles.list}>
          <TerritoryRow name="Keizersgracht" daysHeld={4} distanceM={320} status="Secure" />
          <View style={styles.listDivider} />
          <TerritoryRow name="Jordaan" daysHeld={2} distanceM={420} status="Secure" />
          <View style={styles.listDivider} />
          <TerritoryRow name="Vondelpark" daysHeld={1} distanceM={890} status="Contested" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>
        <View style={styles.settingsList}>
          <SettingsRow label="Notification settings" />
          <View style={styles.listDivider} />
          <SettingsRow label="Sign out" />
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: '900',
    fontSize: 12,
  },
  identityTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  playerName: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  identitySubRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  streakPill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7EADF',
    backgroundColor: '#E8F6F1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 88,
  },
  streakValue: {
    color: ACCENT,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  streakLabel: {
    marginTop: 2,
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  identityDivider: {
    marginTop: 14,
    height: 1,
    backgroundColor: BORDER,
  },
  xpTopRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpPct: {
    color: ALLIANCE,
    fontSize: 12,
    fontWeight: '900',
  },
  xpLine: {
    marginTop: 8,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  xpStrong: {
    color: TEXT,
    fontWeight: '900',
  },
  xpMuted: {
    color: MUTED,
    fontWeight: '700',
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
  },
  unlockCard: {
    marginTop: 12,
    backgroundColor: '#F6F5FF',
    borderWidth: 1,
    borderColor: '#DAD7FF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  unlockTitle: {
    color: ALLIANCE,
    fontSize: 12,
    fontWeight: '900',
  },
  unlockText: {
    marginTop: 6,
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  statsGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statValue: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statLabel: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    marginTop: 12,
  },
  listDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },
  territoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  territoryLeft: {
    flex: 1,
  },
  territoryName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  territoryMeta: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  settingsList: {
    marginTop: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingsLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  settingsChevron: {
    color: MUTED,
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
});

