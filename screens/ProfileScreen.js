import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getLevelForXp, getXpProgress } from '../lib/level';
import { colors, fonts, fontSize, spacing, radius, borders, text } from '../lib/theme';
import { InfluenceGlyph } from '../components/ResourceGlyphs';

const CLAIM = '#D64525';
const INK = '#0E1014';
const INK2 = '#1A1D24';
const INK3 = '#252932';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function SectionDivider({ label }) {
  return (
    <View style={styles.sectionDivider}>
      <View style={styles.sectionDividerLine} />
      <Text style={styles.sectionDividerLabel}>{label}</Text>
      <View style={styles.sectionDividerLine} />
    </View>
  );
}

function OwnedTerritoryRow({ name, tier }) {
  const tierLabel = tier ?? '—';
  return (
    <View style={styles.territoryRow}>
      <Text style={styles.territoryName}>{name}</Text>
      <Text style={styles.territoryTier}>{tierLabel}</Text>
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
  const territoryCap = current?.territoryCap ?? 0;

  const playerName = playerRow?.username ?? '—';
  const rankBadge = current?.title ?? getLevelForXp(xp).title;
  const FAKE_LEGACY_TITLES = [
    { title: 'GROUNDBREAKER', descriptor: 'DAY 32 · 2.3.2026 · 30 TERRITORY-DAYS' },
    { title: 'THE IRON WEEK', descriptor: 'DAY 21 · 21.2.2026 · 21-DAY STREAK' },
    { title: 'FIRST BLOOD', descriptor: 'DAY 1 · 1.2.2026 · FIRST CLAIM IN THE REALM' },
  ];

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
    <View style={styles.screen}>
      {!loading && playerRow ? (
        <View style={styles.headerBlock}>
          <Text style={styles.commanderLabel}>COMMANDER · #0001</Text>
          <Text style={styles.commanderName}>{playerName}</Text>
          <Text style={styles.rankLine}>
            <Text style={styles.rankTitle}>{rankBadge}</Text>
            <Text style={styles.rankSeparator}> · </Text>
            {allianceName ? (
              <Text style={styles.rankAllianceClaim}>{allianceName}</Text>
            ) : (
              <Text style={styles.rankAlliance}>UNAFFILIATED</Text>
            )}
          </Text>
          <View style={styles.hairlineStrong} />
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={SLATE2} />
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
          <View style={styles.influenceBlock}>
            <View style={styles.influenceHeader}>
              <Text style={styles.influenceLabel}>INFLUENCE</Text>
              <View style={styles.influenceHairline} />
            </View>
            <View style={styles.influenceRow}>
              <InfluenceGlyph size={32} color={colors.bone} />
              <View style={styles.influenceTextStack}>
                <Text style={styles.influenceValue}>1,247</Text>
                <Text style={styles.influenceSublabel}>INFLUENCE EARNED</Text>
                <Text style={styles.influenceContext}>From 8 held territories</Text>
              </View>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>STREAK</Text>
              <Text style={styles.statValue}>{currentStreak} days</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>BEST STREAK</Text>
              <Text style={styles.statValue}>{longestStreak} days</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>TERRITORIES</Text>
              <Text style={styles.statValue}>
                {ownedTerritories.length} / {territoryCap}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>SIEGE XP</Text>
              <Text style={styles.statValue}>{xp.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <SectionDivider label="XP PROGRESS" />
            <Text style={styles.xpNumbers}>
              {xpIntoLevel} / {xpNeeded} XP
            </Text>
            <Text style={styles.nextLine}>
              <Text style={styles.nextPrefix}>NEXT · </Text>
              <Text style={styles.nextTitle}>{next?.title ?? 'Max level'}</Text>
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${clamp(xpProgress, 0, 1) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.unlockText}>{unlockText}</Text>
          </View>

          <View>
            <View style={{ marginTop: 24 }}>
              <SectionDivider label="YOUR TERRITORIES" />
            </View>
            <View style={styles.list}>
              {ownedTerritories.length === 0 ? (
                <Text style={styles.emptyText}>No territories held.</Text>
              ) : null}
              {ownedTerritories.map((t, index) => (
                <React.Fragment key={t.id ?? `${t.territory_name}-${index}`}>
                  {index > 0 ? <View style={styles.listDivider} /> : null}
                  <OwnedTerritoryRow name={t.territory_name ?? 'Territory'} tier={t.tier} />
                </React.Fragment>
              ))}
            </View>
          </View>

          <View>
            <View style={{ marginTop: 24 }}>
              <SectionDivider label={`LEGACY TITLES · ${FAKE_LEGACY_TITLES.length}`} />
            </View>
            <View style={styles.legacyList}>
              {FAKE_LEGACY_TITLES.map((t, index) => (
                <View
                  key={`${t.title}-${index}`}
                  style={[styles.legacyEntry, index < FAKE_LEGACY_TITLES.length - 1 ? styles.legacyEntrySpacing : null]}
                >
                  <Text style={styles.legacyTitle}>{t.title}</Text>
                  <Text style={styles.legacyDescriptor}>{t.descriptor}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}

      {!loading ? (
        <View style={[styles.card, { marginTop: 32 }]}>
          <SectionDivider label="SETTINGS" />
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
              <Text style={styles.settingsSignOut}>Sign out</Text>
              <Text style={styles.settingsChevron}>›</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  influenceBlock: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  influenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  influenceLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    letterSpacing: 1.6,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  influenceHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
    marginLeft: spacing.sm,
  },
  influenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  influenceTextStack: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs,
  },
  influenceValue: {
    fontFamily: fonts.displayMedium,
    fontSize: fontSize.xl4,
    letterSpacing: fontSize.xl4 * -0.02,
    color: colors.bone,
  },
  influenceSublabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  influenceContext: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.slate2,
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
    color: SLATE2,
  },
  commanderName: {
    marginTop: 0,
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
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
    color: CLAIM,
  },
  rankSeparator: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  rankAlliance: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  rankAllianceClaim: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: CLAIM,
  },
  hairlineStrong: {
    marginTop: 14,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  errorBanner: {
    marginTop: 8,
    padding: 12,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  card: {
    marginTop: 12,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    padding: 16,
  },
  progressTrack: {
    marginTop: 12,
    height: 2,
    backgroundColor: HAIRLINE_STRONG,
  },
  progressFill: {
    height: '100%',
    backgroundColor: CLAIM,
  },
  unlockText: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE,
  },
  sectionDividerLabel: {
    paddingHorizontal: 8,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.16,
    color: SLATE2,
  },
  xpNumbers: {
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  nextLine: {
    marginTop: 8,
  },
  nextPrefix: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
  },
  nextTitle: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: BONE,
  },
  statGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCell: {
    width: '48.5%',
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.16,
    color: SLATE2,
  },
  statValue: {
    marginTop: 8,
    fontFamily: 'Archivo_700Bold',
    fontSize: 20,
    color: BONE,
    letterSpacing: -0.02,
  },
  list: {
    marginTop: 12,
  },
  listDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
    marginVertical: 10,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  legacyList: {
    marginTop: 12,
  },
  legacyEntry: {},
  legacyEntrySpacing: {
    marginBottom: 20,
  },
  legacyTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.01,
  },
  legacyDescriptor: {
    marginTop: 4,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  territoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  territoryName: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: BONE,
  },
  territoryTier: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  settingsList: {
    marginTop: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingsLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BONE,
  },
  settingsChevron: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 18,
    color: SLATE2,
  },
  settingsSignOut: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: CLAIM,
  },
});

