import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { clearFcmToken } from '../lib/fcm';
import { patchAllianceChatPushEnabled } from '../lib/chatApi';
import { patchMe } from '../lib/meApi';
import { supabase } from '../lib/supabase';
import { avatarThumb } from '../lib/avatar';
import { logDebug } from '../lib/debug';
import {
  calcLevel,
  calcLevelProgress,
  getLevelTitle,
  LEVEL_XP_FLOORS,
  calcDailyInfluence,
  calcTerritoryPower,
  calcFullValueCap,
  calcTerritoryCapForLevel,
  calcLegacyPower,
  calcActivityPower,
} from '../lib/formulas';

function territoryCapForLevel(level) {
  const lv = Math.min(10, Math.max(1, level | 0));
  return calcTerritoryCapForLevel(lv);
}
import { colors, fonts, fontSize, spacing, radius, borders, text } from '../lib/theme';
import { InfluenceGlyph } from '../components/ResourceGlyphs';
import LegacyMedalsSection from '../components/medals/LegacyMedalsSection';

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

function AllianceChatPushToggleRow({ playerRow, clerkGetToken }) {
  const [enabled, setEnabled] = useState(
    playerRow?.alliance_chat_push_enabled !== false,
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (playerRow != null) {
      setEnabled(playerRow.alliance_chat_push_enabled !== false);
    }
  }, [playerRow]);

  const onPress = async () => {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    const result = await patchAllianceChatPushEnabled({
      clerkGetToken,
      enabled: next,
    });
    if (!result.ok) {
      setEnabled(!next);
    }
    setPending(false);
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.settingsRow,
      pressed && { opacity: 0.7 },
    ]}>
      <Text style={styles.settingsLabel}>Alliance chat push</Text>
      <Text
        style={[
          styles.settingsLabel,
          { color: enabled ? '#F2EEE6' : '#5C6068' },
        ]}
      >
        {enabled ? 'ON' : 'OFF'}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const today = useMemo(() => new Date(), []);
  const { signOut, userId, getToken } = useAuth();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [playerRow, setPlayerRow] = useState(null);
  const [ownedTerritories, setOwnedTerritories] = useState([]);
  const [profileError, setProfileError] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [activityPower, setActivityPower] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      console.log('[Profile] effect fired, userId:', userId, 'at', Date.now());
      const __profileT0 = Date.now();
      if (!userId) {
        setPlayerRow(null);
        setOwnedTerritories([]);
        setActivityPower(0);
        setProfileError('Not signed in.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setProfileError(null);
      setActivityPower(0);

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, username, level, xp, alliance_id, current_streak, longest_streak, iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins, alliance_chat_push_enabled, avatar_url')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;
      console.log('[Profile] player query done in', Date.now() - __profileT0, 'ms');
      const __profileT1 = Date.now();

      if (playerError) {
        setProfileError(playerError.message ?? 'Could not load profile');
        setPlayerRow(null);
        setOwnedTerritories([]);
        setActivityPower(0);
        setLoading(false);
        return;
      }

      if (!player) {
        setProfileError('No player record for this account.');
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
      console.log('[Profile] alliance+territories done in', Date.now() - __profileT1, 'ms');
      console.log('[Profile] total time:', Date.now() - __profileT0, 'ms');
      setAllianceName(allianceResult.data?.name ?? null);
      if (territoriesResult.error) {
        setProfileError(territoriesResult.error.message ?? 'Could not load territories');
        setOwnedTerritories([]);
      } else {
        setOwnedTerritories(territoriesResult.data ?? []);
      }

      const { data, error } = await supabase.rpc('get_activity_stats_30d', {
        p_player_id: player.id,
      });
      if (cancelled) return;
      if (error) {
        console.warn('[ProfileScreen] activity stats fetch failed:', error);
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
  }, [userId]);

  const xp = Math.max(0, Number(playerRow?.xp) || 0);
  const xpInt = Math.floor(xp);
  const level = calcLevel(xpInt);
  const progress = calcLevelProgress(xpInt);
  const xpFloor = LEVEL_XP_FLOORS[level - 1] ?? 0;
  const xpIntoLevel = level >= 10 ? xpInt - (LEVEL_XP_FLOORS[9] ?? 0) : xpInt - xpFloor;
  const xpNeeded = level >= 10 ? 0 : (LEVEL_XP_FLOORS[level] ?? 0) - xpFloor;
  const xpProgress = progress;
  const xpPct = Math.round(Math.min(progress, 1) * 100);
  const territoryCap = territoryCapForLevel(level);
  const fullValueCap = calcFullValueCap({
    level,
    isUnbrokenStreak: currentStreak >= 30 && currentStreak < 60,
    isLegendaryStreak: currentStreak >= 60,
    isAllianceChampion: false,
    isUnbrokenTogetherTier: false,
  });

  const territoryPower = calcTerritoryPower(
    ownedTerritories.map(t => ({
      tier: t.tier ? t.tier.charAt(0).toUpperCase() + t.tier.slice(1) : 'Small',
      developmentLevel: t.development_level ?? 0,
      legacyRank: t.legacy_rank ?? 1,
    })),
    fullValueCap
  );
  const lifetimeContestWins = Math.max(0, Number(playerRow?.lifetime_contest_wins) || 0);
  const lifetimeDefenceWins = Math.max(0, Number(playerRow?.lifetime_defence_wins) || 0);

  const legacyPower = calcLegacyPower({
    titlesEarned: 0,
    championshipWins: 0,
    lifetimeContestWins,
    lifetimeDefenceWins,
    highestStreakDays: longestStreak,
    lifetimeXp: xpInt,
  });
  const totalPower = activityPower + territoryPower + legacyPower;

  const playerName = playerRow?.username ?? '—';
  const rankBadge = getLevelTitle(level);
  const next = level < 10 ? { title: getLevelTitle(level + 1) } : null;

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

  const avatarUrl = playerRow?.avatar_url ?? null;
  const avatarInitials =
    playerName && playerName !== '—' ? playerName.slice(0, 2).toUpperCase() : '??';

  const onChangeAvatar = async () => {
    if (uploadingAvatar) return;
    if (!user) {
      Alert.alert('Hang on', 'Your account is still loading. Try again in a moment.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo access in Settings to set a profile picture.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Upload failed', 'Could not read the selected image.');
        return;
      }

      setUploadingAvatar(true);
      const mime = asset.mimeType ?? 'image/jpeg';
      const file = `data:${mime};base64,${asset.base64}`;

      // Upload to Clerk's CDN, then cache the resulting URL into our DB so
      // other players can see it in chat without a Clerk lookup per row.
      await user.setProfileImage({ file });
      await user.reload();
      const newUrl = user.imageUrl ?? null;

      const res = await patchMe({
        clerkGetToken: getToken,
        fields: { avatar_url: newUrl },
      });
      if (!res.ok) {
        console.warn('[Profile] avatar patchMe failed:', res.status, res.error);
        Alert.alert(
          'Almost there',
          'Your picture uploaded but did not sync to the game. Reopen Profile to retry.',
        );
      }

      setPlayerRow((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
    } catch (err) {
      console.warn('[Profile] avatar update failed:', err?.message ?? err);
      Alert.alert('Upload failed', 'Something went wrong setting your picture. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <View style={styles.screen}>
      {!loading && playerRow ? (
        <Pressable
          style={styles.headerBlock}
          onLongPress={() => navigation.navigate('HealthConnectDebug')}
          delayLongPress={1000}
        >
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={onChangeAvatar}
              style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarThumb(avatarUrl, 72) }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{avatarInitials}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={BONE} />
                ) : (
                  <Text style={styles.avatarEditBadgeText}>{avatarUrl ? 'EDIT' : 'ADD'}</Text>
                )}
              </View>
            </Pressable>
            <View style={styles.headerTextCol}>
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
            </View>
          </View>
          <View style={styles.hairlineStrong} />
        </Pressable>
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
          <View style={styles.powerSection}>
            <View style={styles.influenceHeader}>
              <Text style={styles.influenceLabel}>POWER</Text>
              <View style={styles.influenceHairline} />
            </View>
            <View style={styles.powerHeroBlock}>
              <Text style={styles.powerValue}>{totalPower.toLocaleString()}</Text>
              <Text style={styles.influenceSublabel}>TOTAL POWER</Text>
            </View>
            <View style={styles.powerHeroDivider} />
            <View style={styles.powerRow}>
              <View style={styles.powerRowLeft}>
                <Text style={styles.powerRowLabel}>ACTIVITY POWER</Text>
                <Text style={styles.powerRowReason}>Step tracking required</Text>
              </View>
              <Text style={styles.powerRowValueLive}>{activityPower.toLocaleString()}</Text>
            </View>
            <View style={styles.powerRowDivider} />
            <View style={styles.powerRow}>
              <View style={styles.powerRowLeft}>
                <Text style={styles.powerRowLabel}>TERRITORY POWER</Text>
                <Text style={styles.powerRowReason}>
                  {`${ownedTerritories.length} ${ownedTerritories.length === 1 ? 'territory' : 'territories'} · ${fullValueCap} full-value cap`}
                </Text>
              </View>
              <Text style={styles.powerRowValueLive}>{territoryPower.toLocaleString()}</Text>
            </View>
            <View style={styles.powerRowDivider} />
            <View style={styles.powerRow}>
              <View style={styles.powerRowLeft}>
                <Text style={styles.powerRowLabel}>LEGACY POWER</Text>
                <Text style={styles.powerRowReason}>
                  {`${lifetimeContestWins} contest ${lifetimeContestWins === 1 ? 'win' : 'wins'} · best streak ${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`}
                </Text>
              </View>
              <Text style={styles.powerRowValueLive}>{legacyPower.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.influenceBlock}>
            <View style={styles.influenceHeader}>
              <Text style={styles.influenceLabel}>INFLUENCE</Text>
              <View style={styles.influenceHairline} />
            </View>
            <View style={styles.influenceRow}>
              <InfluenceGlyph size={32} color={colors.bone} />
              <View style={styles.influenceTextStack}>
                <Text style={styles.influenceValue}>
                  {(() => {
                    const total = ownedTerritories.reduce((sum, t) => {
                      const tier = t.tier
                        ? t.tier.charAt(0).toUpperCase() + t.tier.slice(1)
                        : 'Small';
                      try {
                        return sum + calcDailyInfluence({
                          tier,
                          developmentLevel: t.development_level ?? 0,
                          legacyRank: t.legacy_rank ?? 1,
                          upkeepOverdue: t.upkeep_overdue ?? false,
                        });
                      } catch {
                        return sum;
                      }
                    }, 0);
                    return total % 1 === 0
                      ? total.toLocaleString()
                      : total.toFixed(1);
                  })()}
                </Text>
                <Text style={styles.influenceSublabel}>INFLUENCE / DAY</Text>
                <Text style={styles.influenceContext}>
                  {`From ${ownedTerritories.length} held ${ownedTerritories.length === 1 ? 'territory' : 'territories'}`}
                </Text>
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
              <LegacyMedalsSection clerkGetToken={getToken} />
            </View>
          </View>
        </>
      ) : null}

      {!loading ? (
        <>
          <View style={styles.walletSection}>
            <SectionDivider label="RESOURCES" />
            <Pressable
              style={styles.walletButton}
              onPress={() => navigation.navigate('Wallet', {
                playerId: playerRow?.id,
                username: playerRow?.username ?? '',
              })}
            >
              <Text style={styles.walletButtonText}>MY RESOURCES</Text>
            </Pressable>
            <Text style={styles.walletTapHint}>tap to enter</Text>
          </View>

          <View style={[styles.card, { marginTop: 32 }]}>
            <SectionDivider label="SETTINGS" />
            <View style={styles.settingsList}>
              <AllianceChatPushToggleRow
                playerRow={playerRow}
                clerkGetToken={getToken}
              />
              <View style={styles.listDivider} />
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
                          try {
                            await clearFcmToken({ clerkGetToken: getToken });
                          } catch (err) {
                            console.warn('[logout] clearFcmToken error:', err?.message);
                          }
                          const signOutTimeout = new Promise((resolve) => setTimeout(resolve, 5000));
                          await Promise.race([signOut(), signOutTimeout]);
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
  avatarEditBadge: {
    position: 'absolute',
    left: -1,
    right: -1,
    bottom: -1,
    minHeight: 16,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,16,20,0.82)',
    borderWidth: 1,
    borderColor: CLAIM,
  },
  avatarEditBadgeText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 8,
    letterSpacing: 1.4,
    color: CLAIM,
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
  powerBlock: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  powerValue: {
    fontFamily: fonts.displayMedium,
    fontSize: fontSize.xl4,
    letterSpacing: fontSize.xl4 * -0.02,
    color: colors.bone,
    marginBottom: spacing.xs,
  },
  walletSection: {
    marginTop: 32,
  },
  walletButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D64525',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletButtonText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#D64525',
  },
  walletTapHint: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#5C6068',
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
  powerSection: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  powerHeroBlock: {
    marginBottom: 16,
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
  powerRowValueInactive: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 20,
    color: SLATE,
    letterSpacing: -0.4,
  },
});

