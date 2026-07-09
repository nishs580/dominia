import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { clearFcmToken } from '../lib/fcm';
import { patchAllianceChatPushEnabled } from '../lib/chatApi';
import { patchMe, deleteAccount } from '../lib/meApi';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';
import { supabase } from '../lib/supabase';
import { avatarThumb } from '../lib/avatar';
import { logDebug } from '../lib/debug';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import { registerDemoRect } from '../lib/demoRegistry';
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

function territoryCapForLevel(level) {
  const lv = Math.min(10, Math.max(1, level | 0));
  return calcTerritoryCapForLevel(lv);
}
import { colors, fonts, fontSize, spacing, radius, borders, text } from '../lib/theme';
import { InfluenceGlyph } from '../components/ResourceGlyphs';
import LegacyMedalsSection from '../components/medals/LegacyMedalsSection';
import { fetchLegacyMedals } from '../lib/legacyMedalsApi';

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

function OwnedTerritoryRow({ name, tier, onPress }) {
  const tierLabel = tier ?? '—';
  const content = (
    <>
      <Text style={styles.territoryName}>{name}</Text>
      <Text style={styles.territoryTier}>{tierLabel}</Text>
      {onPress ? <Text style={styles.territoryChevron}>›</Text> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.territoryRow}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.territoryRow, pressed && styles.territoryRowPressed]}
    >
      {content}
    </Pressable>
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
  const { t } = useTranslation();
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
      <Text style={styles.settingsLabel}>{t('profile.allianceChatPush')}</Text>
      <Text
        style={[
          styles.settingsLabel,
          { color: enabled ? '#F2EEE6' : '#5C6068' },
        ]}
      >
        {enabled ? t('profile.on') : t('profile.off')}
      </Text>
    </Pressable>
  );
}

