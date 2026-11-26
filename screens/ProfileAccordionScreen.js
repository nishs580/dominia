// Figma Profile (plan U16): "< Profile" header, identity block with Edit
// Profile, and five accordion sections — Your Territories, Activity, Resource
// Balance, App Settings, Statistics. Any number can be open; all start closed.
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
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import Accordion from '../components/Accordion';
import ActivityLogEvent from '../components/ActivityLogEvent';
import {
  ActivityGlyph,
  BoardsGlyph,
  GoldGlyph,
  MapGlyph,
  ProfileGlyph,
} from '../components/ResourceGlyphs';
import {
  AllianceChatPushToggleRow,
  ChangePasswordSection,
  DeleteAccountSection,
  exitToSignIn,
} from './ProfileScreen';
import { supabase } from '../lib/supabase';
import { getMe, patchMe } from '../lib/meApi';
import { getActivityLog } from '../lib/activityLogApi';
import { fetchActivityBests } from '../lib/activityBestsApi';
import { clearFcmToken } from '../lib/fcm';
import { avatarThumb, avatarInitials } from '../lib/avatar';
import { navigateTo } from '../lib/navigation';
import { useFlag } from '../lib/flags';
import { formatDistance, saveUnits, setUnits, useUnits } from '../lib/units';
import { initialSections, optionalCount, toggleSection } from '../lib/profile';
import { colors, fonts } from '../lib/theme';

const RECENT_ACTIVITY_LIMIT = 5;
const GLYPH = 18;

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
  const { t } = useTranslation();
  const { signOut, userId, getToken } = useAuth();
  const legacyTabs = useFlag('legacy_tabs');
  const units = useUnits();

  const [sections, setSections] = useState(initialSections);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [playerRow, setPlayerRow] = useState(null);
  const [allianceName, setAllianceName] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [territoriesError, setTerritoriesError] = useState(false);
  const [goldUsed, setGoldUsed] = useState(null);
  const [savingUnits, setSavingUnits] = useState(false);
  const loadedOnceRef = useRef(false);

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
        .select('id, username, alliance_id, gold, alliance_chat_push_enabled, avatar_url')
        .eq('clerk_id', userId)
        .maybeSingle(),
      getMe({ clerkGetToken: getToken }),
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
    }

    const [allianceRes, territoriesRes] = await Promise.all([
      player.alliance_id
        ? supabase.from('alliances').select('name').eq('id', player.alliance_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('territories')
        .select('id, territory_name, tier, latitude, longitude')
        .eq('owner_id', player.id),
    ]);
    setAllianceName(allianceRes.data?.name ?? null);
    setTerritoriesError(!!territoriesRes.error);
    setTerritories(territoriesRes.error ? [] : territoriesRes.data ?? []);

    loadedOnceRef.current = true;
    setLoading(false);
  }, [userId, getToken]);

  // Refresh on focus so a name or photo change in Edit Profile shows on return.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const loadActivity = useCallback(
    () => getActivityLog({ clerkGetToken: getToken, limit: RECENT_ACTIVITY_LIMIT }),
    [getToken],
  );
  const loadStats = useCallback(() => fetchActivityBests({ clerkGetToken: getToken }), [getToken]);
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
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {showBack ? (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.rowPressed]}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
      ) : null}
      <Text style={styles.headerTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {t('profileAccordion.title', { defaultValue: 'Profile' })}
      </Text>
    </View>
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
    : t('profileAccordion.unitsKilometers', { defaultValue: 'Kilometers' });
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
              <Text style={styles.allianceName} numberOfLines={1}>
                {allianceName ?? t('profileAccordion.noAlliance', { defaultValue: 'No alliance' })}
              </Text>
              <Pressable
                onPress={() => navigation.navigate('EditProfile')}
                accessibilityRole="link"
                accessibilityLabel={t('profileAccordion.editProfile', { defaultValue: 'Edit Profile' })}
                hitSlop={12}
                style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.editLinkText}>
                  {t('profileAccordion.editProfile', { defaultValue: 'Edit Profile' })}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Accordion
          title={t('profileAccordion.territories', { defaultValue: 'Your Territories' })}
          icon={<MapGlyph size={GLYPH} color={colors.slate2} />}
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
              return (
                <React.Fragment key={terr.id ?? `${name}-${index}`}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    label={name}
                    value={terr.tier ? String(terr.tier).toUpperCase() : '—'}
                    chevron={canLocate}
                    a11yLabel={`${name}, ${terr.tier ?? ''}`}
                    a11yHint={canLocate ? t('profileAccordion.showOnMapHint', { defaultValue: 'Shows this territory on the map' }) : undefined}
                    onPress={canLocate ? () => navigateTo('Map', {
                      focusTerritory: { id: terr.id, name: terr.territory_name, latitude: lat, longitude: lng },
                      focusNonce: Date.now(),
                    }) : undefined}
                  />
                </React.Fragment>
              );
            })
          )}
        </Accordion>

        <Accordion
          title={t('profileAccordion.activity', { defaultValue: 'Activity' })}
          icon={<ActivityGlyph size={GLYPH} color={colors.slate2} />}
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
          ) : (activity.data?.events ?? []).length === 0 ? (
            <SectionMessage text={t('activityLog.emptyBody')} />
          ) : (
            <>
              {activity.data.events.map((event, index) => (
                <ActivityLogEvent key={event.id ?? index} event={event} />
              ))}
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
          icon={<GoldGlyph size={GLYPH} color={colors.slate2} />}
          expanded={sections.resources}
          onToggle={() => onToggle('resources')}
        >
          <Row
            label={t('profileAccordion.goldBalance', { defaultValue: 'Current Gold Balance' })}
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
          icon={<ProfileGlyph size={GLYPH} color={colors.slate2} />}
          expanded={sections.settings}
          onToggle={() => onToggle('settings')}
        >
          {playerRow ? (
            <>
              <AllianceChatPushToggleRow playerRow={playerRow} clerkGetToken={getToken} />
              <Divider />
            </>
          ) : null}
          <Row
            label={t('profileAccordion.units', { defaultValue: 'Units and Measurements' })}
            value={savingUnits ? '…' : unitLabel}
            a11yLabel={`${t('profileAccordion.units', { defaultValue: 'Units and Measurements' })}, ${unitLabel}`}
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
          icon={<BoardsGlyph size={GLYPH} color={colors.slate2} />}
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

// Today / This week / Best for distance, active minutes and steps. GET
// /me/activity-bests returns today and best for distance and active minutes;
// week and steps render a dash until the backend adds them.
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
      label: t('profileAccordion.statActiveMinutes', { defaultValue: 'Active minutes' }),
      format: (p) => {
        const n = optionalCount(p, ['active_minutes']);
        return n == null ? '—' : n.toLocaleString();
      },
    },
    {
      key: 'steps',
      label: t('profileAccordion.statSteps', { defaultValue: 'Steps' }),
      format: (p) => {
        const n = optionalCount(p, ['steps']);
        return n == null ? '—' : n.toLocaleString();
      },
    },
  ];
  return (
    <View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontFamily: fonts.mono,
    fontSize: 28,
    color: colors.bone,
    lineHeight: 32,
  },
  headerTitle: {
    marginLeft: 8,
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.bone,
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  avatar: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
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
  allianceName: {
    marginTop: 2,
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.slate2,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  editLink: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  editLinkText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
    textDecorationLine: 'underline',
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
    fontSize: 13,
    color: colors.bone,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    gap: 8,
  },
  statsLabelCell: {
    flex: 1.3,
  },
  statsLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone,
  },
  statsHead: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  statsValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.bone,
  },
});
