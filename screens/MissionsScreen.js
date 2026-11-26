// Figma Missions tab (plan U14, frames E1–E5 in U11), mounted with
// legacy_tabs off; legacy_tabs on keeps ActivityScreen. Daily MARCH / RANGE
// missions over the existing challenge APIs: GET /me/challenges/today for
// progress and the server lock, POST /me/challenges/lock-axis for LOCK (no
// confirmation: Figma has none), POST /me/challenge-complete for CLAIM.
// Decisions and display models live in lib/missions.js.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import TabScreenHeader from '../components/TabScreenHeader';
import FeatureExplainer from '../components/FeatureExplainer';
import WeeklyTaskCard from '../components/WeeklyTaskCard';
import { AllianceGlyph, GoldGlyph } from '../components/ResourceGlyphs';
import { ClockGlyph, InfoGlyph, LockGlyph, PinGlyph, StepsGlyph } from '../components/MissionGlyphs';
import { fetchChallengesToday } from '../lib/challengesTodayApi';
import { getAllianceById, getMyAlliance } from '../lib/allianceApi';
import { navigateTo } from '../lib/navigation';
import * as activityProducer from '../lib/activity';
import { formatDistance, useUnits } from '../lib/units';
import {
  MISSION_TYPES,
  MISSIONS_EXPLAINER,
  carryStorageKey,
  typeDescription,
  buildMissionRows,
  missionRowView,
  sectionLabel,
  typeSubtitle,
  lockButtonCopy,
  lockedView,
  initialLockState,
  lockReducer,
  isToggleEnabled,
  lockNow,
  lockMissionType,
  claimMission,
  errorCopy,
  applyClaim,
  localDayKey,
  snapshotClaimables,
  carriedOverMissions,
  removeCarried,
  nextSnapshot,
  refreshCountdown,
  nextCountdownDelay,
  dayRolled,
  allianceSection,
} from '../lib/missions';
import { colors, fonts } from '../lib/theme';

const POLL_MS = 60 * 1000;

const TYPE_LABEL = {
  march: { key: 'missions.typeMarch', defaultValue: 'MARCH' },
  range: { key: 'missions.typeRange', defaultValue: 'RANGE' },
};
const TIER_LABEL = {
  easy: { key: 'missions.tierEasy', defaultValue: 'EASY' },
  medium: { key: 'missions.tierMedium', defaultValue: 'MEDIUM' },
  hard: { key: 'missions.tierHard', defaultValue: 'HARD' },
};

function tc(t, copy, extra) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...(copy.params ?? {}), ...(extra ?? {}) });
}

