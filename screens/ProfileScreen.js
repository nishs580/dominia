import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getLevelForXp, getXpProgress } from '../lib/level';

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

function OwnedTerritoryRow({ name, tier }) {
  const tierLabel = tier ?? '—';
  return (
    <View style={styles.territoryRow}>
      <View style={styles.territoryLeft}>
        <Text style={styles.territoryName}>{name}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: '#E8F6F1', borderColor: '#C7EADF' }]}>
        <Text style={[styles.statusText, { color: ACCENT }]}>{tierLabel}</Text>
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

function rankLabelForLevel(level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  if (n === 1) return 'Scout';
  if (n === 2) return 'Lv 2 Pathfinder';
  return `Lv ${n}`;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const today = useMemo(() => new Date(), []);
  const { signOut, userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [playerRow, setPlayerRow] = useState(null);
  const [ownedTerritories, setOwnedTerritories] = useState([]);
  const [profileError, setProfileError] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!userId) {
        setPlayerRow(null);
        setOwnedTerritories([]);
        setProfileError('Not signed in.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setProfileError(null);

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, username, level, xp, alliance_id, current_streak, longest_streak')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (playerError) {
        setProfileError(playerError.message ?? 'Could not load profile');
        setPlayerRow(null);
        setOwnedTerritories([]);
        setLoading(false);
        return;
      }

      if (!player) {
        setProfileError('No player record for this account.');
        setPlayerRow(null);
        setOwnedTerritories([]);
        setCurrentStreak(0);
        setLongestStreak(0);
        setLoading(false);
        return;
      }

      setPlayerRow(player);
      setCurrentStreak(Math.max(0, Number(player.current_streak) || 0));
      setLongestStreak(Math.max(0, Number(player.longest_streak) || 0));

      if (player.alliance_id) {
        const { data: allianceRow } = await supabase
          .from('alliances')
          .select('name')
          .eq('id', player.alliance_id)
          .maybeSingle();
        if (!cancelled) setAllianceName(allianceRow?.name ?? null);
      } else {
        if (!cancelled) setAllianceName(null);
      }

      const { data: territories, error: terrError } = await supabase
        .from('territories')
        .select('id, territory_name, tier')
        .eq('owner_id', player.id);

      if (cancelled) return;

      if (terrError) {
        setProfileError(terrError.message ?? 'Could not load territories');
        setOwnedTerritories([]);
      } else {
        setOwnedTerritories(territories ?? []);
      }

      setLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const xp = Math.max(0, Number(playerRow?.xp) || 0);
  const { current, next, progress, xpIntoLevel, xpNeeded } = getXpProgress(xp);
  const xpProgress = progress;
  const xpPct = Math.round(Math.min(progress, 1) * 100);

  const playerName = playerRow?.username ?? '—';
  const rankBadge = current?.title ?? getLevelForXp(xp).title;

  const unlockText = useMemo(() => {
    const title = next?.title;
    if (title === 'Pathfinder') return 'Calorie-burn challenge tier unlocked';
    if (title === 'Claimer') return 'Contest mechanic unlocked';
    if (title === 'Defender') return 'Contest enemy solo territories';
    if (title === 'Commander') return 'Solo phase complete. Alliance eligible at Warlord';
    if (title === 'Warlord') return 'Found or join an Alliance';
    if (title === 'Strategist') return 'Alliance Officer rank eligible';
    if (title === 'Conqueror') return 'Epic territory contests unlocked';
    if (title === 'Sovereign') return 'Alliance Marshal rank eligible';
    if (title === 'Dominator') return 'Realm legend. All mechanics unlocked';
    return 'You have reached the top.';
  }, [next?.title]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>
          {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={ALLIANCE} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      ) : null}

      {!loading && profileError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{profileError}</Text>
        </View>
      ) : null}

      {!loading && playerRow ? (
        <>
          <View style={styles.card}>
            <View style={styles.identityTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{playerName}</Text>
                <View style={styles.identitySubRow}>
                  {allianceName ? <Badge text={allianceName} variant="alliance" /> : null}
                  <Badge text={rankBadge} />
                </View>
              </View>
              <View style={styles.streakPill}>
                <Text style={styles.streakValue}>{currentStreak}</Text>
                <Text style={styles.streakLabel}>day streak</Text>
                <View style={styles.streakDivider} />
                <Text style={styles.streakBest}>Best: {longestStreak}</Text>
              </View>
            </View>

            <View style={styles.identityDivider} />

            <View style={styles.xpTopRow}>
              <Text style={styles.cardTitle}>XP progress</Text>
              <Text style={styles.xpPct}>{xpPct}%</Text>
            </View>
            <Text style={styles.xpLine}>
              <Text style={styles.xpStrong}>{xpIntoLevel}</Text>
              <Text style={styles.xpMuted}> / {xpNeeded} XP</Text>
              <Text style={styles.xpMuted}> • next: </Text>
              <Text style={[styles.xpStrong, { color: ALLIANCE }]}>{next?.title ?? 'Max level'}</Text>
            </Text>

            <ProgressBar progress={xpProgress} tint={ALLIANCE} />

            <View style={styles.unlockCard}>
              <Text style={styles.unlockTitle}>Next: {next?.title ?? 'Dominator'}</Text>
              <Text style={styles.unlockText}>{unlockText}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Territories held" value={String(ownedTerritories.length)} />
            <StatCard label="Total claimed" value="11" />
            <StatCard label="Distance walked" value="47km" />
            <StatCard label="Contests won" value="0" />
          </View>

          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>Your territories</Text>
              <Text style={styles.cardHint}>Tier</Text>
            </View>

            <View style={styles.list}>
              {ownedTerritories.length === 0 ? (
                <Text style={styles.emptyTerritories}>No territories yet. Claim one on the map.</Text>
              ) : null}
              {ownedTerritories.map((t, index) => (
                <React.Fragment key={t.id ?? `${t.territory_name}-${index}`}>
                  {index > 0 ? <View style={styles.listDivider} /> : null}
                  <OwnedTerritoryRow name={t.territory_name ?? 'Territory'} tier={t.tier} />
                </React.Fragment>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>
        <View style={styles.settingsList}>
          <SettingsRow label="Notification settings" />
          <View style={styles.listDivider} />
          <Pressable
            onPress={() => {
              Alert.alert(
                'Sign out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: async () => {
                      await signOut();
                      navigation.replace('SignIn');
                    },
                  },
                ]
              );
            }}
            style={styles.settingsRow}
          >
            <Text style={[styles.settingsLabel, { color: '#E84040' }]}>Sign out</Text>
            <Text style={styles.settingsChevron}>›</Text>
          </Pressable>
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
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTerritories: {
    marginTop: 4,
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
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
  streakDivider: {
    marginTop: 8,
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: '#C7EADF',
  },
  streakBest: {
    marginTop: 8,
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

