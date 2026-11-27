// Missions tab (plan U14; Dominia-Temp restyle, 2026-11-28 plan U8, boards 16,
// 17, 30–32), mounted with legacy_tabs off; legacy_tabs on keeps
// ActivityScreen. Daily MARCH / RANGE missions over the existing challenge
// APIs: GET /me/challenges/today for progress and the server lock,
// POST /me/challenges/lock-axis for LOCK (no confirmation: Figma has none),
// POST /me/challenge-complete for CLAIM. One button under the rows: LOCK while
// unlocked, then CLAIM, which claims every completed tier at once.
// Decisions and display models live in lib/missions.js.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import FeatureExplainer from '../components/FeatureExplainer';
import ProfileAvatarButton from '../components/ProfileAvatarButton';
import WeeklyTaskCard from '../components/WeeklyTaskCard';
import { GoldGlyph } from '../components/ResourceGlyphs';
import { BoltGlyph, InfoGlyph, PinGlyph, StepsGlyph } from '../components/MissionGlyphs';
import { CutCard, LinkText, SlantButton, SlantTabs, SlantTile } from '../components/ui';
import { useSvgId } from '../components/ui/shared';
import { fetchChallengesToday } from '../lib/challengesTodayApi';
import { getAllianceById, getMyAlliance } from '../lib/allianceApi';
import { getMe } from '../lib/meApi';
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
  claimableRows,
  missionButton,
  lockReducer,
  initialLockState,
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

const GOLD_BISCUITS = require('../assets/figma/gold-biscuits.png');

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

