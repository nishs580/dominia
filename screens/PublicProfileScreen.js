// Screen: PublicProfileScreen — read-only view of ANOTHER player's profile.
// Reached by tapping a player in chat, the leaderboards, or the alliance roster.
// Mirrors ProfileScreen's layout (power / influence / stats / XP / territories /
// medals) but keyed by player id instead of clerk_id, with no self-only controls
// (avatar edit, wallet, settings, sign-out) and no management actions — member
// management stays in the alliance roster's long-press modal.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { avatarThumb } from '../lib/avatar';
import {
  calcLevel,
  calcLevelProgress,
  getLevelTitle,
  LEVEL_XP_FLOORS,
  calcDailyInfluence,
  calcTerritoryPower,
  calcFullValueCap,
  calcTerritoryCapForLevel,
  calcMedalPower,
  calcActivityPower,
} from '../lib/formulas';
import { colors, fonts, fontSize, spacing } from '../lib/theme';
import { InfluenceGlyph } from '../components/ResourceGlyphs';
import LegacyMedalsSection from '../components/medals/LegacyMedalsSection';
import { fetchLegacyMedals } from '../lib/legacyMedalsApi';

const CLAIM = '#D64525';
const INK = '#0E1014';
const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function territoryCapForLevel(level) {
  const lv = Math.min(10, Math.max(1, level | 0));
  return calcTerritoryCapForLevel(lv);
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

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { getToken } = useAuth();

  const playerId = route.params?.playerId ?? null;
  const seedUsername = route.params?.username ?? null;
  const seedAvatarUrl = route.params?.avatarUrl ?? null;

  const [loading, setLoading] = useState(true);
  const [playerRow, setPlayerRow] = useState(null);
  const [ownedTerritories, setOwnedTerritories] = useState([]);
  const [profileError, setProfileError] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [activityPower, setActivityPower] = useState(0);
  const [medals, setMedals] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!playerId) {
        setProfileError(t('publicProfile.errNoPlayer'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setProfileError(null);
      setActivityPower(0);

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, username, level, xp, alliance_id, current_streak, longest_streak, lifetime_contest_wins, lifetime_defence_wins, avatar_url')
        .eq('id', playerId)
        .maybeSingle();

      if (cancelled) return;

      if (playerError) {
        setProfileError(playerError.message ?? t('publicProfile.errCouldNotLoad'));
        setPlayerRow(null);
        setOwnedTerritories([]);
        setActivityPower(0);
        setLoading(false);
        return;
      }

      if (!player) {
        setProfileError(t('publicProfile.errNoPlayer'));
        setPlayerRow(null);
        setOwnedTerritories([]);
        setActivityPower(0);
        setCurrentStreak(0);
        setLongestStreak(0);
        setLoading(false);
        return;
      }

      setPlayerRow(player);
      setCurrentStreak(Math.max(0, Number(player.current_streak) || 0));
      setLongestStreak(Math.max(0, Number(player.longest_streak) || 0));

      const [allianceResult, territoriesResult] = await Promise.all([
        player.alliance_id
          ? supabase.from('alliances').select('name').eq('id', player.alliance_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('territories').select('id, territory_name, tier, development_level, legacy_rank, upkeep_overdue').eq('owner_id', player.id),
      ]);

      if (cancelled) return;
      setAllianceName(allianceResult.data?.name ?? null);
      if (territoriesResult.error) {
        setOwnedTerritories([]);
      } else {
        setOwnedTerritories(territoriesResult.data ?? []);
      }

      const { data, error } = await supabase.rpc('get_activity_stats_30d', {
        p_player_id: player.id,
      });
      if (cancelled) return;
      if (error) {
        console.warn('[PublicProfile] activity stats fetch failed:', error);
      } else if (data && data.length > 0) {
        const stats = data[0];
        const power = calcActivityPower({
          xp30d: Number(stats.xp_30d) || 0,
          km30d: Number(stats.km_30d) || 0,
          challenges30d: Number(stats.challenges_30d) || 0,
          contests30d: Number(stats.contests_30d) || 0,
        });
        setActivityPower(power);
      }

      setLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  // Honor Medals — drives Legacy Power. Fetched for the viewed player.
  useEffect(() => {
    if (!playerId) {
      setMedals(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetchLegacyMedals({ clerkGetToken: getToken, playerId });
      if (!cancelled && res.ok) setMedals(res.data.medals);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const xp = Math.max(0, Number(playerRow?.xp) || 0);
  const xpInt = Math.floor(xp);
  const level = calcLevel(xpInt);
  const progress = calcLevelProgress(xpInt);
  const xpFloor = LEVEL_XP_FLOORS[level - 1] ?? 0;
  const xpIntoLevel = level >= 10 ? xpInt - (LEVEL_XP_FLOORS[9] ?? 0) : xpInt - xpFloor;
  const xpNeeded = level >= 10 ? 0 : (LEVEL_XP_FLOORS[level] ?? 0) - xpFloor;
  const xpProgress = progress;
  const territoryCap = territoryCapForLevel(level);
  const fullValueCap = calcFullValueCap({
    level,
    isUnbrokenStreak: currentStreak >= 30 && currentStreak < 60,
    isLegendaryStreak: currentStreak >= 60,
    isAllianceChampion: false,
    isUnbrokenTogetherTier: false,
  });

  const territoryPower = calcTerritoryPower(
    ownedTerritories.map(terr => ({
      tier: terr.tier ? terr.tier.charAt(0).toUpperCase() + terr.tier.slice(1) : 'Small',
      developmentLevel: terr.development_level ?? 0,
      legacyRank: terr.legacy_rank ?? 1,
    })),
    fullValueCap
  );
  const lifetimeContestWins = Math.max(0, Number(playerRow?.lifetime_contest_wins) || 0);

  const legacyPower = calcMedalPower(medals);
  const totalPower = activityPower + territoryPower + legacyPower;

  const playerName = playerRow?.username ?? seedUsername ?? '—';
  const rankBadge = getLevelTitle(level);
  const next = level < 10 ? { title: getLevelTitle(level + 1) } : null;

  const unlockText = useMemo(() => {
    const title = next?.title;
    if (title === 'Pathfinder') return t('profile.unlock.pathfinder');
    if (title === 'Claimer') return t('profile.unlock.claimer');
    if (title === 'Defender') return t('profile.unlock.defender');
    if (title === 'Commander') return t('profile.unlock.commander');
    if (title === 'Warlord') return t('profile.unlock.warlord');
    if (title === 'Strategist') return t('profile.unlock.strategist');
    if (title === 'Conqueror') return t('profile.unlock.conqueror');
    if (title === 'Sovereign') return t('profile.unlock.sovereign');
    if (title === 'Dominator') return t('profile.unlock.dominator');
    return t('profile.unlock.top');
  }, [next?.title, t]);

  const avatarUrl = playerRow?.avatar_url ?? seedAvatarUrl ?? null;
  const avatarInitials =
    playerName && playerName !== '—' ? playerName.slice(0, 2).toUpperCase() : '??';

  return (
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('publicProfile.back')}
          hitSlop={12}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>{t('publicProfile.back')}</Text>
        </Pressable>

        <View style={styles.headerTopRow}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarThumb(avatarUrl, 72) }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{avatarInitials}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.commanderLabel}>{t('publicProfile.commanderLabel')}</Text>
            <Text style={styles.commanderName}>{playerName}</Text>
            <Text style={styles.rankLine}>
              <Text style={styles.rankTitle}>{t('levelTitle.' + rankBadge)}</Text>
              <Text style={styles.rankSeparator}> · </Text>
              {allianceName ? (
                <Text style={styles.rankAllianceClaim}>{allianceName}</Text>
              ) : (
                <Text style={styles.rankAlliance}>{t('profile.unaffiliated')}</Text>
              )}
            </Text>
          </View>
        </View>
        <View style={styles.hairlineStrong} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={SLATE2} />
            <Text style={styles.loadingText}>{t('publicProfile.loading')}</Text>
          </View>
        ) : null}

        {!loading && profileError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{profileError}</Text>
          </View>
        ) : null}

        {!loading && playerRow ? (
          <>
            <View style={styles.powerSection}>
              <View style={styles.influenceHeader}>
                <Text style={styles.influenceLabel}>{t('profile.power')}</Text>
                <View style={styles.influenceHairline} />
              </View>
              <View style={styles.powerHeroBlock}>
                <Text style={styles.powerValue}>{totalPower.toLocaleString()}</Text>
                <Text style={styles.influenceSublabel}>{t('profile.totalPower')}</Text>
              </View>
              <View style={styles.powerHeroDivider} />
              <View style={styles.powerRow}>
                <View style={styles.powerRowLeft}>
                  <Text style={styles.powerRowLabel}>{t('profile.activityPower')}</Text>
                  <Text style={styles.powerRowReason}>{t('profile.activityPowerReason')}</Text>
                </View>
                <Text style={styles.powerRowValueLive}>{activityPower.toLocaleString()}</Text>
              </View>
              <View style={styles.powerRowDivider} />
              <View style={styles.powerRow}>
                <View style={styles.powerRowLeft}>
                  <Text style={styles.powerRowLabel}>{t('profile.territoryPower')}</Text>
                  <Text style={styles.powerRowReason}>
                    {t('profile.territoryReason', { terr: t('profile.territories', { count: ownedTerritories.length }), cap: fullValueCap })}
                  </Text>
                </View>
                <Text style={styles.powerRowValueLive}>{territoryPower.toLocaleString()}</Text>
              </View>
              <View style={styles.powerRowDivider} />
              <View style={styles.powerRow}>
                <View style={styles.powerRowLeft}>
                  <Text style={styles.powerRowLabel}>{t('profile.legacyPower')}</Text>
                  <Text style={styles.powerRowReason}>
                    {t('profile.legacyReason', { wins: t('profile.contestWins', { count: lifetimeContestWins }), streak: t('profile.streakDays', { count: longestStreak }) })}
                  </Text>
                </View>
                <Text style={styles.powerRowValueLive}>{legacyPower.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.influenceBlock}>
              <View style={styles.influenceHeader}>
                <Text style={styles.influenceLabel}>{t('profile.influence')}</Text>
                <View style={styles.influenceHairline} />
              </View>
              <View style={styles.influenceRow}>
                <InfluenceGlyph size={32} color={colors.bone} />
                <View style={styles.influenceTextStack}>
                  <Text style={styles.influenceValue}>
                    {(() => {
                      const total = ownedTerritories.reduce((sum, terr) => {
                        const tier = terr.tier
                          ? terr.tier.charAt(0).toUpperCase() + terr.tier.slice(1)
                          : 'Small';
                        try {
                          return sum + calcDailyInfluence({
                            tier,
                            developmentLevel: terr.development_level ?? 0,
                            legacyRank: terr.legacy_rank ?? 1,
                            upkeepOverdue: terr.upkeep_overdue ?? false,
                          });
                        } catch {
                          return sum;
                        }
                      }, 0);
                      return total % 1 === 0 ? total.toLocaleString() : total.toFixed(1);
                    })()}
                  </Text>
                  <Text style={styles.influenceSublabel}>{t('profile.influencePerDay')}</Text>
                  <Text style={styles.influenceContext}>
                    {t('profile.influenceContext', { count: ownedTerritories.length })}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.statGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('profile.streak')}</Text>
                <Text style={styles.statValue}>{t('profile.daysValue', { n: currentStreak })}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('profile.bestStreak')}</Text>
                <Text style={styles.statValue}>{t('profile.daysValue', { n: longestStreak })}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('profile.territoriesLabel')}</Text>
                <Text style={styles.statValue}>
                  {ownedTerritories.length} / {territoryCap}
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('profile.siegeXp')}</Text>
                <Text style={styles.statValue}>{xp.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <SectionDivider label={t('profile.xpProgress')} />
              <Text style={styles.xpNumbers}>
                {t('profile.xpNumbers', { into: xpIntoLevel, needed: xpNeeded })}
              </Text>
              <Text style={styles.nextLine}>
                <Text style={styles.nextPrefix}>{t('profile.nextPrefix')}</Text>
                <Text style={styles.nextTitle}>{next ? t('levelTitle.' + next.title) : t('profile.maxLevel')}</Text>
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${clamp(xpProgress, 0, 1) * 100}%` }]} />
              </View>
              <Text style={styles.unlockText}>{unlockText}</Text>
            </View>

            <View>
              <View style={{ marginTop: 24 }}>
                <SectionDivider label={t('profile.territoriesLabel')} />
              </View>
              <View style={styles.list}>
                {ownedTerritories.length === 0 ? (
                  <Text style={styles.emptyText}>{t('profile.noTerritories')}</Text>
                ) : null}
                {ownedTerritories.map((terr, index) => (
                  <React.Fragment key={terr.id ?? `${terr.territory_name}-${index}`}>
                    {index > 0 ? <View style={styles.listDivider} /> : null}
                    <OwnedTerritoryRow name={terr.territory_name ?? t('common.territoryFallback')} tier={terr.tier} />
                  </React.Fragment>
                ))}
              </View>
            </View>

            <View>
              <View style={{ marginTop: 24 }}>
                <LegacyMedalsSection clerkGetToken={getToken} playerId={playerId} />
              </View>
            </View>
          </>
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
  headerBlock: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backChevron: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 20,
    color: SLATE2,
    marginTop: -2,
  },
  backLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTextCol: {
    flex: 1,
  },
  avatarWrap: {
    width: 72,
    height: 72,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK2,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    color: SLATE2,
    letterSpacing: -0.01,
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
  powerSection: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  powerHeroBlock: {
    marginBottom: 16,
  },
  powerValue: {
    fontFamily: fonts.displayMedium,
    fontSize: fontSize.xl4,
    letterSpacing: fontSize.xl4 * -0.02,
    color: colors.bone,
    marginBottom: spacing.xs,
  },
  powerHeroDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
    marginBottom: 4,
  },
  powerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  powerRowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
  powerRowLeft: {
    flex: 1,
    paddingRight: 12,
  },
  powerRowLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  powerRowReason: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: SLATE2,
  },
  powerRowValueLive: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 20,
    color: BONE,
    letterSpacing: -0.4,
  },
});
