// Figma Profile (plan U10; Dominia-Temp boards 33, 36, 37): "‹ Profile" back
// row over a hairline, the identity row (blue slanted avatar tile, USERNAME,
// alliance name with its emblem, "Edit Profile ✎"), and five accordion cards —
// Your Territories, Activity, Resource Balance, App Settings, Statistics. Any
// number can be open; all start closed.
//
// Mounted by App.js for the Profile route when `power_rank` is off; with it on
// the route mounts today's ProfileScreen. Settings rows (change password,
// delete account) are ProfileScreen's own components, imported. The
// TERRITORIES / GOLD / WALKED tiles are not on the Dominia-Temp board; they
// stay for the legacy_tabs layout only.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import Accordion from '../components/Accordion';
import { HistoryRow } from '../components/ActivityLogEvent';
import AllianceEmblem from '../components/AllianceEmblem';
import SlantAvatar from '../components/SlantAvatar';
import {
  ChangePasswordSection,
  DeleteAccountSection,
  exitToSignIn,
} from './ProfileScreen';
import { supabase } from '../lib/supabase';
import { getMe, patchMe } from '../lib/meApi';
import { getActivityLog } from '../lib/activityLogApi';
import { patchAllianceChatPushEnabled } from '../lib/chatApi';
import { historyItem, isVisibleInFigma } from '../lib/activityHistory';
import { fetchActivityBests } from '../lib/activityBestsApi';
import { clearFcmToken } from '../lib/fcm';
import { avatarSource, avatarSyncValue } from '../lib/avatar';
import { navigateTo } from '../lib/navigation';
import { useFlag } from '../lib/flags';
import { formatDistance, saveUnits, setUnits, useUnits } from '../lib/units';
import { heldDays, initialSections, optionalCount, padCount, toggleSection } from '../lib/profile';
import { colors, fonts } from '../lib/theme';

const RECENT_ACTIVITY_LIMIT = 5;

function PencilGlyph({ size = 14, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M3 17 L3.6 13.6 L13.4 3.8 L16.2 6.6 L6.4 16.4 Z" stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M11.6 5.6 L14.4 8.4" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function ChevronLeftGlyph({ size = 16, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Polyline points="10,3 5,8 10,13" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

// Section glyphs for the accordion tiles (board 33): folded map, list,
// rising chart, gear, bar chart.
const G = { stroke: colors.white, strokeWidth: 1.5, fill: 'none' };
function MapGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M1.5 3.5 L5.5 2 L10.5 3.5 L14.5 2 V12.5 L10.5 14 L5.5 12.5 L1.5 14 Z" {...G} />
      <Line x1="5.5" y1="2" x2="5.5" y2="12.5" {...G} />
      <Line x1="10.5" y1="3.5" x2="10.5" y2="14" {...G} />
    </Svg>
  );
}
export function ListGlyph({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Rect x="2" y="2" width="12" height="12" {...G} />
      <Line x1="5" y1="5.5" x2="11" y2="5.5" {...G} />
      <Line x1="5" y1="8" x2="11" y2="8" {...G} />
      <Line x1="5" y1="10.5" x2="11" y2="10.5" {...G} />
    </Svg>
  );
}
function ChartGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Polyline points="2,10 6,6 9,8.5 14,3.5" {...G} />
      <Polyline points="10.5,3.5 14,3.5 14,7" {...G} />
      <Line x1="3" y1="14" x2="3" y2="12.5" {...G} />
      <Line x1="6.5" y1="14" x2="6.5" y2="10.5" {...G} />
      <Line x1="10" y1="14" x2="10" y2="11.5" {...G} />
      <Line x1="13.5" y1="14" x2="13.5" y2="9.5" {...G} />
    </Svg>
  );
}
const GEAR_SPOKES = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const r = (deg * Math.PI) / 180;
  return { deg, x1: 8 + Math.cos(r) * 4.6, y1: 8 + Math.sin(r) * 4.6, x2: 8 + Math.cos(r) * 6.6, y2: 8 + Math.sin(r) * 6.6 };
});
function GearGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="2.6" {...G} />
      {GEAR_SPOKES.map(({ deg, ...p }) => <Line key={deg} {...p} {...G} />)}
    </Svg>
  );
}
function BarsGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Line x1="3.5" y1="14" x2="3.5" y2="8" {...G} />
      <Line x1="8" y1="14" x2="8" y2="2.5" {...G} />
      <Line x1="12.5" y1="14" x2="12.5" y2="6" {...G} />
    </Svg>
  );
}

