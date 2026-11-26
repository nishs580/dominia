// Figma Profile (plan U16; G1–G4 parity in plan 2026-11-27 U13): "← PROFILE"
// header with the edit pencil, identity block (avatar, name, LVL chip,
// alliance "NAME [TAG]" chip), TERRITORIES / GOLD / WALKED tiles, and five
// accordion sections — Your Territories, Activity, Resource Balance, App
// Settings, Statistics. Any number can be open; all start closed.
//
// Mounted by App.js for the Profile route when `power_rank` is off; with it on
// the route mounts today's ProfileScreen. Settings rows (chat push, change
// password, delete account) are ProfileScreen's own components, imported.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import Accordion from '../components/Accordion';
import { HistoryRow } from '../components/ActivityLogEvent';
import BackTitleHeader from '../components/BackTitleHeader';
import { GoldGlyph } from '../components/ResourceGlyphs';
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
import { avatarThumb, avatarInitials } from '../lib/avatar';
import { navigateTo } from '../lib/navigation';
import { useFlag } from '../lib/flags';
import { formatDistance, saveUnits, setUnits, useUnits } from '../lib/units';
import { heldDays, initialSections, optionalCount, padCount, toggleSection } from '../lib/profile';
import { colors, fonts } from '../lib/theme';

const RECENT_ACTIVITY_LIMIT = 5;

