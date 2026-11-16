// Figma Missions tab (plan U14), mounted with legacy_tabs off; legacy_tabs on
// keeps ActivityScreen. Daily MARCH / RANGE missions over the existing
// challenge APIs: GET /me/challenges/today for progress and the server lock,
// POST /me/challenges/lock-axis for LOCK, POST /me/challenge-complete for
// CLAIM. Decisions live in lib/missions.js.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import TabScreenHeader from '../components/TabScreenHeader';
import FeatureExplainer from '../components/FeatureExplainer';
import WeeklyTaskCard from '../components/WeeklyTaskCard';
import { fetchChallengesToday } from '../lib/challengesTodayApi';
import { getMyAlliance } from '../lib/allianceApi';
import { navigateTo } from '../lib/navigation';
import * as activityProducer from '../lib/activity';
import { formatDistance, useUnits } from '../lib/units';
import {
  MISSION_TYPES,
  MISSIONS_EXPLAINER,
  carryStorageKey,
  typeDescription,
  buildMissionRows,
  initialLockState,
  lockReducer,
  isToggleEnabled,
  confirmAndLock,
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
  const confirmLock = useCallback((type) => new Promise((resolve) => {
    const typeName = tc(t, TYPE_LABEL[type]);
    Alert.alert(
      t('missions.lockConfirmTitle', { defaultValue: 'Lock {{type}} for today?', type: typeName }),
      t('missions.lockConfirmBody', {
        defaultValue: 'Once locked, the mission type cannot be changed until the next day.',
      }),
      [
        { text: t('missions.lockConfirmCancel', { defaultValue: 'Cancel' }), style: 'cancel', onPress: () => resolve(false) },
        { text: t('missions.lockConfirmOk', { defaultValue: 'Lock' }), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  }), [t]);

  const lockFn = useCallback((type) => lockMissionType({ clerkGetToken: tokenFn, type }), [tokenFn]);

  const onLock = useCallback(() => {
    confirmAndLock({ state: lock, confirm: confirmLock, lock: lockFn, dispatch });
  }, [lock, confirmLock, lockFn]);

  const onRetryLock = useCallback(async () => {
    // Already confirmed once; retry sends the same type straight away.
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
  const loadAlliance = useCallback(async () => {
    const res = await getMyAlliance({ clerkGetToken: tokenFn });
    if (res.ok) setAlliance({ loaded: true, error: null, allianceId: res.data?.alliance_id ?? null });
    else setAlliance((prev) => (prev.loaded && !prev.error ? prev : { loaded: true, error: res.error || 'load_failed', allianceId: null }));
  }, [tokenFn]);
  useFocusEffect(useCallback(() => { loadAlliance(); }, [loadAlliance]));
  const allianceView = allianceSection(alliance);

  // ── Explainer ───────────────────────────────────────────────────────────
  const [explainerReopen, setExplainerReopen] = useState(0);
  const explainerPages = useMemo(() => [{
    title: t('missions.explainerTitle', { defaultValue: 'MISSIONS TYPE' }),
    body: t('missions.explainerBody', {
      defaultValue:
        'You can lock a mission type for the day. Once locked, it cannot be changed until the next day. Each type represents a different category of missions.',
    }),
  }], [t]);

  // ── Render ──────────────────────────────────────────────────────────────
  const toggleEnabled = isToggleEnabled(lock);
  const countdownText = tc(t, countdown);
  const noMissionsToday = today?.data?.is_challenge_day === false;
  const lockedOther = lock.lockedType === 'other';

  function taskText(row) {
    if (row.type === 'range') {
      return t('missions.taskRange', {
        defaultValue: 'Cover a total of {{distance}}',
        distance: formatDistance(row.target, units),
      });
    }
    return t('missions.taskMarch', {
      defaultValue: 'Complete a total of {{n}}k steps',
      n: Math.round(row.target / 1000),
    });
  }

  function progressText(row) {
    if (row.type === 'range') {
      return `${formatDistance(row.current, units)}/${formatDistance(row.target, units)}`;
    }
    return `${Math.floor(row.current)}/${row.target}`;
  }

  function renderRow(row, keyPrefix = '') {
    const tier = tc(t, TIER_LABEL[row.tier]);
    const task = taskText(row);
    const progress = progressText(row);
    const gold = t('missions.goldReward', { defaultValue: '{{n}} Gold', n: row.gold });
    return (
      <View key={`${keyPrefix}${row.challengeKey}`} style={styles.row}>
        <View
          style={styles.rowTop}
          accessible
          accessibilityLabel={t('missions.rowA11y', {
            defaultValue: '{{tier}}. {{task}}. Progress {{progress}}. Reward {{gold}}.',
            tier, task, progress, gold,
          })}
        >
          <View style={styles.rowMain}>
            <Text style={styles.tier} maxFontSizeMultiplier={1.3}>{tier}</Text>
            <Text style={styles.task}>{task}</Text>
            <Text style={styles.progress} maxFontSizeMultiplier={1.3}>{progress}</Text>
          </View>
          <Text style={styles.gold} maxFontSizeMultiplier={1.3}>{gold}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(row.fraction * 100)}%` }]} />
        </View>
        {row.secured ? (
          <Text style={styles.secured} maxFontSizeMultiplier={1.3}>
            {t('missions.secured', { defaultValue: 'Secured' })}
          </Text>
        ) : row.showClaim ? (
          <Pressable
            onPress={() => onClaim(row)}
            disabled={!row.canClaim}
            accessibilityRole="button"
            accessibilityState={{ disabled: !row.canClaim, busy: !!row.claiming }}
            accessibilityLabel={t('missions.claimA11y', { defaultValue: 'Claim {{tier}} mission, {{gold}}', tier, gold })}
            style={({ pressed }) => [styles.claimBtn, !row.canClaim && styles.claimBtnDisabled, pressed && styles.pressed]}
          >
            {row.claiming ? (
              <ActivityIndicator color={colors.bone} />
            ) : (
              <Text style={[styles.btnText, !row.canClaim && styles.btnTextDisabled]} maxFontSizeMultiplier={1.3}>
                {t('missions.claim', { defaultValue: 'Claim' })}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabScreenHeader title={t('missions.yourMissions', { defaultValue: 'Your Missions' })} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.refreshRow}>
          <Text
            style={[styles.refresh, countdown.underMinute && styles.refreshCaution]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={t('missions.refreshA11y', { defaultValue: 'Missions refresh in {{time}}', time: countdownText })}
            maxFontSizeMultiplier={1.3}
          >
            {t('missions.refreshIn', { defaultValue: 'Refreshes in: {{time}}', time: countdownText })}
          </Text>
          <Pressable
            onPress={() => setExplainerReopen((n) => n + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('missions.infoA11y', { defaultValue: 'About mission types' })}
            hitSlop={4}
            style={({ pressed }) => [styles.infoBtn, pressed && styles.pressed]}
          >
            <Text style={styles.infoText} maxFontSizeMultiplier={1.2}>i</Text>
          </Pressable>
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
            <View style={styles.toggle} accessibilityRole="tablist">
              {MISSION_TYPES.map((type) => {
                const selected = lock.type === type && !lockedOther;
                const label = tc(t, TYPE_LABEL[type]);
                return (
                  <Pressable
                    key={type}
                    onPress={() => dispatch({ type: 'SELECT_TYPE', missionType: type })}
                    disabled={!toggleEnabled}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected, disabled: !toggleEnabled }}
                    style={[styles.toggleBtn, selected && styles.toggleBtnOn]}
                  >
                    <Text
                      style={[styles.toggleText, selected && styles.toggleTextOn, !toggleEnabled && !selected && styles.btnTextDisabled]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.desc}>{tc(t, typeDescription(lock.type))}</Text>

            {lockedOther ? (
              <Text style={styles.note}>
                {t('missions.lockedOther', {
                  defaultValue: 'Today is locked to another challenge type. New missions arrive at the refresh.',
                })}
              </Text>
            ) : null}

            {carried.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
                  {t('missions.fromYesterday', { defaultValue: 'From yesterday' })}
                </Text>
                {carried.map((m) => renderRow(m, 'carry:'))}
              </View>
            ) : null}

            {!lockedOther ? <View style={styles.section}>{rows.map((r) => renderRow(r))}</View> : null}

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

            {!lock.lockedType ? (
              <Pressable
                onPress={onLock}
                disabled={lock.locking}
                accessibilityRole="button"
                accessibilityState={{ disabled: lock.locking, busy: lock.locking }}
                accessibilityLabel={t('missions.lockA11y', {
                  defaultValue: 'Lock {{type}} as today’s mission type',
                  type: tc(t, TYPE_LABEL[lock.type]),
                })}
                style={({ pressed }) => [styles.lockBtn, pressed && styles.lockBtnPressed]}
              >
                {lock.locking ? (
                  <ActivityIndicator color={colors.bone} />
                ) : (
                  <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                    {t('missions.lock', { defaultValue: 'Lock' })}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {t('missions.allianceMissions', { defaultValue: 'Alliance Missions' })}
          </Text>
          {allianceView === 'loading' ? <ActivityIndicator color={colors.slate2} /> : null}
          {allianceView === 'card' ? <WeeklyTaskCard allianceId={alliance.allianceId} getToken={getToken} /> : null}
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
            <Pressable
              onPress={() => navigateTo('Alliance')}
              accessibilityRole="button"
              accessibilityLabel={t('missions.joinPromptA11y', { defaultValue: 'Open Alliance to join or create one' })}
              style={({ pressed }) => [styles.joinCard, pressed && styles.pressed]}
            >
              <Text style={styles.joinText}>
                {t('missions.joinPrompt', {
                  defaultValue: 'Join or Create an alliance to be a part of alliance missions',
                })}
              </Text>
            </Pressable>
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
  body: { padding: 16, paddingBottom: 48 },
  loading: { marginTop: 24 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refresh: { fontFamily: fonts.mono, fontSize: 13, color: colors.slate2 },
  refreshCaution: { color: colors.caution },
  infoBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  infoText: { fontFamily: fonts.monoMedium, fontSize: 16, color: colors.bone },
  toggle: { marginTop: 16, flexDirection: 'row', borderWidth: 1, borderColor: colors.hairlineStrong },
  toggleBtn: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  toggleBtnOn: { backgroundColor: colors.ink3 },
  toggleText: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.6, color: colors.slate2 },
  toggleTextOn: { fontFamily: fonts.monoMedium, color: colors.bone },
  desc: { marginTop: 12, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.bone2 },
  note: { marginTop: 16, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.slate2 },
  section: { marginTop: 24 },
  sectionLabel: {
    marginBottom: 8,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  row: {
    backgroundColor: colors.ink2,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    padding: 16,
    marginBottom: 8,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  rowMain: { flex: 1, paddingRight: 12 },
  tier: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: colors.slate2 },
  task: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.bone },
  progress: { marginTop: 4, fontFamily: fonts.mono, fontSize: 13, color: colors.bone2 },
  gold: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.bone },
  track: { marginTop: 12, height: 4, backgroundColor: colors.ink3 },
  fill: { height: 4, backgroundColor: colors.bone },
  secured: {
    marginTop: 12,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.bone2,
  },
  claimBtn: {
    marginTop: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  claimBtnDisabled: { backgroundColor: colors.ink2, borderColor: colors.hairline },
  lockBtn: {
    marginTop: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.claimButton, // the screen's one Claim Red element
  },
  lockBtnPressed: { opacity: 0.85 },
  btnText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
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
  joinCard: {
    backgroundColor: colors.ink2,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    padding: 16,
    minHeight: 48,
  },
  joinText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.bone },
});