// "‹ Title" back row over a hairline (boards 33 and 38). Shared with Edit
// Profile. Without `onBack` (Profile as a legacy tab) the title stands alone.
export function BackRow({ title, onBack, backLabel }) {
  const insets = useSafeAreaInsets();
  const titleText = (
    <Text style={styles.backTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3} numberOfLines={1}>
      {title}
    </Text>
  );
  return (
    <View style={[styles.backRow, { paddingTop: insets.top + 6 }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.backPress, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeftGlyph />
          {titleText}
        </Pressable>
      ) : (
        <View style={styles.backPress}>{titleText}</View>
      )}
      <View style={styles.backRule} />
    </View>
  );
}

function FlagGlyph({ size = 18, color = colors.self }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path d="M4 2 V16" stroke={color} strokeWidth={1.8} />
      <Path d="M4 3 H13 L11 6 L13 9 H4" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

// "18 NOV" in the app language.
function shortDate(iso, locale) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  let month;
  try {
    month = d.toLocaleDateString(locale || 'en', { month: 'short' });
  } catch (_) {
    month = d.toLocaleDateString('en', { month: 'short' });
  }
  return `${d.getDate()} ${String(month).replace(/\.$/, '').toUpperCase()}`;
}

function StatTile({ label, value, icon, first }) {
  return (
    <View style={[styles.tile, !first && styles.tileJoined]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.tileLabel} maxFontSizeMultiplier={1.3} numberOfLines={1}>{label}</Text>
      <View style={styles.tileValueRow}>
        {icon}
        <Text style={styles.tileValue} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// "Alliance Chat Push Notifications  OFF/ON" (board 37): tapping the row
// flips it with the same optimistic PATCH as ProfileScreen, reverting on
// failure.
function ChatPushRow({ playerRow, clerkGetToken, label, onText, offText }) {
  const [enabled, setEnabled] = useState(playerRow?.alliance_chat_push_enabled !== false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (playerRow != null) setEnabled(playerRow.alliance_chat_push_enabled !== false);
  }, [playerRow]);
  const onPress = async () => {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    const result = await patchAllianceChatPushEnabled({ clerkGetToken, enabled: next });
    if (!result.ok) setEnabled(!next);
    setPending(false);
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled, disabled: pending }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{enabled ? onText : offText}</Text>
    </Pressable>
  );
}