function formatBalance(n) {
  return String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Blue-gradient fill for a mission progress bar (boards 31–32).
function ProgressBar({ fraction, label }) {
  const gradId = useSvgId('missionfill');
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 1000) / 10;
  return (
    <View style={styles.track}>
      {pct > 0 ? (
        <View style={[styles.fillWrap, { width: `${pct}%` }]}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.actionDeep} />
                <Stop offset="1" stopColor="#2F55E8" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
          </Svg>
        </View>
      ) : null}
      <Text style={styles.trackLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// Header row as on the map (board 16): the shared avatar / initials tile
// (ProfileAvatarButton, restyled with the map chrome), Gold pill, level pill.
function MissionsTopRow({ gold, level }) {
  const { t } = useTranslation();
  return (
    <View style={styles.topRow}>
      <ProfileAvatarButton />
      <View style={styles.pills}>
        <SlantTile
          size={36}
          tone="raised"
          accessibilityLabel={gold != null
            ? t('missions.goldA11y', { defaultValue: 'Gold balance: {{n}}', n: formatBalance(gold) })
            : t('missions.goldLoadingA11y', { defaultValue: 'Gold balance loading' })}
        >
          <View style={styles.pillInner}>
            <GoldGlyph size={14} color={colors.white} strokeWidth={3} />
            <Text style={styles.pillText} maxFontSizeMultiplier={1.2}>{gold != null ? formatBalance(gold) : '—'}</Text>
          </View>
        </SlantTile>
        <SlantTile
          size={36}
          tone="raised"
          accessibilityLabel={level != null
            ? t('missions.levelA11y', { defaultValue: 'Level {{n}}', n: level })
            : t('missions.levelLoadingA11y', { defaultValue: 'Level loading' })}
        >
          <View style={styles.pillInner}>
            <BoltGlyph size={14} color={colors.white} />
            <Text style={styles.pillText} maxFontSizeMultiplier={1.2}>{level != null ? level : '—'}</Text>
          </View>
        </SlantTile>
      </View>
    </View>
  );
}

export default function MissionsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();
  const units = useUnits();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const tokenFn = useCallback(() => getTokenRef.current(), []);

  // ── Header: Gold and level from /me ─────────────────────────────────────
  const [me, setMe] = useState({ gold: null, level: null });
  const loadMe = useCallback(async () => {
    const res = await getMe({ clerkGetToken: tokenFn });
    if (!res.ok) return;
    const p = res.data?.player ?? {};
    const gold = Number(p.gold);
    const level = Number(p.level);
    setMe({
      gold: Number.isFinite(gold) ? gold : null,
      level: Number.isFinite(level) ? level : null,
    });
  }, [tokenFn]);
  useFocusEffect(useCallback(() => { loadMe(); }, [loadMe]));

  // ── Today ───────────────────────────────────────────────────────────────
  const [today, setToday] = useState(null); // { data, dayKey }
  const [loadError, setLoadError] = useState(false);
  const [lock, dispatch] = useReducer(lockReducer, initialLockState);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [claimingKeys, setClaimingKeys] = useState(() => new Set());
  const [claimError, setClaimError] = useState(null); // { missions, error }
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
  // Claims the given missions one after another; one toast for the total.
  const inFlight = useRef(new Set());
  const claimMissions = useCallback(async (missions) => {
    const list = (missions ?? []).filter((m) => {
      const busyKey = m.forDate ? `carry:${m.challengeKey}` : m.challengeKey;
      return !inFlight.current.has(busyKey);
    });
    if (list.length === 0) return;
    const keys = list.map((m) => (m.forDate ? `carry:${m.challengeKey}` : m.challengeKey));
    keys.forEach((k) => inFlight.current.add(k));
    setClaimError(null);
    setClaimingKeys((prev) => new Set([...prev, ...keys]));
    let goldTotal = 0;
    let playerGold = null;
    let carryNext = carry;
    const failed = [];
    let firstError = null;
    try {
      try {
        await activityProducer.flushNow();
      } catch (_) { /* non-fatal */ }
      for (const mission of list) {
        // eslint-disable-next-line no-await-in-loop
        const res = await claimMission({ clerkGetToken: tokenFn, mission, forDate: mission.forDate });
        if (!res.ok) {
          failed.push(mission);
          firstError = firstError ?? res;
          continue;
        }
        if (mission.forDate) {
          carryNext = removeCarried(carryNext, mission.challengeKey, mission.forDate);
        } else {
          // Today's snapshot drops it on the next render once it is secured.
          setCompletedKeys((prev) => applyClaim(prev, mission, res).completedKeys);
        }
        goldTotal += res.gold;
        if (res.playerGold != null) playerGold = res.playerGold;
      }
      if (carryNext !== carry) persistCarry(carryNext);
      if (playerGold != null) setMe((prev) => ({ ...prev, gold: Number(playerGold) }));
      if (firstError) {
        setClaimError({ missions: failed, error: firstError });
        if (firstError.code === 'axis_locked') loadToday();
      }
      if (goldTotal > 0) {
        Toast.show({
          type: 'info',
          position: 'top',
          text1: t('missions.claimedToast', { defaultValue: '+{{n}} Gold secured', n: goldTotal }),
        });
      }
      if (failed.length < list.length) {
        loadToday();
        if (playerGold == null) loadMe();
      }
    } finally {
      keys.forEach((k) => inFlight.current.delete(k));
      setClaimingKeys((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }
  }, [tokenFn, carry, persistCarry, loadToday, loadMe, t]);

  // ── Alliance ────────────────────────────────────────────────────────────
  const [alliance, setAlliance] = useState({ loaded: false, error: null, allianceId: null });
  const [allianceName, setAllianceName] = useState(null);
  const loadAlliance = useCallback(async () => {
    const res = await getMyAlliance({ clerkGetToken: tokenFn });
    if (res.ok) setAlliance({ loaded: true, error: null, allianceId: res.data?.alliance_id ?? null });
    else setAlliance((prev) => (prev.loaded && !prev.error ? prev : { loaded: true, error: res.error || 'load_failed', allianceId: null }));
  }, [tokenFn]);
  // The alliance name for the card's accessibility label.
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

  // ── Explainer (board 17) ────────────────────────────────────────────────
  const [explainerReopen, setExplainerReopen] = useState(0);
  const explainerPages = useMemo(() => [
    {
      title: t('missions.explainerTitle', { defaultValue: 'MISSIONS TYPE' }),
      body: t('missions.explainerBodyV2', {
        defaultValue: 'You can lock a mission type for the day. Once locked, it cannot be changed until the next day. Each type represents a different category of missions.',
      }),
    },
    {
      title: t('missions.explainerTypesTitle', { defaultValue: 'MARCH & RANGE' }),
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
    },
  ], [t]);

  // ── Render ──────────────────────────────────────────────────────────────
  const countdownText = tc(t, countdown);
  const noMissionsToday = today?.data?.is_challenge_day === false;
  const lockedOther = lock.lockedType === 'other';
  const fmtDistance = (m) => formatDistance(m, units);
  const button = missionButton({ lockState: lock, rows });
  const desc = tc(t, typeDescription(lock.type));
  const colon = desc.indexOf(':');
  const descHead = colon > 0 ? desc.slice(0, colon + 1) : '';
  const descRest = colon > 0 ? desc.slice(colon + 1) : desc;

  const tabs = MISSION_TYPES.map((type) => {
    const label = tc(t, TYPE_LABEL[type]);
    const lockedHere = lock.lockedType === type;
    return {
      key: type,
      label,
      accessibilityLabel: lockedHere
        ? t('missions.tabLockedA11yV2', { defaultValue: '{{type}}, locked for today', type: label })
        : label,
    };
  });

  function renderRow(row, keyPrefix = '') {
    const view = missionRowView(row, fmtDistance);
    const tier = tc(t, TIER_LABEL[row.tier]);
    const task = tc(t, view.task);
    const progress = tc(t, view.progress);
    const gold = t('missions.goldReward', { defaultValue: '{{n}} Gold', n: row.gold });
    return (
      <CutCard
        key={`${keyPrefix}${row.challengeKey}`}
        padding={0}
        variant={view.claimable ? 'selected' : 'default'}
        style={styles.row}
      >
        <View
          style={styles.rowInner}
          accessible
          accessibilityLabel={t('missions.rowA11y', {
            defaultValue: '{{tier}}. {{task}}. Progress {{progress}}. Reward {{gold}}.',
            tier, task, progress, gold,
          }) + (view.secured ? ` ${t('missions.secured', { defaultValue: 'Secured' })}.` : '')}
        >
          <View style={styles.rowMain}>
            <View style={styles.rowHead}>
              <Text style={styles.tier} maxFontSizeMultiplier={1.3}>{tier}</Text>
              <Text style={styles.task} maxFontSizeMultiplier={1.3} numberOfLines={1}>{task}</Text>
            </View>
            <ProgressBar fraction={view.fraction} label={progress} />
          </View>
          <View style={styles.reward}>
            <Image source={GOLD_BISCUITS} style={[styles.biscuits, view.secured && styles.biscuitsDim]} resizeMode="contain" />
            <Text style={[styles.rewardText, view.secured && styles.rewardSecured]} maxFontSizeMultiplier={1.3}>
              {view.secured ? t('missions.securedShort', { defaultValue: 'DONE' }) : row.gold}
            </Text>
          </View>
        </View>
        {row.forDate ? (
          <SlantButton
            label={t('missions.claim', { defaultValue: 'Claim' })}
            onPress={() => claimMissions([row])}
            variant="primary"
            size="sm"
            trailingChevron={false}
            loading={!!row.claiming}
            disabled={!row.canClaim && !row.claiming}
            accessibilityLabel={t('missions.claimA11y', { defaultValue: 'Claim {{tier}} mission, {{gold}}', tier, gold })}
            style={styles.carryClaim}
          />
        ) : null}
      </CutCard>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 12 }]}>
        <MissionsTopRow gold={me.gold} level={me.level} />

        <View style={styles.titleRow}>
          <Text
            style={styles.title}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {t('missions.yourMissions', { defaultValue: 'Your Missions' })}
          </Text>
          <Pressable
            onPress={() => setExplainerReopen((n) => n + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('missions.infoA11y', { defaultValue: 'About mission types' })}
            style={({ pressed }) => [styles.infoBtn, pressed && styles.infoPressed]}
          >
            <InfoGlyph size={18} color={colors.muted2} />
          </Pressable>
        </View>
        <Text
          style={styles.refresh}
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('missions.refreshA11y', { defaultValue: 'Missions refresh in {{time}}', time: countdownText })}
          maxFontSizeMultiplier={1.3}
        >
          {t('missions.refreshesInLabel', { defaultValue: 'Refreshes in:' })}{' '}
          <Text style={[styles.refreshValue, countdown.underMinute && styles.refreshCaution]}>{countdownText}</Text>
        </Text>
        <View style={styles.hairline} />

        {loadError && !today ? (
          <CutCard variant="danger" style={styles.banner}>
            <Text style={styles.bannerText}>
              {t('missions.loadError', { defaultValue: 'Could not load your missions.' })}
            </Text>
            <LinkText onPress={loadToday} style={styles.bannerLink}>
              {t('missions.retry', { defaultValue: 'Retry' })}
            </LinkText>
          </CutCard>
        ) : null}

        {!today && !loadError ? <ActivityIndicator style={styles.loading} color={colors.muted2} /> : null}

        {today && noMissionsToday ? (
          <Text style={styles.note}>
            {t('missions.noneToday', { defaultValue: 'No missions today. The map is open.' })}
          </Text>
        ) : null}

        {today && !noMissionsToday ? (
          <>
            <SlantTabs
              tabs={tabs}
              value={lockedOther ? null : lock.type}
              onChange={(type) => dispatch({ type: 'SELECT_TYPE', missionType: type })}
              height={44}
              gap={8}
              style={styles.tabs}
            />

            <Text style={styles.desc} maxFontSizeMultiplier={1.4}>
              {descHead ? <Text style={styles.descHead}>{descHead}</Text> : null}
              {descRest}
            </Text>

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

            {!lockedOther ? (
              <View style={styles.rows}>{rows.map((r) => renderRow(r))}</View>
            ) : null}

            {button.kind === 'lock' ? (
              <SlantButton
                label={t('missions.lock', { defaultValue: 'Lock' })}
                onPress={onLock}
                variant="ghost"
                size="md"
                trailingChevron={false}
                loading={button.busy}
                accessibilityLabel={t('missions.lockA11y', {
                  defaultValue: 'Lock {{type}} as today’s mission type',
                  type: tc(t, TYPE_LABEL[lock.type]),
                })}
                style={styles.actionBtn}
              />
            ) : null}
            {button.kind === 'claim' ? (
              <SlantButton
                label={t('missions.claim', { defaultValue: 'Claim' })}
                onPress={() => claimMissions(claimableRows(rows))}
                variant={button.variant}
                size="md"
                trailingChevron={false}
                disabled={!button.enabled && !button.busy}
                loading={button.busy}
                accessibilityLabel={button.enabled
                  ? t('missions.claimAllA11y', {
                    defaultValue: 'Claim {{count}} completed missions',
                    count: button.readyCount,
                  })
                  : t('missions.claimNoneA11y', { defaultValue: 'Claim, no completed missions yet' })}
                style={styles.actionBtn}
              />
            ) : null}

            {lock.error ? (
              <CutCard variant="danger" style={styles.banner}>
                <Text style={styles.bannerText}>{tc(t, errorCopy('lock', lock.error.code))}</Text>
                {lock.error.retryable && !lock.lockedType ? (
                  <LinkText onPress={onRetryLock} style={styles.bannerLink}>
                    {t('missions.retry', { defaultValue: 'Retry' })}
                  </LinkText>
                ) : null}
              </CutCard>
            ) : null}

            {claimError ? (
              <CutCard variant="danger" style={styles.banner}>
                <Text style={styles.bannerText}>{tc(t, errorCopy('claim', claimError.error.code))}</Text>
                {claimError.error.retryable ? (
                  <LinkText onPress={() => claimMissions(claimError.missions)} style={styles.bannerLink}>
                    {t('missions.retry', { defaultValue: 'Retry' })}
                  </LinkText>
                ) : null}
              </CutCard>
            ) : null}
          </>
        ) : null}

        <View style={styles.hairline} />

        <Text style={styles.allianceHeading} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('missions.allianceMissions', { defaultValue: 'Alliance Missions' })}
        </Text>
        {allianceView === 'loading' ? <ActivityIndicator color={colors.muted2} /> : null}
        {allianceView === 'card' ? (
          <WeeklyTaskCard
            variant="mission"
            allianceId={alliance.allianceId}
            allianceName={allianceName}
            getToken={getToken}
          />
        ) : null}
        {allianceView === 'error' ? (
          <CutCard variant="danger" style={styles.bannerTight}>
            <Text style={styles.bannerText}>
              {t('missions.allianceError', { defaultValue: 'Could not load alliance missions.' })}
            </Text>
            <LinkText onPress={loadAlliance} style={styles.bannerLink}>
              {t('missions.retry', { defaultValue: 'Retry' })}
            </LinkText>
          </CutCard>
        ) : null}
        {allianceView === 'join_prompt' ? (
          <Pressable
            onPress={() => navigateTo('Alliance')}
            accessibilityRole="button"
            accessibilityLabel={t('missions.joinPromptA11y', { defaultValue: 'Open Alliance to join or create one' })}
            style={({ pressed }) => [styles.joinLine, pressed && styles.infoPressed]}
          >
            <Text style={styles.joinText} maxFontSizeMultiplier={1.4}>
              {t('missions.joinPromptLine', {
                defaultValue: '--- Join or Create an alliance to be a part of alliance missions ---',
              })}
            </Text>
          </Pressable>
        ) : null}
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
  screen: { flex: 1, backgroundColor: colors.obsidian },
  body: { paddingHorizontal: 16, paddingBottom: 48 },
  loading: { marginTop: 24 },

  // Header row
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillText: { fontFamily: fonts.mono, fontSize: 14, color: colors.white },

  // Title block
  titleRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    textTransform: 'uppercase',
    color: colors.white,
  },
  infoBtn: { marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  infoPressed: { opacity: 0.6 },
  refresh: { fontFamily: fonts.body, fontSize: 12, color: colors.muted2 },
  refreshValue: { fontFamily: fonts.mono, color: colors.white },
  refreshCaution: { color: colors.caution },
  hairline: { marginVertical: 16, height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceLine },

  // Tabs and description
  tabs: { marginTop: 0 },
  desc: { marginTop: 12, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted2 },
  descHead: { fontFamily: fonts.mono, color: colors.white },
  note: { marginTop: 16, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted2 },

  // Rows
  section: { marginTop: 16 },
  sectionLabel: {
    marginBottom: 8,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  rows: { marginTop: 12 },
  row: { marginBottom: 8 },
  rowInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  rowMain: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tier: { fontFamily: fonts.action, fontSize: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.white },
  task: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13, color: colors.muted2 },
  track: {
    marginTop: 8,
    height: 18,
    justifyContent: 'center',
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  fillWrap: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  trackLabel: {
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.white,
  },
  reward: { width: 44, alignItems: 'center', gap: 4 },
  biscuits: { width: 28, height: 22 },
  biscuitsDim: { opacity: 0.4 },
  rewardText: { fontFamily: fonts.mono, fontSize: 15, color: colors.white },
  rewardSecured: { fontSize: 11, letterSpacing: 1, color: colors.lime },
  carryClaim: { alignSelf: 'flex-end', marginRight: 12, marginBottom: 10 },

  // LOCK / CLAIM
  actionBtn: { alignSelf: 'flex-start', minWidth: 124, marginTop: 8 },

  // Banners
  banner: { marginTop: 16 },
  bannerTight: { marginTop: 0 },
  bannerText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.white },
  bannerLink: { marginTop: 8, alignSelf: 'flex-start' },

  // Alliance
  allianceHeading: {
    marginBottom: 12,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    textTransform: 'uppercase',
    color: colors.white,
  },
  joinLine: { paddingVertical: 24, paddingHorizontal: 8, alignItems: 'center' },
  joinText: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted2,
  },
});
