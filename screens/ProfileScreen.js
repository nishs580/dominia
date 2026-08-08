import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { clearFcmToken } from '../lib/fcm';
import { patchAllianceChatPushEnabled } from '../lib/chatApi';
import { patchMe, deleteAccount } from '../lib/meApi';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';
import { supabase } from '../lib/supabase';
import { avatarThumb } from '../lib/avatar';
import { logDebug } from '../lib/debug';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
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
  getStreakTier,
  STREAK_TIER_THRESHOLDS,
} from '../lib/formulas';
import { earnedCount } from '../lib/legacyMedals';
import {
  initialize as healthInitialize,
  getSdkStatus,
  getGrantedPermissions,
  requestPermission,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from '../lib/health';
import { ACTIVITY_READ_PERMS, hasForegroundStepsRead } from '../lib/healthConnect';
import * as activityProducer from '../lib/activity';

function territoryCapForLevel(level) {
  const lv = Math.min(10, Math.max(1, level | 0));
  return calcTerritoryCapForLevel(lv);
}
import { colors, fonts, spacing } from '../lib/theme';
import { IronGlyph, StoneGlyph, GoldGlyph, MoraleGlyph } from '../components/ResourceGlyphs';
import LegacyMedalsSection from '../components/medals/LegacyMedalsSection';
import { fetchLegacyMedals } from '../lib/legacyMedalsApi';

// Hidden diagnostics (long-press the profile header → Health Connect debug).
// __DEV__ alone hid it from every EAS build, including internal test ones —
// exactly where an on-device health-permission problem has to be diagnosed.
// Metro inlines EXPO_PUBLIC_* at build time; it is set on the development and
// preview EAS environments only, never production.
const DEBUG_MENU = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_MENU === '1';

const CLAIM = '#D64525';
const ALLIANCE = '#3F8F4E';
// The one sanctioned non-territory signal. Used exactly once on this screen.
const CAUTION = '#D49A2B';
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

// One spine for every section on the screen: mono label, hairline, optional
// readout on the right. Sections stop looking like unrelated islands.
function SectionRule({ label, right }) {
  return (
    <View style={styles.sectionRule}>
      <Text style={styles.sectionRuleLabel}>{label}</Text>
      <View style={styles.sectionRuleLine} />
      {right ? <Text style={styles.sectionRuleRight}>{right}</Text> : null}
    </View>
  );
}

// The ten-rank ladder. A fresh commander is not "nothing" — they are standing
// on the first of ten segments, and the whole scale is visible at once.
function RankLadder({ level, progress }) {
  const segs = [];
  for (let i = 1; i <= 10; i += 1) {
    const done = i < level;
    const current = i === level;
    segs.push(
      <View
        key={i}
        style={[
          styles.ladderSeg,
          done && styles.ladderSegDone,
          current && styles.ladderSegCurrent,
        ]}
      >
        {current && progress > 0 ? (
          <View style={[styles.ladderFill, { width: `${clamp(progress, 0, 1) * 100}%` }]} />
        ) : null}
      </View>,
    );
  }
  return <View style={styles.ladder}>{segs}</View>;
}

// A Power contributor. Every reading — zero or not — states where it comes
// from, and every row is a door: tapping it goes to the place that moves it.
// Zero-state reasons are sentences (Inter); live readings are data (mono).
//
// `action` replaces the chevron with a control that satisfies the row's
// prerequisite in place. When one is present the row itself stops navigating —
// a Pressable inside a Pressable swallows the outer tap on Android, and the
// control is the affordance anyway.
function PowerRow({ label, value, reason, onPress, a11y, action }) {
  const zero = value <= 0;
  const body = (
    <>
      <View style={styles.powerRowLeft}>
        <Text style={styles.powerRowLabel}>{label}</Text>
        <Text style={zero ? styles.powerRowReason : styles.powerRowData} numberOfLines={2}>
          {reason}
        </Text>
      </View>
      <Text style={styles.powerRowValue}>{value.toLocaleString()}</Text>
      {action ?? <Text style={styles.rowChevron}>›</Text>}
    </>
  );
  if (action) {
    return <View style={styles.powerRow}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.powerRow, pressed && styles.rowPressed]}
    >
      {body}
    </Pressable>
  );
}