function Row({ label, value, onPress, a11yLabel, a11yHint, chevron }) {
  const content = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      {value != null ? <Text style={styles.rowValue}>{value}</Text> : null}
      {chevron ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={a11yLabel ?? `${label} ${value ?? ''}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityHint={a11yHint}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SectionMessage({ text, onRetry, retryLabel }) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageText}>{text}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.retry, pressed && styles.rowPressed]}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Lazily loads once on first open; `reload` re-runs it (retry).
function useLazyLoad(open, loader) {
  const [state, setState] = useState({ status: 'idle', data: null });
  const startedRef = useRef(false);
  const run = useCallback(async () => {
    setState({ status: 'loading', data: null });
    const res = await loader();
    setState(res.ok ? { status: 'ready', data: res.data } : { status: 'error', data: null });
  }, [loader]);
  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      run();
    }
  }, [open, run]);
  return [state, run];
}

export default function ProfileAccordionScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { signOut, userId, getToken } = useAuth();
  const { user } = useUser();
  const legacyTabs = useFlag('legacy_tabs');
  const units = useUnits();

  const [sections, setSections] = useState(initialSections);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [playerRow, setPlayerRow] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [allianceTag, setAllianceTag] = useState(null);
  const [allianceEmblem, setAllianceEmblem] = useState(null);
  const [claimedAt, setClaimedAt] = useState({});
  const [walkedM, setWalkedM] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [territoriesError, setTerritoriesError] = useState(false);
  const [goldUsed, setGoldUsed] = useState(null);
  const [savingUnits, setSavingUnits] = useState(false);
  const loadedOnceRef = useRef(false);
  // Clerk's getToken is not referentially stable across renders. Reading it
  // through a ref keeps the loaders below stable, so the focus effect runs
  // once per focus instead of after every state update (which looped and
  // tripped the backend rate limit).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const stableGetToken = useCallback((...args) => getTokenRef.current(...args), []);
  // Clerk's user object is read through a ref for the same reason.
  const userRef = useRef(user);
  userRef.current = user;
  const avatarSyncedRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    // Spinner only on the first load; focus refreshes update in place.
    if (!loadedOnceRef.current) setLoading(true);
    setLoadError(false);

    const [{ data: player, error }, me] = await Promise.all([
      supabase
        .from('players')
        .select('id, username, level, alliance_id, gold, alliance_chat_push_enabled, avatar_url')
        .eq('clerk_id', userId)
        .maybeSingle(),
      getMe({ clerkGetToken: stableGetToken }),
    ]);

    if (error || !player) {
      if (!loadedOnceRef.current) setLoadError(true);
      setLoading(false);
      return;
    }
    setPlayerRow(player);

    // A failed avatar PATCH after an upload leaves players.avatar_url stale;
    // Clerk holds the photo, so re-sync the cache once per mount (plan U10).
    const syncValue = avatarSyncedRef.current ? undefined : avatarSyncValue(player.avatar_url, userRef.current);
    if (syncValue !== undefined) {
      avatarSyncedRef.current = true;
      patchMe({ clerkGetToken: stableGetToken, fields: { avatar_url: syncValue } }).then((res) => {
        if (res.ok) setPlayerRow((row) => (row ? { ...row, avatar_url: syncValue } : row));
      });
    } else if (userRef.current) {
      avatarSyncedRef.current = true;
    }

    // `units` and total Gold used are planned backend fields (U6 / U16); until
    // GET /me returns them the unit stays on km and Gold used shows a dash.
    if (me.ok) {
      const mePlayer = me.data?.player;
      if (mePlayer?.units) setUnits(mePlayer.units);
      setGoldUsed(optionalCount(mePlayer, ['total_gold_used', 'gold_used']));
      // WALKED tile: lifetime distance once GET /me returns it; a dash until then.
      setWalkedM(optionalCount(mePlayer, ['total_distance_m', 'lifetime_distance_m']));
    }

    const [allianceRes, territoriesRes, historyRes] = await Promise.all([
      player.alliance_id
        ? supabase.from('alliances').select('name, short_name, emblem').eq('id', player.alliance_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('territories')
        .select('id, territory_name, tier, latitude, longitude')
        .eq('owner_id', player.id),
      // Open territory_history rows give each held territory's claim time
      // for "CLAIMED · HELD N DAYS" and the date; rows without one show
      // CLAIMED alone.
      supabase
        .from('territory_history')
        .select('territory_id, claimed_at')
        .eq('owner_id', player.id)
        .is('lost_at', null),
    ]);
    setAllianceName(allianceRes.data?.name ?? null);
    setAllianceTag(allianceRes.data?.short_name ?? null);
    setAllianceEmblem(allianceRes.data?.emblem ?? null);
    const claimed = {};
    if (!historyRes?.error) {
      for (const row of historyRes?.data ?? []) {
        if (row?.territory_id && row.claimed_at) claimed[row.territory_id] = row.claimed_at;
      }
    }
    setClaimedAt(claimed);
    setTerritoriesError(!!territoriesRes.error);
    setTerritories(territoriesRes.error ? [] : territoriesRes.data ?? []);

    loadedOnceRef.current = true;
    setLoading(false);
  }, [userId, stableGetToken]);

  // Refresh on focus so a name or photo change in Edit Profile shows on return.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const loadActivity = useCallback(
    () => getActivityLog({ clerkGetToken: stableGetToken, limit: RECENT_ACTIVITY_LIMIT }),
    [stableGetToken],
  );
  const loadStats = useCallback(() => fetchActivityBests({ clerkGetToken: stableGetToken }), [stableGetToken]);
  const [activity, reloadActivity] = useLazyLoad(sections.activity, loadActivity);
  const [stats, reloadStats] = useLazyLoad(sections.statistics, loadStats);

  const onToggle = (key) => setSections((s) => toggleSection(s, key));

  const onUnitsPress = async () => {
    if (savingUnits) return;
    setSavingUnits(true);
    const next = units === 'mi' ? 'km' : 'mi';
    const res = await saveUnits(next, (unit) =>
      patchMe({ clerkGetToken: getToken, fields: { units: unit } }),
    );
    setSavingUnits(false);
    if (!res.ok) {
      Toast.show({
        type: 'error',
        text1: t('profileAccordion.unitsFailedTitle', { defaultValue: 'Units not saved' }),
        text2: t('profileAccordion.unitsFailedBody', { defaultValue: 'Could not update your units. Please try again.' }),
        position: 'top',
      });
    }
  };

  const onSignOut = () => {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
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
          exitToSignIn(navigation);
        },
      },
    ]);
  };

  // With legacy_tabs off Profile is a root stack screen opened from the
  // header avatar and needs its own way back; as a tab it has none.
  const showBack = !legacyTabs && navigation.canGoBack();
  const editLabel = t('profileAccordion.editProfile', { defaultValue: 'Edit Profile' });
  const header = (
    <BackRow
      title={t('profileAccordion.title', { defaultValue: 'Profile' })}
      onBack={showBack ? () => navigation.goBack() : undefined}
      backLabel={t('common.back', { defaultValue: 'Back' })}
    />
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.bone} />
        </View>
      </View>
    );
  }

  const unitLabel = units === 'mi'
    ? t('profileAccordion.unitsMiles', { defaultValue: 'Miles' })
    : t('profileAccordion.unitsKilometers', { defaultValue: 'Kilometres' });
  const level = playerRow?.level != null && Number.isFinite(Number(playerRow.level)) ? Number(playerRow.level) : null;
  const allianceLine = allianceName
    ? `${allianceName}${allianceTag ? ` [${allianceTag}]` : ''}`
    : null;
  const walked = walkedM == null ? '—' : formatDistance(walkedM, units).toUpperCase();
  const territoryCount = territoriesError ? null : padCount(territories.length);
  const now = new Date();
  const recentItems = (activity.data?.events ?? []).filter(isVisibleInFigma).map(historyItem);
  const retryLabel = t('common.retry');
  const username = playerRow?.username ?? '—';
  const avatar = avatarSource(playerRow, 64);
  const gold = Math.max(0, Number(playerRow?.gold) || 0);

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {loadError ? (
          <SectionMessage
            text={t('profile.errCouldNotLoad')}
            onRetry={loadProfile}
            retryLabel={retryLabel}
          />
        ) : (
          <>
            <View style={styles.identity}>
              <SlantAvatar
                uri={avatar.kind === 'photo' ? avatar.uri : null}
                height={64}
                accessibilityLabel={t('editProfile.photoA11y', { defaultValue: 'Your profile photo' })}
              />
              <View style={styles.identityText}>
                <Text style={styles.username} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {username}
                </Text>
                <View style={styles.allianceRow}>
                  {level != null ? (
                    <Text style={styles.levelText} maxFontSizeMultiplier={1.3}>
                      {t('profileAccordion.levelChip', { defaultValue: 'LVL {{level}}', level })}
                    </Text>
                  ) : null}
                  <Text style={styles.allianceText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {allianceLine ?? t('profileAccordion.noAlliance', { defaultValue: 'No alliance' })}
                  </Text>
                  {allianceLine ? <AllianceEmblem emblem={allianceEmblem} size={14} glyph="#9D9D9D" shield="#9D9D9D" field="none" /> : null}
                </View>
              </View>
              <Pressable
                onPress={() => navigation.navigate('EditProfile')}
                accessibilityRole="button"
                accessibilityLabel={editLabel}
                hitSlop={8}
                style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.editText} maxFontSizeMultiplier={1.3}>{editLabel}</Text>
                <PencilGlyph />
              </Pressable>
            </View>
            <View style={styles.identityRule} />
            {legacyTabs ? (
              <View style={styles.tilesWrap}>
                <View style={styles.tiles}>
                  <StatTile
                    first
                    label={t('profileAccordion.tileTerritories', { defaultValue: 'Territories' })}
                    value={territoryCount ?? '—'}
                  />
                  <StatTile
                    label={t('profileAccordion.tileGold', { defaultValue: 'Gold' })}
                    value={gold.toLocaleString()}
                  />
                  <StatTile
                    label={t('profileAccordion.tileWalked', { defaultValue: 'Walked' })}
                    value={walked}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}

        <Accordion
          title={t('profileAccordion.territories', { defaultValue: 'Your Territories' })}
          icon={<MapGlyph />}
          meta={territoryCount}
          expanded={sections.territories}
          onToggle={() => onToggle('territories')}
        >
          {territoriesError ? (
            <SectionMessage
              text={t('profile.errCouldNotLoadTerritories')}
              onRetry={loadProfile}
              retryLabel={retryLabel}
            />
          ) : territories.length === 0 ? (
            <SectionMessage text={t('profile.noTerritories')} />
          ) : (
            territories.map((terr, index) => {
              const lat = Number(terr.latitude);
              const lng = Number(terr.longitude);
              const canLocate = Number.isFinite(lat) && Number.isFinite(lng);
              const name = terr.territory_name ?? t('common.territoryFallback');
              const since = claimedAt[terr.id] ?? null;
              const days = heldDays(since, now);
              const status = days == null
                ? t('profileAccordion.claimed', { defaultValue: 'Claimed' })
                : t('profileAccordion.claimedHeld', { defaultValue: 'Claimed · Held {{count}} days', count: days });
              const date = shortDate(since, i18n.language);
              return (
                <React.Fragment key={terr.id ?? `${name}-${index}`}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    disabled={!canLocate}
                    accessibilityRole={canLocate ? 'button' : undefined}
                    accessibilityLabel={[name, status, date].filter(Boolean).join(', ')}
                    accessibilityHint={canLocate ? t('profileAccordion.showOnMapHint', { defaultValue: 'Shows this territory on the map' }) : undefined}
                    onPress={() => navigateTo('Map', {
                      focusTerritory: { id: terr.id, name: terr.territory_name, latitude: lat, longitude: lng },
                      focusNonce: Date.now(),
                    })}
                    style={({ pressed }) => [styles.terrRow, pressed && styles.rowPressed]}
                  >
                    <View style={styles.flagTile}>
                      <FlagGlyph />
                    </View>
                    <View style={styles.terrText}>
                      <Text style={styles.terrName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{name}</Text>
                      <Text style={styles.terrStatus} numberOfLines={1} maxFontSizeMultiplier={1.3}>{status}</Text>
                    </View>
                    {date ? <Text style={styles.terrDate} maxFontSizeMultiplier={1.3}>{date}</Text> : null}
                  </Pressable>
                </React.Fragment>
              );
            })
          )}
        </Accordion>

        <Accordion
          title={t('profileAccordion.activity', { defaultValue: 'Activity' })}
          icon={<ListGlyph />}
          expanded={sections.activity}
          onToggle={() => onToggle('activity')}
        >
          {activity.status === 'loading' || activity.status === 'idle' ? (
            <ActivityIndicator color={colors.bone} style={styles.inlineSpinner} />
          ) : activity.status === 'error' ? (
            <SectionMessage
              text={t('activityLog.failedToLoad')}
              onRetry={reloadActivity}
              retryLabel={retryLabel}
            />
          ) : recentItems.length === 0 ? (
            <SectionMessage text={t('activityLog.emptyBody')} />
          ) : (
            <>
              <View style={styles.bleed}>
                {recentItems.map((item) => (
                  <HistoryRow key={item.id} item={item} />
                ))}
              </View>
              <Row
                label={t('profileAccordion.viewAllActivity', { defaultValue: 'View all activity' })}
                chevron
                onPress={() => navigation.navigate('ActivityLog')}
              />
            </>
          )}
        </Accordion>

        <Accordion
          title={t('profileAccordion.resources', { defaultValue: 'Resource Balance' })}
          icon={<ChartGlyph />}
          expanded={sections.resources}
          onToggle={() => onToggle('resources')}
        >
          <Row
            label={t('profileAccordion.goldBalanceRow', { defaultValue: 'Current Gold Balance' })}
            value={gold.toLocaleString()}
          />
          <Divider />
          <Row
            label={t('profileAccordion.goldUsed', { defaultValue: 'Total Gold Used' })}
            value={goldUsed == null ? '—' : goldUsed.toLocaleString()}
          />
        </Accordion>

        <Accordion
          title={t('profileAccordion.settings', { defaultValue: 'App Settings' })}
          icon={<GearGlyph />}
          expanded={sections.settings}
          onToggle={() => onToggle('settings')}
        >
          {playerRow ? (
            <>
              <ChatPushRow
                playerRow={playerRow}
                clerkGetToken={getToken}
                label={t('profileAccordion.chatPushRow', { defaultValue: 'Alliance Chat Push Notifications' })}
                onText={t('profileAccordion.on', { defaultValue: 'ON' })}
                offText={t('profileAccordion.off', { defaultValue: 'OFF' })}
              />
              <Divider />
            </>
          ) : null}
          <Row
            label={t('profileAccordion.unitsRow', { defaultValue: 'Units and Measurements' })}
            value={savingUnits ? '…' : unitLabel}
            a11yLabel={`${t('profileAccordion.unitsRow', { defaultValue: 'Units and Measurements' })}, ${unitLabel}`}
            a11yHint={t('profileAccordion.unitsHint', { defaultValue: 'Switches between kilometres and miles' })}
            onPress={onUnitsPress}
          />
          {/* ChangePasswordSection draws its own leading divider and hides
              itself for SSO-only accounts. */}
          <ChangePasswordSection />
          <Divider />
          <Row label={t('profile.signOut')} chevron onPress={onSignOut} />
          {playerRow ? (
            <>
              <Divider />
              <DeleteAccountSection
                username={playerRow.username}
                clerkGetToken={getToken}
                signOut={signOut}
                navigation={navigation}
              />
            </>
          ) : null}
        </Accordion>

        <Accordion
          title={t('profileAccordion.statistics', { defaultValue: 'Statistics' })}
          icon={<BarsGlyph />}
          expanded={sections.statistics}
          onToggle={() => onToggle('statistics')}
        >
          {stats.status === 'loading' || stats.status === 'idle' ? (
            <ActivityIndicator color={colors.bone} style={styles.inlineSpinner} />
          ) : stats.status === 'error' ? (
            <SectionMessage
              text={t('profileAccordion.statsFailed', { defaultValue: 'Could not load your statistics.' })}
              onRetry={reloadStats}
              retryLabel={retryLabel}
            />
          ) : (
            <StatsTable data={stats.data} units={units} t={t} />
          )}
        </Accordion>
      </ScrollView>
    </View>
  );
}

// Today / This week / Best for distance, active minutes, steps and claims
// (G4). GET /me/activity-bests returns today and best for distance and active
// minutes; week, steps and claims render a dash until the backend adds them.
function StatsTable({ data, units, t }) {
  const periods = [
    { key: 'today', label: t('profileAccordion.statToday', { defaultValue: 'Today' }) },
    { key: 'week', label: t('profileAccordion.statWeek', { defaultValue: 'This week' }) },
    { key: 'best', label: t('profileAccordion.statBest', { defaultValue: 'Best' }) },
  ];
  const metrics = [
    {
      key: 'distance',
      label: t('profileAccordion.statDistance', { defaultValue: 'Distance' }),
      format: (p) => (p && p.distance_m != null ? formatDistance(p.distance_m, units) : '—'),
    },
    {
      key: 'minutes',
      label: t('profileAccordion.statActiveMinutes', { defaultValue: 'Active min' }),
      format: (p) => {
        const n = optionalCount(p, ['active_minutes']);
        return n == null ? '—' : n.toLocaleString();
      },
    },
    {
      key: 'steps',
      label: t('profileAccordion.statSteps', { defaultValue: 'Total steps' }),
      format: (p) => {
        const n = optionalCount(p, ['steps']);
        return n == null ? '—' : n.toLocaleString();
      },
    },
    {
      key: 'claims',
      label: t('profileAccordion.statClaims', { defaultValue: 'Claims' }),
      format: (p) => {
        const n = optionalCount(p, ['claims', 'claim_count']);
        return n == null ? '—' : n.toLocaleString();
      },
    },
  ];
  return (
    <View style={styles.statsTable}>
      <View style={styles.statsRow}>
        <View style={styles.statsLabelCell} />
        {periods.map((p) => (
          <Text key={p.key} style={styles.statsHead} numberOfLines={1}>{p.label}</Text>
        ))}
      </View>
      {metrics.map((m) => (
        <React.Fragment key={m.key}>
          <Divider />
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabelCell, styles.statsLabel]}>{m.label}</Text>
            {periods.map((p) => {
              const value = m.format(data?.[p.key]);
              return (
                <Text
                  key={p.key}
                  style={styles.statsValue}
                  numberOfLines={1}
                  accessibilityLabel={`${m.label}, ${p.label}: ${value}`}
                >
                  {value}
                </Text>
              );
            })}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backRow: {
    paddingHorizontal: 16,
  },
  backPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingRight: 8,
  },
  backTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.white,
  },
  backRule: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  identityText: {
    flex: 1,
  },
  username: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    textTransform: 'uppercase',
    color: colors.white,
  },
  allianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  levelText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.lime,
  },
  allianceText: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted2,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  editText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.white,
  },
  identityRule: {
    height: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.hairlineStrong,
  },
  tilesWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  tiles: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  tile: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tileJoined: {
    borderLeftWidth: 1,
    borderLeftColor: colors.hairlineStrong,
  },
  tileLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  tileValue: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.bone,
  },
  terrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 10,
  },
  flagTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(132,255,68,0.24)',
  },
  terrText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  terrName: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 20,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  terrStatus: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.self,
  },
  terrDate: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.muted2,
  },
  // Activity rows carry their own 16px inset; cancel the accordion body's 14.
  bleed: {
    marginHorizontal: -14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 6,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.white,
  },
  rowValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.white,
  },
  chevron: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
  message: {
    paddingVertical: 12,
    gap: 8,
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
  },
  retry: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  retryText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  inlineSpinner: {
    paddingVertical: 16,
  },
  statsTable: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    gap: 8,
    paddingHorizontal: 10,
  },
  statsLabelCell: {
    flex: 1,
  },
  statsLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  statsHead: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  statsValue: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.bone,
  },
});