// Play Store account-deletion requirement: an in-app path that permanently
// deletes the account. The modal requires re-typing the username so a stray
// tap can never fire the irreversible DELETE /me/account call.
function DeleteAccountSection({ username, clerkGetToken, signOut, navigation }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const expected = (username ?? '').trim().toLowerCase();
  const matches = expected.length > 0 && confirmText.trim().toLowerCase() === expected;

  const close = () => {
    if (deleting) return;
    setVisible(false);
    setConfirmText('');
  };

  const onConfirm = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    const res = await deleteAccount({ clerkGetToken });
    if (!res.ok) {
      setDeleting(false);
      Alert.alert(t('profile.deleteFailedTitle'), t('profile.deleteFailedBody'));
      return;
    }
    try {
      const signOutTimeout = new Promise((resolve) => setTimeout(resolve, 5000));
      await Promise.race([signOut(), signOutTimeout]);
    } catch (err) {
      // The Clerk user is already gone server-side; a signOut error is moot.
      console.warn('[deleteAccount] signOut error:', err?.message);
    }
    navigation.replace('SignIn');
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={styles.settingsRow}
        accessibilityRole="button"
        accessibilityLabel={t('profile.deleteAccount')}
      >
        <Text style={styles.settingsSignOut}>{t('profile.deleteAccount')}</Text>
        <Text style={styles.settingsChevron}>›</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.deleteModalBackdrop}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>{t('profile.deleteModalTitle')}</Text>
            <Text style={styles.deleteModalBody}>{t('profile.deleteModalBody')}</Text>
            <Text style={styles.deleteModalPrompt}>
              {t('profile.deleteModalPrompt', { username: username ?? '' })}
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={username ?? ''}
              placeholderTextColor={SLATE}
              editable={!deleting}
            />
            <View style={styles.deleteModalActions}>
              <Pressable
                onPress={close}
                disabled={deleting}
                style={({ pressed }) => [styles.deleteModalCancel, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.deleteModalCancelText}>{t('profile.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={!matches || deleting}
                style={[styles.deleteModalConfirm, (!matches || deleting) && { opacity: 0.4 }]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={BONE} />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>{t('profile.deleteModalConfirm')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Hidden for SSO-only accounts — they have no password credential to change
// (user.passwordEnabled is false). Clerk keeps the current session alive and
// signOutOfOtherSessions revokes every other device.
function ChangePasswordSection() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [visible, setVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user?.passwordEnabled) return null;

  const close = () => {
    if (saving) return;
    setVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setError('');
  };

  const onConfirm = async () => {
    if (saving) return;
    if (newPassword.length < PASSWORD_MIN) {
      setError(t('signIn.passwordTooShort', { min: PASSWORD_MIN }));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true });
      setSaving(false);
      setVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert(t('profile.passwordChangedTitle'), t('profile.passwordChangedBody'));
    } catch (err) {
      setSaving(false);
      setError(err.errors?.[0]?.message ?? t('profile.passwordChangeFailed'));
    }
  };

  return (
    <>
      <View style={styles.listDivider} />
      <Pressable
        onPress={() => setVisible(true)}
        style={styles.settingsRow}
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePassword')}
      >
        <Text style={styles.settingsLabel}>{t('profile.changePassword')}</Text>
        <Text style={styles.settingsChevron}>›</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.deleteModalBackdrop}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>{t('profile.changePassword')}</Text>
            <Text style={styles.deleteModalPrompt}>{t('profile.currentPassword')}</Text>
            <TextInput
              style={styles.deleteModalInput}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
            />
            <Text style={styles.deleteModalPrompt}>{t('profile.newPassword')}</Text>
            <TextInput
              style={styles.deleteModalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={PASSWORD_MAX}
              editable={!saving}
            />
            {error ? <Text style={styles.changePasswordError}>{error}</Text> : null}
            <View style={styles.deleteModalActions}>
              <Pressable
                onPress={close}
                disabled={saving}
                style={({ pressed }) => [styles.deleteModalCancel, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.deleteModalCancelText}>{t('profile.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={saving || !currentPassword || !newPassword}
                style={[
                  styles.deleteModalConfirm,
                  (saving || !currentPassword || !newPassword) && { opacity: 0.4 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={BONE} />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>{t('profile.changePasswordConfirm')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const { signOut, userId, getToken } = useAuth();

  // First-tap tips — each section explains itself the first time the player's
  // finger lands on it (rects are measured at touch time, so scroll position
  // is always current).
  const walkthroughIdentityRef = useRef(null);
  const walkthroughPowerRef = useRef(null);
  const walkthroughXpRef = useRef(null);
  const walkthroughTerritoriesRef = useRef(null);
  const walkthroughResourcesRef = useRef(null);

  const profileTips = useMemo(
    () => [
      { key: 'identity', text: t('walkthrough.profile.identity'), getRect: () => rectFromRef(walkthroughIdentityRef) },
      { key: 'power', text: t('walkthrough.profile.power'), getRect: () => rectFromRef(walkthroughPowerRef) },
      { key: 'xp', text: t('walkthrough.profile.xp'), getRect: () => rectFromRef(walkthroughXpRef) },
      { key: 'territories', text: t('walkthrough.profile.territories'), getRect: () => rectFromRef(walkthroughTerritoriesRef) },
      { key: 'resources', text: t('walkthrough.profile.resources'), getRect: () => rectFromRef(walkthroughResourcesRef) },
    ],
    [t],
  );
  const tips = useFirstTapTips({ screenKey: 'profile', userId, tips: profileTips });

  // Guided-demo targets (read beats 11 and 12 of the first-run tour).
  useEffect(() => registerDemoRect('profile.power', () => rectFromRef(walkthroughPowerRef)), []);
  useEffect(() => registerDemoRect('profile.resources', () => rectFromRef(walkthroughResourcesRef)), []);
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [playerRow, setPlayerRow] = useState(null);
  const [ownedTerritories, setOwnedTerritories] = useState([]);
  const [citadelRecords, setCitadelRecords] = useState([]);
  const [profileError, setProfileError] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [activityPower, setActivityPower] = useState(0);
  const [medals, setMedals] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      console.log('[Profile] effect fired, userId:', userId, 'at', Date.now());
      const __profileT0 = Date.now();
      if (!userId) {
        setPlayerRow(null);
        setOwnedTerritories([]);
        setActivityPower(0);
        setProfileError(t('profile.errNotSignedIn'));
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
        setProfileError(playerError.message ?? t('profile.errCouldNotLoad'));
        setPlayerRow(null);
        setOwnedTerritories([]);
        setActivityPower(0);
        setLoading(false);
        return;
      }

      if (!player) {
        setProfileError(t('profile.errNoPlayer'));
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

      const [allianceResult, territoriesResult, citadelResult] = await Promise.all([
        player.alliance_id
          ? supabase.from('alliances').select('name').eq('id', player.alliance_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('territories').select('id, territory_name, tier, development_level, legacy_rank, latitude, longitude').eq('owner_id', player.id),
        // Permanent record: territories this player developed to Citadel (D4).
        supabase.from('development_records').select('id, territory_name, reached_at').eq('player_id', player.id).order('reached_at', { ascending: true }),
      ]);

      if (cancelled) return;
      console.log('[Profile] alliance+territories done in', Date.now() - __profileT1, 'ms');
      console.log('[Profile] total time:', Date.now() - __profileT0, 'ms');
      setAllianceName(allianceResult.data?.name ?? null);
      if (territoriesResult.error) {
        setProfileError(territoriesResult.error.message ?? t('profile.errCouldNotLoadTerritories'));
        setOwnedTerritories([]);
      } else {
        setOwnedTerritories(territoriesResult.data ?? []);
      }
      setCitadelRecords(citadelResult.error ? [] : citadelResult.data ?? []);

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

  // Honor Medal state — drives Legacy Power and is passed to the medals section.
  useEffect(() => {
    if (!userId) {
      setMedals(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetchLegacyMedals({ clerkGetToken: getToken });
      if (!cancelled && res.ok) setMedals(res.data.medals);
    })();
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

  // Legacy Power now derives from Honor Medals (calcMedalPower). 0 until the
  // medal state loads, then the power row updates.
  const legacyPower = calcMedalPower(medals);
  const totalPower = activityPower + territoryPower + legacyPower;

  const playerName = playerRow?.username ?? '—';
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

  const avatarUrl = playerRow?.avatar_url ?? null;
  const avatarInitials =
    playerName && playerName !== '—' ? playerName.slice(0, 2).toUpperCase() : '??';

  const onChangeAvatar = async () => {
    if (uploadingAvatar) return;
    if (!user) {
      Alert.alert(t('profile.alertHangOnTitle'), t('profile.alertHangOnBody'));
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t('profile.alertPhotoTitle'),
          t('profile.alertPhotoBody'),
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
        Alert.alert(t('profile.alertUploadFailedTitle'), t('profile.alertReadImageBody'));
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
          t('profile.alertAlmostTitle'),
          t('profile.alertAlmostBody'),
        );
      }

      setPlayerRow((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
    } catch (err) {
      console.warn('[Profile] avatar update failed:', err?.message ?? err);
      Alert.alert(t('profile.alertUploadFailedTitle'), t('profile.alertUploadGenericBody'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      {!loading && playerRow ? (
        <Pressable
          ref={walkthroughIdentityRef}
          style={styles.headerBlock}
          onLongPress={__DEV__ ? () => navigation.navigate('HealthConnectDebug') : undefined}
          delayLongPress={1000}
        >
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={onChangeAvatar}
              style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.changeAvatarA11y')}
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
                  <Text style={styles.avatarEditBadgeText}>{avatarUrl ? t('profile.edit') : t('profile.add')}</Text>
                )}
              </View>
            </Pressable>
            <View style={styles.headerTextCol}>
              <Text style={styles.commanderLabel}>{t('profile.commanderLabel')}</Text>
              <Text style={styles.commanderName} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{playerName}</Text>
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
        </Pressable>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={SLATE2} />
            <Text style={styles.loadingText}>{t('profile.loading')}</Text>
          </View>
        ) : null}

        {!loading && profileError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{profileError}</Text>
          </View>
        ) : null}

        {!loading && playerRow ? (
          <>
          <View ref={walkthroughPowerRef} collapsable={false} style={styles.powerSection}>
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
                    const total = ownedTerritories.reduce((sum, t) => {
                      const tier = t.tier
                        ? t.tier.charAt(0).toUpperCase() + t.tier.slice(1)
                        : 'Small';
                      try {
                        return sum + calcDailyInfluence({
                          tier,
                          developmentLevel: t.development_level ?? 0,
                          legacyRank: t.legacy_rank ?? 1,
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

          <View ref={walkthroughXpRef} collapsable={false} style={styles.card}>
            <SectionDivider label={t('profile.xpProgress')} />
            <Text style={styles.xpNumbers}>
              {t('profile.xpNumbers', { into: xpIntoLevel, needed: xpNeeded })}
            </Text>
            <Text style={styles.nextLine}>
              <Text style={styles.nextPrefix}>{t('profile.nextPrefix')}</Text>
              <Text style={styles.nextTitle}>{next ? t('levelTitle.' + next.title) : t('profile.maxLevel')}</Text>
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

          <View ref={walkthroughTerritoriesRef} collapsable={false}>
            <View style={{ marginTop: 24 }}>
              <SectionDivider label={t('profile.yourTerritories')} />
            </View>
            <View style={styles.list}>
              {ownedTerritories.length === 0 ? (
                <Text style={styles.emptyText}>{t('profile.noTerritories')}</Text>
              ) : null}
              {ownedTerritories.map((terr, index) => {
                const lat = Number(terr.latitude);
                const lng = Number(terr.longitude);
                const canLocate = Number.isFinite(lat) && Number.isFinite(lng);
                return (
                  <React.Fragment key={terr.id ?? `${terr.territory_name}-${index}`}>
                    {index > 0 ? <View style={styles.listDivider} /> : null}
                    <OwnedTerritoryRow
                      name={terr.territory_name ?? t('common.territoryFallback')}
                      tier={terr.tier}
                      onPress={canLocate ? () => navigation.navigate('Map', {
                        focusTerritory: { id: terr.id, name: terr.territory_name, latitude: lat, longitude: lng },
                        focusNonce: Date.now(),
                      }) : undefined}
                    />
                  </React.Fragment>
                );
              })}
            </View>
          </View>

          {citadelRecords.length > 0 ? (
            <View>
              <View style={{ marginTop: 24 }}>
                <SectionDivider label={t('profile.citadels')} />
              </View>
              <View style={styles.list}>
                {citadelRecords.map((record, index) => (
                  <React.Fragment key={record.id}>
                    {index > 0 ? <View style={styles.listDivider} /> : null}
                    <OwnedTerritoryRow
                      name={record.territory_name ?? t('common.territoryFallback')}
                      tier={t('profile.citadelRecord')}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <View style={{ marginTop: 24 }}>
              <LegacyMedalsSection clerkGetToken={getToken} />
            </View>
          </View>
        </>
      ) : null}

      {!loading ? (
        <>
          <View ref={walkthroughResourcesRef} collapsable={false} style={styles.walletSection}>
            <SectionDivider label={t('profile.resources')} />
            <Pressable
              style={styles.walletButton}
              onPress={() => navigation.navigate('Wallet', {
                playerId: playerRow?.id,
                username: playerRow?.username ?? '',
              })}
            >
              <Text style={styles.walletButtonText}>{t('profile.myResources')}</Text>
            </Pressable>
            <Text style={styles.walletTapHint}>{t('profile.tapToEnter')}</Text>
          </View>

          <View style={[styles.card, { marginTop: 32 }]}>
            <SectionDivider label={t('profile.settings')} />
            <View style={styles.settingsList}>
              <AllianceChatPushToggleRow
                playerRow={playerRow}
                clerkGetToken={getToken}
              />
              <View style={styles.listDivider} />
              <SettingsRow label={t('profile.notificationSettings')} />
              <ChangePasswordSection />
              <View style={styles.listDivider} />
              <Pressable
                onPress={() => {
                  Alert.alert(
                    t('profile.signOut'),
                    t('profile.signOutConfirm'),
                    [
                      { text: t('profile.cancel'), style: 'cancel' },
                      {
                        text: t('profile.signOut'),
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
                <Text style={styles.settingsSignOut}>{t('profile.signOut')}</Text>
                <Text style={styles.settingsChevron}>›</Text>
              </Pressable>
              <View style={styles.listDivider} />
              <DeleteAccountSection
                username={playerRow?.username}
                clerkGetToken={getToken}
                signOut={signOut}
                navigation={navigation}
              />
            </View>
          </View>
        </>
      ) : null}
      </ScrollView>

      {tips.tipElement}
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
  territoryRowPressed: {
    opacity: 0.55,
  },
  territoryChevron: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    lineHeight: 18,
    color: SLATE2,
    marginLeft: 2,
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
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14,16,20,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deleteModalCard: {
    alignSelf: 'stretch',
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    padding: 20,
  },
  deleteModalTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 20,
    color: CLAIM,
    textTransform: 'uppercase',
    letterSpacing: -0.01,
  },
  deleteModalBody: {
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: BONE,
  },
  deleteModalPrompt: {
    marginTop: 16,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.4,
    color: SLATE2,
  },
  deleteModalInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BONE,
  },
  changePasswordError: {
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: CLAIM,
  },
  deleteModalActions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  deleteModalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: BONE,
  },
  deleteModalConfirm: {
    flex: 1,
    borderWidth: 1,
    borderColor: CLAIM,
    backgroundColor: 'rgba(214,69,37,0.12)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalConfirmText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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