// One instrument in the record table. `sub` carries the scale and the unit, so
// the numeral column stays pure figures and every reading still says what it
// is measured against.
function RecordCell({ label, value, sub, rightEdge }) {
  return (
    <View style={[styles.recordCell, rightEdge && styles.recordCellEdge]}>
      <Text style={styles.recordLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordSub} numberOfLines={1}>{sub}</Text>
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
      Toast.show({ type: 'error', text1: t('profile.deleteFailedTitle'), text2: t('profile.deleteFailedBody'), position: 'top' });
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
        <Text style={styles.settingsDelete}>{t('profile.deleteAccount')}</Text>
        <Text style={styles.settingsDeleteFlag}>{t('profile.irreversible')}</Text>
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
      Toast.show({ type: 'success', text1: t('profile.passwordChangedTitle'), text2: t('profile.passwordChangedBody'), position: 'top' });
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
            <Text style={styles.modalTitle}>{t('profile.changePassword')}</Text>
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
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { signOut, userId, getToken } = useAuth();
  // Medal-push deep-link: land on the earned medal's detail card.
  const focusMedalKey = route?.params?.medalKey ?? null;

  // First-tap tips — each section explains itself the first time the player's
  // finger lands on it (rects are measured at touch time, so scroll position
  // is always current).
  const walkthroughIdentityRef = useRef(null);
  const walkthroughPowerRef = useRef(null);
  const walkthroughXpRef = useRef(null);
  const walkthroughTerritoriesRef = useRef(null);
  const walkthroughResourcesRef = useRef(null);

  // Legacy Power routes to the Honor Medals section further down the page.
  const scrollRef = useRef(null);
  const medalsYRef = useRef(0);
  const scrollToMedals = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, medalsYRef.current - 12), animated: true });
  };

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
  const [activityStats, setActivityStats] = useState(null);
  const [medals, setMedals] = useState(null);
  // null = not resolved yet. Only a settled `false` shows the TURN ON control,
  // so a player who already granted it never sees the button flash in.
  const [stepsPerm, setStepsPerm] = useState(null);
  const [permBusy, setPermBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
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
      setActivityStats(null);

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, username, level, xp, alliance_id, current_streak, longest_streak, iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins, alliance_chat_push_enabled, avatar_url')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

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
        const normalised = {
          xp30d: Number(stats.xp_30d) || 0,
          km30d: Number(stats.km_30d) || 0,
          challenges30d: Number(stats.challenges_30d) || 0,
          contests30d: Number(stats.contests_30d) || 0,
        };
        setActivityStats(normalised);
        setActivityPower(calcActivityPower(normalised));
      }

      setLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Step tracking ───────────────────────────────────────────────────────
  // The Activity Power row states a prerequisite, so it has to carry the
  // control that satisfies it. Re-checked on focus because the grant can also
  // be given on the Activity tab or in Health Connect itself.
  const refreshStepsPermission = useCallback(async () => {
    try {
      await healthInitialize();
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        setStepsPerm(false);
        return;
      }
      const granted = await getGrantedPermissions();
      setStepsPerm(hasForegroundStepsRead(granted));
    } catch (err) {
      // Health Connect missing or not ready. Treat as "not tracking" so the
      // row still offers a way forward instead of silently going quiet.
      setStepsPerm(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await refreshStepsPermission();
      })();
      return () => { cancelled = true; };
    }, [refreshStepsPermission]),
  );

  const onTurnOnTracking = async () => {
    if (permBusy) return;
    setPermBusy(true);
    try {
      await healthInitialize();
      const before = await getGrantedPermissions();
      await requestPermission(ACTIVITY_READ_PERMS);
      const granted = await getGrantedPermissions();
      const ok = hasForegroundStepsRead(granted);
      setStepsPerm(ok);
      if (ok) activityProducer.onPermissionGranted();
      // Android shows the Health Connect sheet once per app; a later request
      // that changes nothing means the sheet was suppressed, so send the
      // player to the settings screen where the grant can be toggled directly.
      if (!ok && granted.length === before.length) openHealthConnectSettings();
    } catch (err) {
      console.warn('[Profile] step permission request failed:', err?.message ?? err);
      try { openHealthConnectSettings(); } catch (_) { /* nothing else to offer */ }
    } finally {
      setPermBusy(false);
    }
  };

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

  // ── Readouts ────────────────────────────────────────────────────────────
  // Every zero on this screen has to say what scale it sits on and what moves
  // it. These derive the scale from data already fetched — nothing invented.

  const heldCount = ownedTerritories.length;
  const medalsEarned = medals ? earnedCount(medals) : 0;

  const dailyInfluence = useMemo(() => {
    const total = ownedTerritories.reduce((sum, terr) => {
      const tier = terr.tier
        ? terr.tier.charAt(0).toUpperCase() + terr.tier.slice(1)
        : 'Small';
      try {
        return sum + calcDailyInfluence({
          tier,
          developmentLevel: terr.development_level ?? 0,
          legacyRank: terr.legacy_rank ?? 1,
        });
      } catch {
        return sum;
      }
    }, 0);
    return total;
  }, [ownedTerritories]);

  // Next streak tier threshold above the current streak — the scale a zero
  // streak is measured against (3 days is the first one).
  const nextStreakTier = useMemo(() => {
    const ascending = [...STREAK_TIER_THRESHOLDS].sort((a, b) => a.days - b.days);
    return ascending.find((tier) => tier.days > currentStreak) ?? null;
  }, [currentStreak]);
  const streakMultiplier = getStreakTier(currentStreak).multiplier;

  // Tracking off is the only state that needs a control; once it is on, a zero
  // is just an empty 30 days and the row goes back to being a plain door.
  const trackingOff = stepsPerm === false;
  const activityReason = activityPower > 0
    ? t('profile.activityLive', {
        km: (activityStats?.km30d ?? 0).toFixed(1),
        challenges: activityStats?.challenges30d ?? 0,
      })
    : trackingOff
      ? t('profile.activityOff')
      : t('profile.activityIdle');

  const territoryReason = heldCount > 0
    ? t('profile.territoryLive', { count: heldCount, cap: fullValueCap })
    : t('profile.territoryZero');

  const legacyReason = legacyPower > 0
    ? t('profile.legacyLive', { earned: medalsEarned })
    : t('profile.legacyZero');

  const onChangeAvatar = async () => {
    if (uploadingAvatar) return;
    if (!user) {
      Toast.show({ type: 'info', text1: t('profile.alertHangOnTitle'), text2: t('profile.alertHangOnBody'), position: 'top' });
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'info', text1: t('profile.alertPhotoTitle'), text2: t('profile.alertPhotoBody'), position: 'top' });
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
        Toast.show({ type: 'error', text1: t('profile.alertUploadFailedTitle'), text2: t('profile.alertReadImageBody'), position: 'top' });
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
        Toast.show({ type: 'info', text1: t('profile.alertAlmostTitle'), text2: t('profile.alertAlmostBody'), position: 'top' });
      }

      setPlayerRow((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
    } catch (err) {
      console.warn('[Profile] avatar update failed:', err?.message ?? err);
      Toast.show({ type: 'error', text1: t('profile.alertUploadFailedTitle'), text2: t('profile.alertUploadGenericBody'), position: 'top' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      {!loading && playerRow ? (
        <Pressable
          ref={walkthroughIdentityRef}
          style={[styles.headerBlock, { paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0) + 10 }]}
          onLongPress={DEBUG_MENU ? () => navigation.navigate('HealthConnectDebug') : undefined}
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
                <Image source={{ uri: avatarThumb(avatarUrl, 64) }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{avatarInitials}</Text>
                </View>
              )}
              {/* Slate hairline, never Claim Red — setting a picture is the
                  smallest affordance on the screen and must not spend the red. */}
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={BONE} />
                ) : (
                  <Text style={styles.avatarEditBadgeText}>{avatarUrl ? t('profile.edit') : t('profile.add')}</Text>
                )}
              </View>
            </Pressable>
            {/* No COMMANDER kicker: it outranked the real rank noun directly
                below it, and "Commander" is itself level 5 on the ladder — a
                decorative label that collides with a rank the player can earn.
                The rank and its scale now sit together on one line. */}
            <View style={styles.headerTextCol}>
              <Text style={styles.commanderName} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{playerName}</Text>
              <Text style={styles.rankLine} numberOfLines={1}>
                <Text style={styles.rankTitle}>{t('levelTitle.' + rankBadge)}</Text>
                <Text style={styles.rankSeparator}> · </Text>
                <Text style={styles.rankScale}>{t('profile.rankOf', { level })}</Text>
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

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content}>
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
          {/* ── STANDING ────────────────────────────────────────────────
              The hero number, the ten-rank ladder it sits on, and the three
              contributors — each stating its source and routing to the place
              that moves it. A zero here is a position, not an absence. */}
          <View ref={walkthroughPowerRef} collapsable={false} style={styles.powerSection}>
            <SectionRule label={t('profile.power')} />
            <View style={styles.powerHeroRow}>
              <Text style={styles.powerValue} maxFontSizeMultiplier={1.2}>{totalPower.toLocaleString()}</Text>
              <Text style={styles.powerHeroUnit}>{t('profile.totalPower')}</Text>
            </View>

            <View ref={walkthroughXpRef} collapsable={false}>
              <RankLadder level={level} progress={xpProgress} />
              <View style={styles.ladderCaption}>
                <Text style={styles.ladderXp}>
                  {next ? t('profile.xpFraction', { into: xpIntoLevel, needed: xpNeeded }) : t('profile.maxLevel')}
                </Text>
                {next ? (
                  <Text style={styles.ladderNext} numberOfLines={1}>
                    {t('profile.nextPrefix')}{t('levelTitle.' + next.title)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.unlockText}>{unlockText}</Text>
            </View>

            <View style={styles.powerLedger}>
              <PowerRow
                label={t('profile.activityPower')}
                value={activityPower}
                reason={activityReason}
                onPress={() => navigation.navigate('Activity')}
                a11y={t('profile.activityPower')}
                action={trackingOff ? (
                  // Secondary instrument, never Claim Red: red means yours /
                  // claim / the primary CTA, and granting an OS permission is
                  // none of those. The screen's one red stays on the claim.
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.turnOnTracking')}
                    onPress={onTurnOnTracking}
                    disabled={permBusy}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={({ pressed }) => [styles.rowAction, pressed && styles.rowActionPressed]}
                  >
                    {permBusy ? (
                      <ActivityIndicator size="small" color={BONE} />
                    ) : (
                      <Text style={styles.rowActionText}>{t('profile.turnOn')}</Text>
                    )}
                  </Pressable>
                ) : null}
              />
              <View style={styles.powerRowDivider} />
              <PowerRow
                label={t('profile.territoryPower')}
                value={territoryPower}
                reason={territoryReason}
                onPress={() => navigation.navigate('Map')}
                a11y={t('profile.territoryPower')}
              />
              <View style={styles.powerRowDivider} />
              <PowerRow
                label={t('profile.legacyPower')}
                value={legacyPower}
                reason={legacyReason}
                onPress={scrollToMedals}
                a11y={t('profile.legacyPower')}
              />
            </View>
          </View>

          {/* ── TERRITORIES ─────────────────────────────────────────────
              With nothing held this is the screen's one instruction, and it
              carries the screen's one Claim Red. Copy never implies going to
              the territory — the walk counts from anywhere. */}
          <View ref={walkthroughTerritoriesRef} collapsable={false} style={styles.section}>
            <SectionRule
              label={t('profile.yourTerritories')}
              right={`${heldCount} / ${territoryCap}`}
            />
            {heldCount === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyLead}>{t('profile.noTerritories')}</Text>
                <Text style={styles.emptyBody}>{t('profile.territoriesEmptyBody')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Map')}
                  style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed]}
                >
                  <Text style={styles.primaryCtaText}>{t('profile.claimFirst')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.list}>
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
            )}
          </View>

          {/* ── RECORD ──────────────────────────────────────────────────
              Six instruments, each printing the scale it is measured on. */}
          <View style={styles.section}>
            <SectionRule label={t('profile.record')} />
            <View style={styles.recordTable}>
              <RecordCell
                label={t('profile.streak')}
                value={String(currentStreak)}
                sub={nextStreakTier
                  ? t('profile.subNextTier', { days: nextStreakTier.days })
                  : t('profile.subStreakMult', { mult: streakMultiplier.toFixed(2) })}
              />
              <RecordCell
                label={t('profile.bestStreak')}
                value={String(longestStreak)}
                sub={t('profile.subPersonalBest')}
                rightEdge
              />
              <RecordCell
                label={t('profile.influence')}
                value={dailyInfluence % 1 === 0 ? dailyInfluence.toLocaleString() : dailyInfluence.toFixed(1)}
                sub={t('profile.perDayFromHeld', { count: heldCount })}
              />
              <RecordCell
                label={t('profile.siegeXp')}
                value={xpInt.toLocaleString()}
                sub={t('profile.lifetimeSub')}
                rightEdge
              />
              <RecordCell
                label={t('profile.contestsWonLabel')}
                value={lifetimeContestWins.toLocaleString()}
                sub={t('profile.lifetimeSub')}
              />
              <RecordCell
                label={t('profile.defencesHeldLabel')}
                value={lifetimeDefenceWins.toLocaleString()}
                sub={t('profile.lifetimeSub')}
                rightEdge
              />
            </View>
          </View>

          {citadelRecords.length > 0 ? (
            <View style={styles.section}>
              <SectionRule label={t('profile.citadels')} right={String(citadelRecords.length)} />
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

          <View
            style={styles.section}
            onLayout={(e) => { medalsYRef.current = e.nativeEvent.layout.y; }}
          >
            <LegacyMedalsSection
              clerkGetToken={getToken}
              focusMedalKey={focusMedalKey}
              onFocusConsumed={() => navigation.setParams({ medalKey: undefined })}
            />
          </View>
        </>
      ) : null}

      {!loading ? (
        <>
          {/* The balances themselves, not a button that promises them. Needs a
              real playerId, so it never renders in the load-error state. */}
          {playerRow ? (
            <View ref={walkthroughResourcesRef} collapsable={false} style={styles.section}>
              <SectionRule label={t('profile.resources')} right={t('profile.openWallet')} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.myResources')}
                style={({ pressed }) => [styles.walletStrip, pressed && styles.rowPressed]}
                onPress={() => navigation.navigate('Wallet', {
                  playerId: playerRow.id,
                  username: playerRow.username ?? '',
                })}
              >
                {[
                  { key: 'iron', Glyph: IronGlyph, value: Math.max(0, Number(playerRow.iron) || 0) },
                  { key: 'stone', Glyph: StoneGlyph, value: Math.max(0, Number(playerRow.stone) || 0) },
                  { key: 'gold', Glyph: GoldGlyph, value: Math.max(0, Number(playerRow.gold) || 0) },
                  { key: 'morale', Glyph: MoraleGlyph, value: Math.max(0, Number(playerRow.morale) || 0) },
                ].map(({ key, Glyph, value }, index) => (
                  <View
                    key={key}
                    style={[
                      styles.walletCell,
                      index === 0 && styles.walletCellFirst,
                      index < 3 && styles.walletCellEdge,
                    ]}
                  >
                    <Glyph size={14} color={value > 0 ? BONE : SLATE2} />
                    <Text style={styles.walletValue}>
                      {value.toLocaleString()}
                    </Text>
                    <Text style={styles.walletCellLabel}>{t('profile.resource.' + key)}</Text>
                  </View>
                ))}
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionRule label={t('profile.settings')} />
            <View style={styles.settingsList}>
              {/* Player-dependent rows only render with a loaded row; sign out
                  and change password stay available so an errored user can escape. */}
              {playerRow ? (
                <>
                  <AllianceChatPushToggleRow
                    playerRow={playerRow}
                    clerkGetToken={getToken}
                  />
                  <View style={styles.listDivider} />
                </>
              ) : null}
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
              {playerRow ? (
                <>
                  <View style={styles.listDivider} />
                  <DeleteAccountSection
                    username={playerRow.username}
                    clerkGetToken={getToken}
                    signOut={signOut}
                    navigation={navigation}
                  />
                </>
              ) : null}
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
    paddingBottom: spacing.xl4,
  },

  // ── Identity ─────────────────────────────────────────────────────────────
  headerBlock: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    width: 64,
    height: 64,
  },
  avatarImage: {
    width: 64,
    height: 64,
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
    fontSize: 22,
    color: SLATE2,
    letterSpacing: -0.01,
  },
  avatarEditBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 16,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,16,20,0.86)',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  avatarEditBadgeText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 8,
    letterSpacing: 1.4,
    color: SLATE2,
  },
  commanderName: {
    fontFamily: 'Archivo_900Black',
    fontSize: 32,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
  },
  rankLine: {
    marginTop: 6,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rankTitle: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    // Bone, not red — the rank title is a label, not the screen's one accent.
    color: BONE,
  },
  rankSeparator: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
  },
  // The rank's position on the ladder, sitting with the rank noun rather than
  // 250px lower in another block.
  rankScale: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    color: SLATE2,
  },
  rankAlliance: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    color: SLATE2,
  },
  rankAllianceClaim: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    // Alliance Green — the alliance is "ours" (Locked Meaning Rule), never red.
    color: ALLIANCE,
  },
  hairlineStrong: {
    marginTop: 12,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },

  // ── States ───────────────────────────────────────────────────────────────
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
    marginTop: 16,
    padding: 12,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: BONE,
  },

  // ── Section spine ────────────────────────────────────────────────────────
  section: {
    marginTop: 24,
  },
  sectionRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionRuleLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  sectionRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },
  sectionRuleRight: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: SLATE2,
  },

  // ── Standing ─────────────────────────────────────────────────────────────
  powerSection: {
    paddingTop: 16,
  },
  powerHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  powerValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -0.9,
    color: colors.bone,
  },
  powerHeroUnit: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
    marginBottom: 12,
  },
  ladder: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 16,
  },
  ladderSeg: {
    flex: 1,
    height: 6,
    backgroundColor: HAIRLINE,
  },
  ladderSegDone: {
    backgroundColor: BONE,
  },
  ladderSegCurrent: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  ladderFill: {
    height: '100%',
    backgroundColor: BONE,
  },
  ladderCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  ladderXp: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: BONE,
  },
  ladderNext: {
    flexShrink: 1,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  unlockText: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: SLATE2,
  },

  // ── Power ledger ─────────────────────────────────────────────────────────
  powerLedger: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE_STRONG,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    minHeight: 54,
  },
  powerRowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
  powerRowLeft: {
    flex: 1,
  },
  powerRowLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  // Zero state: a sentence someone reads, so Inter, and Bone because it is the
  // most useful thing in the row.
  powerRowReason: {
    marginTop: 5,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: BONE,
  },
  // Live state: a readout, so Geist Mono and subdued — the number leads.
  powerRowData: {
    marginTop: 5,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  powerRowValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 22,
    color: BONE,
    letterSpacing: -0.4,
  },
  // Readings are always Bone. Dimming unearned figures inverted the hierarchy:
  // it made the block that *is* the player's standing the faintest thing on the
  // screen, fainter than its own labels. The scale captions carry the "not yet"
  // instead.
  rowChevron: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    lineHeight: 20,
    color: SLATE2,
  },
  rowPressed: {
    backgroundColor: INK2,
  },
  // Secondary instrument (DESIGN.md §5): Ink 2, hairline-strong, Bone mono.
  // 44dp tall plus hitSlop clears the 48dp touch target without pushing the
  // claim CTA below the fold.
  rowAction: {
    minHeight: 44,
    paddingHorizontal: 12,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  rowActionPressed: {
    backgroundColor: INK3,
  },
  rowActionText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: BONE,
  },

  // ── Territories ──────────────────────────────────────────────────────────
  emptyBlock: {
    paddingTop: 2,
  },
  emptyLead: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: BONE,
  },
  emptyBody: {
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: SLATE2,
  },
  // The screen's single Claim Red: the one action a commander with nothing
  // should take. Nothing else on this screen may be red.
  primaryCta: {
    marginTop: 16,
    backgroundColor: CLAIM,
    minHeight: 48,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaPressed: {
    opacity: 0.82,
  },
  primaryCtaText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: BONE,
  },
  list: {
    marginTop: 2,
  },
  listDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
  territoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
    minHeight: 48,
  },
  territoryName: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: BONE,
  },
  territoryTier: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  territoryRowPressed: {
    backgroundColor: INK2,
  },
  territoryChevron: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    lineHeight: 20,
    color: SLATE2,
    marginLeft: 2,
  },

  // ── Record table ─────────────────────────────────────────────────────────
  recordTable: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE_STRONG,
  },
  recordCell: {
    width: '50%',
    paddingVertical: 12,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
  },
  recordCellEdge: {
    borderRightWidth: 0,
    paddingRight: 0,
    paddingLeft: 12,
  },
  recordLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: SLATE2,
  },
  recordValue: {
    marginTop: 7,
    fontFamily: 'Archivo_700Bold',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.5,
    color: BONE,
  },
  // Units live here, not inline beside the figure, so the numeral column reads
  // as one clean run of numbers down the table.
  recordSub: {
    marginTop: 6,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: SLATE2,
  },

  // ── Resources ────────────────────────────────────────────────────────────
  walletStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE_STRONG,
    minHeight: 48,
  },
  walletCell: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    gap: 6,
  },
  walletCellFirst: {
    paddingLeft: 0,
  },
  walletCellEdge: {
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
    paddingRight: 12,
  },
  walletValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 15,
    color: BONE,
  },
  walletCellLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: SLATE2,
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settingsList: {
    marginTop: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
    minHeight: 48,
  },
  settingsLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BONE,
  },
  settingsChevron: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: SLATE2,
  },
  // Sign out is a routine action — neutral bone.
  settingsSignOut: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BONE,
  },
  // Delete is not red: red means "yours / claim / the primary action", and this
  // screen spends it on the first claim. The permanence is signalled instead by
  // the screen's one sanctioned Caution Amber flag.
  settingsDelete: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BONE,
  },
  settingsDeleteFlag: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: CAUTION,
  },

  // ── Modals ───────────────────────────────────────────────────────────────
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
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.01,
  },
  // Neutral modal title — change-password is a routine action, not destructive.
  modalTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 20,
    color: BONE,
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
    // Errors read in Bone (Inter sentence), never Claim red (Locked Meaning).
    color: BONE,
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
    minHeight: 48,
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
  // The modal is its own surface; the destructive confirm is its single red.
  deleteModalConfirm: {
    flex: 1,
    borderWidth: 1,
    borderColor: CLAIM,
    backgroundColor: 'rgba(214,69,37,0.12)',
    paddingVertical: 12,
    minHeight: 48,
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
});