export default function MissionsScreen() {
  const { t } = useTranslation();
  const { userId, getToken } = useAuth();
  const units = useUnits();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const tokenFn = useCallback(() => getTokenRef.current(), []);

  // ── Today ───────────────────────────────────────────────────────────────
  const [today, setToday] = useState(null); // { data, dayKey }
  const [loadError, setLoadError] = useState(false);
  const [lock, dispatch] = useReducer(lockReducer, initialLockState);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [claimingKeys, setClaimingKeys] = useState(() => new Set());
  const [claimError, setClaimError] = useState(null); // { mission, error }
  const loadedOnce = useRef(false);

  const loadToday = useCallback(async () => {
    try {
      await activityProducer.flushNow();
    } catch (_) {
      // Non-fatal: the server aggregate is just a little behind.
    }
    const dayKey = localDayKey(new Date());
    const res = await fetchChallengesToday({ clerkGetToken: tokenFn });
    if (!res.ok) {
      // Keep a loaded day on screen; only an empty screen shows the error.
      if (!loadedOnce.current) setLoadError(true);
      return;
    }
    loadedOnce.current = true;
    setLoadError(false);
    setToday({ data: res.data, dayKey });
    setCompletedKeys(new Set((res.data.completed ?? []).map((c) => c.challenge_key)));
    dispatch({ type: 'LOADED', lockedAxis: res.data.locked_axis ?? null });
  }, [tokenFn]);

  useFocusEffect(
    useCallback(() => {
      loadToday();
      const id = setInterval(loadToday, POLL_MS);
      return () => clearInterval(id);
    }, [loadToday]),
  );

  // ── Countdown to local midnight ─────────────────────────────────────────
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setTimeout(() => setNow(new Date()), nextCountdownDelay(now));
    return () => clearTimeout(id);
  }, [now]);
  const countdown = refreshCountdown(now);

  useEffect(() => {
    if (today && dayRolled(today.dayKey, now)) {
      dispatch({ type: 'DAY_ROLLED' });
      loadToday();
    }
  }, [now, today, loadToday]);

  // ── Rows and carry-over ─────────────────────────────────────────────────
  const rows = useMemo(
    () => buildMissionRows({
      type: lock.type,
      aggregates: today?.data?.aggregates,
      completedKeys,
      lockedType: lock.lockedType,
      claimingKeys,
    }),
    [lock.type, lock.lockedType, today, completedKeys, claimingKeys],
  );

  const [carry, setCarry] = useState(null);
  const carryLoaded = useRef(false);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    AsyncStorage.getItem(carryStorageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        try {
          setCarry(raw ? JSON.parse(raw) : null);
        } catch (_) {
          setCarry(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        carryLoaded.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persistCarry = useCallback((next) => {
    setCarry(next);
    if (!userId) return;
    const key = carryStorageKey(userId);
    (next ? AsyncStorage.setItem(key, JSON.stringify(next)) : AsyncStorage.removeItem(key)).catch(() => {});
  }, [userId]);

  // Keep the snapshot of reached-but-unclaimed missions current for the day
  // the data was loaded on.
  const currentDayKey = localDayKey(now);
  useEffect(() => {
    if (!carryLoaded.current || !today) return;
    const snap = snapshotClaimables({ dayKey: today.dayKey, rows });
    const next = nextSnapshot(carry, snap, currentDayKey);
    if (JSON.stringify(next) !== JSON.stringify(carry)) persistCarry(next);
  }, [rows, today, carry, currentDayKey, persistCarry]);

  const carried = useMemo(
    () => carriedOverMissions(carry, currentDayKey).map((m) => ({
      ...m,
      claiming: claimingKeys.has(`carry:${m.challengeKey}`),
      canClaim: !claimingKeys.has(`carry:${m.challengeKey}`),
    })),
    [carry, currentDayKey, claimingKeys],
  );

  // ── LOCK ────────────────────────────────────────────────────────────────
  const lockFn = useCallback((type) => lockMissionType({ clerkGetToken: tokenFn, type }), [tokenFn]);

  const onLock = useCallback(() => {
    lockNow({ state: lock, lock: lockFn, dispatch });
  }, [lock, lockFn]);

  const onRetryLock = useCallback(async () => {
    dispatch({ type: 'LOCK_STARTED' });
    const res = await lockFn(lock.type);
    if (res.ok) dispatch({ type: 'LOCK_SUCCEEDED', lockedType: res.lockedType });
    else dispatch({ type: 'LOCK_FAILED', error: res });
  }, [lockFn, lock.type]);

  // ── CLAIM ───────────────────────────────────────────────────────────────
  const onClaim = useCallback(async (mission) => {
    const busyKey = mission.forDate ? `carry:${mission.challengeKey}` : mission.challengeKey;
    if (claimingKeys.has(busyKey)) return;
    setClaimError(null);
    setClaimingKeys((prev) => new Set([...prev, busyKey]));
    try {
      try {
        await activityProducer.flushNow();
      } catch (_) { /* non-fatal */ }
      const res = await claimMission({ clerkGetToken: tokenFn, mission, forDate: mission.forDate });
      if (!res.ok) {
        setClaimError({ mission, error: res });
        if (res.code === 'axis_locked') loadToday();
        return;
      }
      if (mission.forDate) {
        persistCarry(removeCarried(carry, mission.challengeKey, mission.forDate));
      } else {
        // Today's snapshot drops it on the next render once it is secured.
        setCompletedKeys((prev) => applyClaim(prev, mission, res).completedKeys);
      }
      if (res.gold > 0) {
        Toast.show({
          type: 'info',
          position: 'top',
          text1: t('missions.claimedToast', { defaultValue: '+{{n}} Gold secured', n: res.gold }),
        });
      }
      loadToday();
    } finally {
      setClaimingKeys((prev) => {
        const next = new Set(prev);
        next.delete(busyKey);
        return next;
      });
    }
  }, [claimingKeys, tokenFn, carry, persistCarry, loadToday, t]);

  // ── Alliance ────────────────────────────────────────────────────────────
  const [alliance, setAlliance] = useState({ loaded: false, error: null, allianceId: null });
  const [allianceName, setAllianceName] = useState(null);
  const loadAlliance = useCallback(async () => {
    const res = await getMyAlliance({ clerkGetToken: tokenFn });
    if (res.ok) setAlliance({ loaded: true, error: null, allianceId: res.data?.alliance_id ?? null });
    else setAlliance((prev) => (prev.loaded && !prev.error ? prev : { loaded: true, error: res.error || 'load_failed', allianceId: null }));
  }, [tokenFn]);
  // The alliance name tag on the alliance mission card (Figma E1).
  useEffect(() => {
    const id = alliance.allianceId;
    if (!id) {
      setAllianceName(null);
      return undefined;
    }
    let cancelled = false;
    getAllianceById({ clerkGetToken: tokenFn, allianceId: id }).then((res) => {
      if (!cancelled && res.ok) setAllianceName(res.data?.alliance?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [alliance.allianceId, tokenFn]);
  useFocusEffect(useCallback(() => { loadAlliance(); }, [loadAlliance]));
  const allianceView = allianceSection(alliance);

  // ── Explainer ───────────────────────────────────────────────────────────
  const [explainerReopen, setExplainerReopen] = useState(0);
  const explainerPages = useMemo(() => [{
    title: t('missions.explainerTitle', { defaultValue: 'MISSIONS TYPE' }),
    body: t('missions.explainerBody', {
      defaultValue: 'You can lock a mission type for the day. Once locked, it can\u2019t be changed until the next day.',
    }),
    rows: [
      {
        icon: <StepsGlyph size={20} color={colors.lime} />,
        title: tc(t, TYPE_LABEL.march),
        body: t('missions.explainerMarch', { defaultValue: 'Missions count your steps.' }),
      },
      {
        icon: <PinGlyph size={20} color={colors.lime} />,
        title: tc(t, TYPE_LABEL.range),
        body: t('missions.explainerRange', { defaultValue: 'Missions count the distance you cover.' }),
      },
    ],
    footer: t('missions.explainerFooter', {
      defaultValue: 'Once locked, the type stays until missions refresh. Finish a mission, then tap Claim to collect its Gold.',
    }),
  }], [t]);

  // ── Render ──────────────────────────────────────────────────────────────
  const toggleEnabled = isToggleEnabled(lock);
  const countdownText = tc(t, countdown);
  const noMissionsToday = today?.data?.is_challenge_day === false;
  const lockedOther = lock.lockedType === 'other';
  const locked = lockedView(lock);
  const fmtDistance = (m) => formatDistance(m, units);
  const section = sectionLabel(tc(t, TYPE_LABEL[lock.type]), rows);

  function renderRow(row, keyPrefix = '') {
    const view = missionRowView(row, fmtDistance);
    const tier = tc(t, TIER_LABEL[row.tier]);
    const title = tc(t, view.title);
    const gold = t('missions.goldReward', { defaultValue: '{{n}} Gold', n: row.gold });
    const chip = view.chip ? tc(t, view.chip) : null;
    return (
      <View key={`${keyPrefix}${row.challengeKey}`} style={[styles.row, view.claimable && styles.rowReady]}>
        <View
          style={styles.rowTop}
          accessible
          accessibilityLabel={t('missions.rowA11y', {
            defaultValue: '{{tier}}. {{task}}. Progress {{progress}}. Reward {{gold}}.',
            tier, task: title, progress: view.progress, gold,
          })}
        >
          <Text style={styles.tier} maxFontSizeMultiplier={1.3}>{tier}</Text>
          <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3} numberOfLines={1}>{title}</Text>
          <View style={styles.goldWrap}>
            <GoldGlyph size={12} color={colors.lime} strokeWidth={3} />
            <Text style={styles.gold} maxFontSizeMultiplier={1.3}>{row.gold}</Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(row.fraction * 100)}%` }]} />
        </View>
        <View style={styles.rowFoot}>
          <Text style={styles.progress} maxFontSizeMultiplier={1.3}>{view.progress}</Text>
          {view.status === 'claim' ? (
            <Pressable
              onPress={() => onClaim(row)}
              disabled={!row.canClaim}
              accessibilityRole="button"
              accessibilityState={{ disabled: !row.canClaim, busy: !!row.claiming }}
              accessibilityLabel={t('missions.claimA11y', { defaultValue: 'Claim {{tier}} mission, {{gold}}', tier, gold })}
              style={({ pressed }) => [styles.claimBtn, view.claimable && styles.claimBtnReady, pressed && view.claimable && styles.claimPressed]}
            >
              {row.claiming ? (
                <ActivityIndicator color={colors.bone} />
              ) : (
                <Text style={[styles.btnText, view.claimable ? styles.btnTextOnLime : styles.btnTextDisabled]} maxFontSizeMultiplier={1.3}>
                  {t('missions.claim', { defaultValue: 'Claim' })}
                </Text>
              )}
            </Pressable>
          ) : chip ? (
            <View style={[styles.chip, view.status === 'complete' && styles.chipLime]}>
              <Text style={[styles.chipText, view.status === 'complete' && styles.chipTextLime]} maxFontSizeMultiplier={1.3}>{chip}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        title={t('missions.yourMissions', { defaultValue: 'Your Missions' })}
        right={(
          <Pressable
            onPress={() => setExplainerReopen((n) => n + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('missions.infoA11y', { defaultValue: 'About mission types' })}
            hitSlop={4}
            style={({ pressed }) => [styles.infoBtn, pressed && styles.infoPressed]}
          >
            <InfoGlyph size={22} color={colors.bone2} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.refreshRow}>
          <ClockGlyph size={14} color={countdown.underMinute ? colors.caution : colors.slate2} />
          <Text
            style={[styles.refresh, countdown.underMinute && styles.refreshCaution]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={t('missions.refreshA11y', { defaultValue: 'Missions refresh in {{time}}', time: countdownText })}
            maxFontSizeMultiplier={1.3}
          >
            {t('missions.refreshIn', { defaultValue: 'Refreshes in {{time}}', time: countdownText })}
          </Text>
        </View>

        {loadError && !today ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {t('missions.loadError', { defaultValue: 'Could not load your missions.' })}
            </Text>
            <Pressable
              onPress={loadToday}
              accessibilityRole="button"
              accessibilityLabel={t('missions.retry', { defaultValue: 'Retry' })}
              style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
            >
              <Text style={styles.btnText}>{t('missions.retry', { defaultValue: 'Retry' })}</Text>
            </Pressable>
          </View>
        ) : null}

        {!today && !loadError ? <ActivityIndicator style={styles.loading} color={colors.slate2} /> : null}

        {today && noMissionsToday ? (
          <Text style={styles.note}>
            {t('missions.noneToday', { defaultValue: 'No missions today. The map is open.' })}
          </Text>
        ) : null}

        {today && !noMissionsToday ? (
          <>
            <Text style={styles.typeLabel} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {t('missions.typeForToday', { defaultValue: 'Mission type for today' })}
            </Text>
            <View style={styles.toggle} accessibilityRole="tablist">
              {MISSION_TYPES.map((type) => {
                const selected = lock.type === type && !lockedOther;
                const label = tc(t, TYPE_LABEL[type]);
                const sub = tc(t, typeSubtitle(type));
                const lockedHere = locked.lockIconOn === type;
                const dim = !toggleEnabled && !selected;
                return (
                  <Pressable
                    key={type}
                    onPress={() => dispatch({ type: 'SELECT_TYPE', missionType: type })}
                    disabled={!toggleEnabled}
                    accessibilityRole="tab"
                    accessibilityLabel={lockedHere
                      ? t('missions.tabLockedA11y', { defaultValue: '{{type}}, {{sub}}, locked', type: label, sub })
                      : `${label}, ${sub}`}
                    accessibilityState={{ selected, disabled: !toggleEnabled }}
                    style={[styles.toggleBtn, selected && styles.toggleBtnOn]}
                  >
                    <View style={styles.toggleHead}>
                      <Text style={[styles.toggleText, selected && styles.toggleTextOn, dim && styles.toggleDim]} maxFontSizeMultiplier={1.3}>
                        {label}
                      </Text>
                      {lockedHere ? <LockGlyph size={13} color={colors.lime} strokeWidth={1.8} /> : null}
                    </View>
                    <Text style={[styles.toggleSub, dim && styles.toggleDim]} maxFontSizeMultiplier={1.3}>{sub}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.desc}>{tc(t, typeDescription(lock.type))}</Text>

            {locked.banner ? (
              <View style={styles.lockedBanner} accessible accessibilityRole="text">
                <LockGlyph size={14} color={colors.lime} strokeWidth={1.8} />
                <Text style={styles.lockedBannerText}>
                  {t(locked.banner.key, {
                    defaultValue: locked.banner.defaultValue,
                    type: tc(t, locked.banner.nameKey),
                  })}
                </Text>
              </View>
            ) : null}

            {lockedOther ? (
              <Text style={styles.note}>
                {t('missions.lockedOther', {
                  defaultValue: 'Today is locked to another challenge type. New missions arrive at the refresh.',
                })}
              </Text>
            ) : null}

            {locked.showLockButton ? (
              <Pressable
                onPress={onLock}
                disabled={lock.locking}
                accessibilityRole="button"
                accessibilityState={{ disabled: lock.locking, busy: lock.locking }}
                accessibilityLabel={t('missions.lockA11y', {
                  defaultValue: 'Lock {{type}} as today’s mission type',
                  type: tc(t, TYPE_LABEL[lock.type]),
                })}
                style={({ pressed }) => [styles.lockBtn, pressed && styles.pressed]}
              >
                {lock.locking ? (
                  <ActivityIndicator color={colors.bone} />
                ) : (
                  <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                    {tc(t, lockButtonCopy(tc(t, TYPE_LABEL[lock.type])))}
                  </Text>
                )}
              </Pressable>
            ) : null}

            {lock.error ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{tc(t, errorCopy('lock', lock.error.code))}</Text>
                {lock.error.retryable && !lock.lockedType ? (
                  <Pressable
                    onPress={onRetryLock}
                    accessibilityRole="button"
                    accessibilityLabel={t('missions.retry', { defaultValue: 'Retry' })}
                    style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.btnText}>{t('missions.retry', { defaultValue: 'Retry' })}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {carried.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
                  {t('missions.fromYesterday', { defaultValue: 'From yesterday' })}
                </Text>
                {carried.map((m) => renderRow(m, 'carry:'))}
              </View>
            ) : null}

            {!lockedOther ? (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, section.lime && styles.sectionLabelLime]}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.3}
                >
                  {tc(t, section.base)}
                  {section.ready ? ` · ${tc(t, section.ready)}` : ''}
                </Text>
                {rows.map((r) => renderRow(r))}
              </View>
            ) : null}

            {claimError ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{tc(t, errorCopy('claim', claimError.error.code))}</Text>
                {claimError.error.retryable ? (
                  <Pressable
                    onPress={() => onClaim(claimError.mission)}
                    accessibilityRole="button"
                    accessibilityLabel={t('missions.retry', { defaultValue: 'Retry' })}
                    style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.btnText}>{t('missions.retry', { defaultValue: 'Retry' })}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.allianceSection}>
          <Text style={styles.allianceHeading} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {t('missions.allianceMissions', { defaultValue: 'Alliance Missions' })}
          </Text>
          {allianceView === 'loading' ? <ActivityIndicator color={colors.slate2} /> : null}
          {allianceView === 'card' ? (
            <WeeklyTaskCard
              variant="mission"
              allianceId={alliance.allianceId}
              allianceName={allianceName}
              getToken={getToken}
            />
          ) : null}
          {allianceView === 'error' ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                {t('missions.allianceError', { defaultValue: 'Could not load alliance missions.' })}
              </Text>
              <Pressable
                onPress={loadAlliance}
                accessibilityRole="button"
                accessibilityLabel={t('missions.retry', { defaultValue: 'Retry' })}
                style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>{t('missions.retry', { defaultValue: 'Retry' })}</Text>
              </Pressable>
            </View>
          ) : null}
          {allianceView === 'join_prompt' ? (
            <View style={styles.joinCard}>
              <AllianceGlyph size={28} color={colors.slate2} />
              <Text style={styles.joinText}>
                {t('missions.joinPrompt', {
                  defaultValue: 'Join or create an alliance to be part of alliance missions.',
                })}
              </Text>
              <Pressable
                onPress={() => navigateTo('Alliance')}
                accessibilityRole="button"
                accessibilityLabel={t('missions.joinPromptA11y', { defaultValue: 'Open Alliance to join or create one' })}
                style={({ pressed }) => [styles.findBtn, pressed && styles.findPressed]}
              >
                <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                  {t('missions.findAlliance', { defaultValue: 'Find an alliance' })}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <FeatureExplainer
        userId={userId}
        name={MISSIONS_EXPLAINER}
        pages={explainerPages}
        reopen={explainerReopen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  body: { padding: 16, paddingTop: 12, paddingBottom: 48 },
  loading: { marginTop: 24 },
  infoBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  infoPressed: { opacity: 0.6 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  refresh: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  refreshCaution: { color: colors.caution },
  typeLabel: {
    marginTop: 12,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.bone2,
  },
  toggle: { marginTop: 12, flexDirection: 'row', borderWidth: 1, borderColor: colors.hairlineStrong },
  toggleBtn: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  // Figma segmented control: raised fill + 2px Signal Lime underline.
  toggleBtnOn: { backgroundColor: colors.raised, borderBottomColor: colors.lime },
  toggleHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.6, color: colors.slate2 },
  toggleTextOn: { fontFamily: fonts.monoMedium, color: colors.bone },
  toggleSub: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, color: colors.slate2 },
  toggleDim: { color: colors.slate },
  desc: { marginTop: 12, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.bone2 },
  note: { marginTop: 16, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.slate2 },
  lockedBanner: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.limeSoft,
  },
  lockedBannerText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.bone },
  section: { marginTop: 20 },
  sectionLabel: {
    marginBottom: 12,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  sectionLabelLime: { fontFamily: fonts.monoMedium, color: colors.lime },
  row: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    marginBottom: 12,
  },
  // A claimable reward: Signal Lime border (Figma E4).
  rowReady: { borderColor: colors.lime },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tier: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.lime },
  rowTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  goldWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gold: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.bone },
  track: { marginTop: 12, height: 4, backgroundColor: colors.ink3 },
  fill: { height: 4, backgroundColor: colors.lime },
  rowFoot: {
    marginTop: 12,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0.6, color: colors.slate2 },
  chip: { backgroundColor: colors.ink3, paddingHorizontal: 8, paddingVertical: 4 },
  chipLime: { backgroundColor: colors.limeSoft },
  chipText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.bone2 },
  chipTextLime: { color: colors.lime },
  claimBtn: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  // A ready reward is a Signal Lime moment (Figma Mission Row · Ready).
  claimBtnReady: { backgroundColor: colors.lime, borderColor: colors.lime },
  claimPressed: { opacity: 0.85 },
  lockBtn: {
    marginTop: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  btnText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  btnTextOnLime: { fontFamily: fonts.monoMedium, color: colors.onLime },
  btnTextDisabled: { color: colors.slate },
  pressed: { backgroundColor: colors.ink3 },
  banner: {
    marginTop: 16,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: 12,
  },
  bannerText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.bone },
  smallBtn: {
    marginTop: 8,
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  allianceSection: { marginTop: 16 },
  allianceHeading: {
    marginBottom: 16,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  // Figma E5: dashed empty card with the people icon and a blue CTA.
  joinCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  joinText: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.slate2,
  },
  findBtn: {
    marginTop: 20,
    alignSelf: 'stretch',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action, // Electric Blue primary action
  },
  findPressed: { backgroundColor: colors.actionPressed },
});