function PencilGlyph({ size = 20, color = colors.bone }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M3 17 L3.6 13.6 L13.4 3.8 L16.2 6.6 L6.4 16.4 Z" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M11.6 5.6 L14.4 8.4" stroke={color} strokeWidth={1.6} />
    </Svg>
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

// G2: "Alliance chat push notifications" with a switch. Same optimistic
// PATCH as ProfileScreen's on/off text row, reverting on failure.
function ChatPushSwitchRow({ playerRow, clerkGetToken, label }) {
  const [enabled, setEnabled] = useState(playerRow?.alliance_chat_push_enabled !== false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (playerRow != null) setEnabled(playerRow.alliance_chat_push_enabled !== false);
  }, [playerRow]);
  const onChange = async (next) => {
    if (pending) return;
    setEnabled(next);
    setPending(true);
    const result = await patchAllianceChatPushEnabled({ clerkGetToken, enabled: next });
    if (!result.ok) setEnabled(!next);
    setPending(false);
  };
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={enabled}
        onValueChange={onChange}
        disabled={pending}
        accessibilityLabel={label}
        trackColor={{ false: colors.raised, true: colors.lime }}
        thumbColor={enabled ? colors.onLime : colors.muted2}
        ios_backgroundColor={colors.raised}
      />
    </View>
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
  const legacyTabs = useFlag('legacy_tabs');
  const units = useUnits();

  const [sections, setSections] = useState(initialSections);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [playerRow, setPlayerRow] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [allianceTag, setAllianceTag] = useState(null);
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
        ? supabase.from('alliances').select('name, short_name').eq('id', player.alliance_id).maybeSingle()
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
    <BackTitleHeader
      title={t('profileAccordion.title', { defaultValue: 'Profile' })}
      onBack={showBack ? () => navigation.goBack() : undefined}
      right={
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel={editLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.pencil, pressed && { opacity: 0.6 }]}
        >
          <PencilGlyph />
        </Pressable>
      }
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
  const allianceChip = allianceName
    ? `${allianceName}${allianceTag ? ` [${allianceTag}]` : ''}`
    : null;
  const walked = walkedM == null ? '—' : formatDistance(walkedM, units).toUpperCase();
  const territoryCount = territoriesError ? null : padCount(territories.length);
  const now = new Date();
  const recentItems = (activity.data?.events ?? []).filter(isVisibleInFigma).map(historyItem);
  const retryLabel = t('common.retry');
  const username = playerRow?.username ?? '—';
  const avatarUrl = playerRow?.avatar_url ?? null;
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
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarThumb(avatarUrl, 72) }}
                  style={styles.avatar}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{avatarInitials(playerRow?.username)}</Text>
                </View>
              )}
              <View style={styles.identityText}>
                <Text style={styles.username} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {username}
                </Text>
                <View style={styles.chips}>
                  {level != null ? (
                    <View style={[styles.chip, styles.chipLevel]}>
                      <Text style={[styles.chipText, styles.chipLevelText]} maxFontSizeMultiplier={1.3}>
                        {t('profileAccordion.levelChip', { defaultValue: 'LVL {{level}}', level })}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.chip, allianceChip ? styles.chipAlliance : styles.chipNone]}>
                    <Text style={styles.chipText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                      {allianceChip ?? t('profileAccordion.noAlliance', { defaultValue: 'No alliance' })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
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
          </>
        )}

        <Accordion
          title={t('profileAccordion.territories', { defaultValue: 'Your Territories' })}
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
          expanded={sections.resources}
          onToggle={() => onToggle('resources')}
        >
          <View style={styles.tiles}>
            <StatTile
              first
              label={t('profileAccordion.goldBalance', { defaultValue: 'Current Gold' })}
              value={gold.toLocaleString()}
              icon={<View style={styles.tileIcon}><GoldGlyph size={18} color={colors.lime} strokeWidth={3} /></View>}
            />
            <StatTile
              label={t('profileAccordion.goldUsed', { defaultValue: 'Total Gold Used' })}
              value={goldUsed == null ? '—' : goldUsed.toLocaleString()}
            />
          </View>
          <Text style={styles.resourceCopy}>
            {t('profileAccordion.goldCopy', {
              defaultValue: 'Earn Gold from missions, daily rewards and winning territory. Spend it to claim, contest and defend.',
            })}
          </Text>
        </Accordion>

        <Accordion
          title={t('profileAccordion.settings', { defaultValue: 'App Settings' })}
          expanded={sections.settings}
          onToggle={() => onToggle('settings')}
        >
          {playerRow ? (
            <>
              <ChatPushSwitchRow
                playerRow={playerRow}
                clerkGetToken={getToken}
                label={t('profileAccordion.chatPush', { defaultValue: 'Alliance chat push notifications' })}
              />
              <Divider />
            </>
          ) : null}
          <Row
            label={t('profileAccordion.units', { defaultValue: 'Units and measurements' })}
            value={savingUnits ? '…' : unitLabel}
            chevron
            a11yLabel={`${t('profileAccordion.units', { defaultValue: 'Units and measurements' })}, ${unitLabel}`}
            a11yHint={t('profileAccordion.unitsHint', { defaultValue: 'Switches between kilometres and miles' })}
            onPress={onUnitsPress}
          />
          {/* ChangePasswordSection draws its own leading divider and hides
              itself for SSO-only accounts. */}
          <ChangePasswordSection />
          <Divider />
          <Row label={t('profile.signOut')} onPress={onSignOut} />
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
  pencil: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  // Your own avatar wears the self (green) outline, as on the map.
  avatar: {
    width: 72,
    height: 72,
    borderWidth: 2,
    borderColor: colors.self,
    backgroundColor: colors.ink2,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 24,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  identityText: {
    flex: 1,
  },
  username: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  chipLevel: {
    backgroundColor: colors.limeSoft,
  },
  chipAlliance: {
    backgroundColor: 'rgba(49,85,255,0.28)',
  },
  chipNone: {
    backgroundColor: colors.raised,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.bone2,
  },
  chipLevelText: {
    color: colors.lime,
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
  tileIcon: {
    marginRight: 6,
  },
  tileValue: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.bone,
  },
  resourceCopy: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
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
    backgroundColor: 'rgba(34,214,94,0.24)',
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
  // Activity rows carry their own 16px inset; cancel the accordion body's.
  bleed: {
    marginHorizontal: -16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 6,
  },
  rowPressed: {
    backgroundColor: colors.ink2,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.bone,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  chevron: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: colors.slate2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
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
