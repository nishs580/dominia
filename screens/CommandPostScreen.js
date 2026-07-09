import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { colors, fonts, fontSize, spacing } from '../lib/theme';
import { getCommandPost, getWeekInReview } from '../lib/commandPostApi';
import { getWeeklyTask, getWeeklyTaskMenu, pickWeeklyTask } from '../lib/weeklyTaskApi';
import { formatTaskValue, rewardLine } from '../lib/weeklyTaskFormat';

function formatInt(n) {
  if (n == null || Number.isNaN(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function initialsOf(username) {
  return username ? username.slice(0, 2).toUpperCase() : '??';
}

function SectionLabel({ left, accent, right }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{left}</Text>
      {accent ? <Text style={styles.sectionLabelAccent}> · {accent}</Text> : null}
      <View style={styles.sectionHairline} />
      {right}
    </View>
  );
}

// --- reason chip localisation -------------------------------------------------
// Backend returns { code, label, meta }. Localise by code; fall back to label.
function reasonText(t, reason) {
  const meta = reason.meta ?? {};
  switch (reason.code) {
    case 'inactive':
      return t('commandPost.reason.inactive', { days: meta.days_inactive ?? 0 });
    case 'streak_at_risk':
      return t('commandPost.reason.streakAtRisk', { streak: meta.current_streak ?? 0 });
    case 'recruit_stalling':
      return t('commandPost.reason.recruitStalling');
    default:
      return reason.label ?? '';
  }
}

function LapseRadar({ radar, t }) {
  const count = radar?.count ?? 0;
  return (
    <View style={styles.panel}>
      <SectionLabel left={t('commandPost.lapseRadar')} accent={t('commandPost.atRisk')} />
      {count === 0 ? (
        <View style={styles.clearBlock}>
          <Text style={styles.clearHeadline}>{t('commandPost.allClear')}</Text>
          <Text style={styles.clearSub}>{t('commandPost.allClearSub')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.riskHeadline}>
            {t('commandPost.atRiskCount', { count })}
          </Text>
          {radar.at_risk.map((m, i) => (
            <View
              key={m.player_id}
              style={[styles.riskRow, i < radar.at_risk.length - 1 && styles.rowBorder]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(m.username)}</Text>
              </View>
              <View style={styles.riskBody}>
                <Text style={styles.riskName}>{m.username ?? '—'}</Text>
                <View style={styles.chipWrap}>
                  {m.reasons.map((r) => (
                    <View key={r.code} style={styles.reasonChip}>
                      <Text style={styles.reasonChipText}>{reasonText(t, r)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.radarFootnote}>{t('commandPost.radarFootnote')}</Text>
        </>
      )}
    </View>
  );
}

function RosterReadiness({ readiness, sort, onSort, t }) {
  const members = readiness?.members ?? [];
  return (
    <View style={styles.panel}>
      <SectionLabel
        left={t('commandPost.rosterReadiness')}
        right={
          <View style={styles.sortToggle}>
            <Pressable onPress={() => onSort('readiness')} hitSlop={6}>
              <Text style={[styles.sortOpt, sort === 'readiness' && styles.sortOptActive]}>
                {t('commandPost.sortReadiness')}
              </Text>
            </Pressable>
            <Text style={styles.sortSep}>/</Text>
            <Pressable onPress={() => onSort('steps')} hitSlop={6}>
              <Text style={[styles.sortOpt, sort === 'steps' && styles.sortOptActive]}>
                {t('commandPost.sortSteps')}
              </Text>
            </Pressable>
          </View>
        }
      />
      <View style={styles.rosterHeadRow}>
        <Text style={[styles.rosterHeadCell, styles.colName]}>{t('commandPost.colMember')}</Text>
        <Text style={[styles.rosterHeadCell, styles.colSteps]}>{t('commandPost.colSteps')}</Text>
        <Text style={[styles.rosterHeadCell, styles.colSince]}>{t('commandPost.colSince')}</Text>
      </View>
      {members.map((m, i) => (
        <View
          key={m.player_id}
          style={[styles.rosterRow, i < members.length - 1 && styles.rowBorder]}
        >
          <View style={[styles.colName, styles.nameCell]}>
            <View
              style={[
                styles.pDot,
                m.daily_participation_today ? styles.pDotOn : styles.pDotOff,
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>{m.username ?? '—'}</Text>
              <Text style={styles.memberTitle} numberOfLines={1}>
                {t(`levelTitle.${m.level_title}`, m.level_title)}
              </Text>
            </View>
          </View>
          <Text style={[styles.stepsCell, styles.colSteps]}>{formatInt(m.weekly_steps)}</Text>
          <Text style={[styles.sinceCell, styles.colSince]}>
            {m.days_since_last_activity == null
              ? '—'
              : m.days_since_last_activity === 0
                ? t('commandPost.today')
                : `${m.days_since_last_activity}${t('commandPost.daysShort')}`}
          </Text>
        </View>
      ))}
      <Text style={styles.rosterFootnote}>{t('commandPost.rosterFootnote')}</Text>
    </View>
  );
}

// --- Weekly Orders — the Sat–Sun pick ritual -----------------------------------
function WeeklyOrders({ menu, pickSaving, onPick, t }) {
  if (!menu) return null;
  const windowOpen = menu.pick_window_open;
  const currentPick = menu.current_pick?.task_type ?? null;

  return (
    <View style={styles.panel}>
      <SectionLabel
        left={t('weeklyTask.ordersPanel')}
        accent={windowOpen ? t('weeklyTask.windowOpen') : t('weeklyTask.windowClosed')}
      />
      {!windowOpen ? (
        <View style={styles.clearBlock}>
          <Text style={styles.clearSub}>
            {currentPick
              ? t('weeklyTask.pickLockedWith', { task: t(`weeklyTask.name.${currentPick}`) })
              : t('weeklyTask.pickOpensSaturday')}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.ordersLead}>
            {t('weeklyTask.pickLead', { date: menu.picks_for_week })}
          </Text>
          {menu.cards.map((card) => {
            const selected = card.task_type === currentPick;
            return (
              <View
                key={card.task_type}
                style={[styles.orderCard, selected && styles.orderCardSelected]}
              >
                <View style={styles.orderBody}>
                  <View style={styles.orderTopRow}>
                    <Text style={styles.orderName}>
                      {t(`weeklyTask.name.${card.task_type}`)}
                    </Text>
                  </View>
                  <Text style={styles.orderMeta}>
                    {t('weeklyTask.quotaLine', {
                      quota: formatTaskValue(t, card.unit, card.per_member_quota),
                    })}
                    {'  ·  '}
                    {t('weeklyTask.projectedLine', {
                      target: formatTaskValue(t, card.unit, card.projected_target),
                      n: menu.live_member_count,
                    })}
                  </Text>
                  <Text style={styles.orderReward}>
                    {t('weeklyTask.rewardLabel')} {rewardLine(t, card.personal_payout)}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.chosenTagBox}>
                    <Text style={styles.orderSelectedTag}>{t('weeklyTask.pickedTag')}</Text>
                  </View>
                ) : menu.can_pick ? (
                  <Pressable
                    disabled={pickSaving}
                    onPress={() => onPick(card.task_type)}
                    style={({ pressed }) => [
                      styles.chooseBtn,
                      (pressed || pickSaving) && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={styles.chooseBtnText}>{t('weeklyTask.chooseBtn')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <Text style={styles.radarFootnote}>
            {menu.can_pick
              ? t('weeklyTask.pickFootnote')
              : t('weeklyTask.pickViewOnly')}
          </Text>
        </>
      )}
    </View>
  );
}

// --- The March — per-member contribution breakdown -----------------------------
function MarchBreakdown({ weekly, t }) {
  const task = weekly?.task;
  const breakdown = weekly?.breakdown;
  if (!task || !breakdown || breakdown.length === 0) return null;

  return (
    <View style={styles.panel}>
      <SectionLabel
        left={t('weeklyTask.breakdownPanel')}
        accent={t(`weeklyTask.name.${task.task_type}`)}
      />
      {breakdown.map((m, i) => (
        <View
          key={m.player_id}
          style={[styles.riskRow, i < breakdown.length - 1 && styles.rowBorder]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(m.username)}</Text>
          </View>
          <View style={styles.riskBody}>
            <Text style={styles.riskName}>{m.username ?? '—'}</Text>
          </View>
          <Text style={m.share_earned ? styles.marchValueEarned : styles.marchValue}>
            {formatTaskValue(t, task.unit, m.contribution)}
            {m.share_earned ? ' ✓' : ''}
          </Text>
        </View>
      ))}
      <Text style={styles.radarFootnote}>{t('weeklyTask.breakdownFootnote')}</Text>
    </View>
  );
}

function WeekInReview({ card, allianceName, shortName, t }) {
  const onShare = useCallback(async () => {
    if (!card) return;
    const pct = Math.round((card.participation_rate ?? 0) * 100);
    const msg = t('commandPost.shareBody', {
      alliance: allianceName,
      distance: formatInt(card.total_distance_km),
      territories: card.territories_held,
      participation: pct,
      streak: card.longest_active_streak,
    });
    try {
      await Share.share({ message: msg });
    } catch (_) { /* user dismissed */ }
  }, [card, allianceName, t]);

  return (
    <View style={styles.panel}>
      <SectionLabel left={t('commandPost.weekInReview')} />
      {!card ? (
        <View style={styles.clearBlock}>
          <Text style={styles.clearSub}>{t('commandPost.wirPending')}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardKicker}>{shortName} · {t('commandPost.weekOf', { date: card.week_start })}</Text>
          <Text style={styles.cardTitle}>{(allianceName ?? '').toUpperCase()}</Text>
          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{formatInt(card.total_distance_km)}</Text>
              <Text style={styles.statLabel}>{t('commandPost.statDistance')}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{card.territories_held}</Text>
              <Text style={styles.statLabel}>{t('commandPost.statTerritories')}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{Math.round((card.participation_rate ?? 0) * 100)}%</Text>
              <Text style={styles.statLabel}>{t('commandPost.statParticipation')}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{card.longest_active_streak}</Text>
              <Text style={styles.statLabel}>{t('commandPost.statStreak')}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
            onPress={onShare}
          >
            <Text style={styles.shareBtnText}>{t('commandPost.share')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function CommandPostScreen({ route }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const {
    allianceId = null,
    allianceName = 'Alliance',
    shortName = '—',
  } = route?.params ?? {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cp, setCp] = useState(null);
  const [wir, setWir] = useState(null);
  const [menu, setMenu] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [pickSaving, setPickSaving] = useState(false);
  const [sort, setSort] = useState('readiness');

  // Clerk's getToken is a fresh reference on every render. Hold it in a ref so
  // the fetch effect depends only on [isFocused, allianceId, sort] — never on an
  // unstable callback (that caused a re-fetch loop → slow load + flicker).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  // Only the very first load shows the full-screen spinner; sort toggles and
  // refocus refetch silently under the existing content.
  const hasLoadedRef = useRef(false);
  const isFocused = useIsFocused();

  // Drive the fetch off isFocused (not useFocusEffect) so it reliably re-runs
  // every time the screen is returned to. try/finally guarantees `loading`
  // always resolves — even if a prior slow load was cancelled by navigating
  // away mid-flight — so the screen can never get stuck on the spinner.
  useEffect(() => {
    if (!isFocused) return undefined;
    if (!allianceId) {
      setError('no_alliance');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      if (!hasLoadedRef.current) setLoading(true);
      try {
        const clerkGetToken = () => getTokenRef.current();
        const [cpRes, wirRes, menuRes, weeklyRes] = await Promise.all([
          getCommandPost({ clerkGetToken, allianceId, sort }),
          getWeekInReview({ clerkGetToken, allianceId }),
          getWeeklyTaskMenu({ clerkGetToken, allianceId }),
          getWeeklyTask({ clerkGetToken, allianceId }),
        ]);
        if (cancelled) return;

        if (cpRes.ok) {
          setCp(cpRes.data);
          setError(null);
        } else if (cpRes.status === 403) {
          setError('not_founder');
        } else {
          setError('load_failed');
        }
        if (wirRes.ok) setWir(wirRes.data?.week_in_review ?? null);
        if (menuRes.ok) setMenu(menuRes.data);
        if (weeklyRes.ok) setWeekly(weeklyRes.data);
      } catch (_) {
        if (!cancelled) setError('load_failed');
      } finally {
        if (!cancelled) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, allianceId, sort]);

  const onSort = useCallback((next) => setSort(next), []);

  const onPick = useCallback(async (taskType) => {
    if (!allianceId || pickSaving) return;
    setPickSaving(true);
    try {
      const clerkGetToken = () => getTokenRef.current();
      const res = await pickWeeklyTask({ clerkGetToken, allianceId, taskType });
      if (res.ok) {
        // Reflect the pick without a full reload.
        setMenu((prev) =>
          prev
            ? { ...prev, current_pick: { task_type: taskType, picked_by: null } }
            : prev,
        );
      }
    } finally {
      setPickSaving(false);
    }
  }, [allianceId, pickSaving]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('commandPost.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.2}>{t('commandPost.title')}</Text>
        <Text style={styles.headerSub}>[{shortName}] · {(allianceName ?? '').toUpperCase()}</Text>
        <View style={styles.headerDivider} />
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.slate2} />
        </View>
      ) : error === 'not_founder' ? (
        <View style={styles.loadingBlock}>
          <Text style={styles.errorText}>{t('commandPost.errNotFounder')}</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingBlock}>
          <Text style={styles.errorText}>{t('commandPost.errLoad')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
          <WeeklyOrders menu={menu} pickSaving={pickSaving} onPick={onPick} t={t} />
          <MarchBreakdown weekly={weekly} t={t} />
          <LapseRadar radar={cp?.lapse_radar} t={t} />
          <RosterReadiness
            readiness={cp?.roster_readiness}
            sort={sort}
            onSort={onSort}
            t={t}
          />
          <WeekInReview card={wir} allianceName={allianceName} shortName={shortName} t={t} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: {
    paddingTop: (StatusBar.currentHeight ?? 0) + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn: { marginBottom: spacing.md },
  backBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.md,
    color: colors.claim,
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.bone,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    lineHeight: 44,
  },
  headerSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    letterSpacing: 1.4,
    marginTop: 6,
  },
  headerDivider: { height: 1, backgroundColor: colors.hairlineStrong, marginTop: 14 },

  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: fonts.body, fontSize: fontSize.md, color: colors.slate2, textAlign: 'center', paddingHorizontal: spacing.xl },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  panel: { paddingTop: spacing.xl },

  // section label
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  sectionLabelText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  sectionLabelAccent: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.claim,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  sectionHairline: { flex: 1, height: 1, backgroundColor: colors.hairline, marginHorizontal: spacing.md },

  // lapse radar
  clearBlock: { paddingVertical: spacing.md },
  clearHeadline: { fontFamily: fonts.displayMedium, fontSize: fontSize.xl, color: colors.alliance },
  clearSub: { fontFamily: fonts.body, fontSize: fontSize.md, color: colors.slate2, marginTop: 4 },
  riskHeadline: {
    fontFamily: fonts.displayMedium,
    fontSize: fontSize.xl,
    color: colors.claim,
    marginBottom: spacing.md,
  },
  riskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  avatar: {
    width: 34, height: 34, backgroundColor: colors.ink3,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.monoMedium, fontSize: fontSize.md, color: colors.bone, letterSpacing: 0.5 },
  riskBody: { flex: 1 },
  riskName: { fontFamily: fonts.bodyMedium, fontSize: fontSize.base, color: colors.bone, marginBottom: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonChip: { backgroundColor: colors.claimSoft, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  reasonChipText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.claim, letterSpacing: 0.4 },
  radarFootnote: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.slate, marginTop: spacing.md, fontStyle: 'italic' },

  // roster
  rosterHeadRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm },
  rosterHeadCell: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate, textTransform: 'uppercase', letterSpacing: 1.2 },
  colName: { flex: 1 },
  colSteps: { width: 76, textAlign: 'right' },
  colSince: { width: 56, textAlign: 'right' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pDot: { width: 7, height: 7, borderRadius: 4 },
  pDotOn: { backgroundColor: colors.alliance },
  pDotOff: { backgroundColor: colors.ink3, borderWidth: 1, borderColor: colors.hairlineStrong },
  memberName: { fontFamily: fonts.bodyMedium, fontSize: fontSize.base, color: colors.bone },
  memberTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate2, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  stepsCell: { fontFamily: fonts.monoMedium, fontSize: fontSize.base, color: colors.bone },
  sinceCell: { fontFamily: fonts.mono, fontSize: fontSize.md, color: colors.slate2 },
  rosterFootnote: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.slate, marginTop: spacing.md, fontStyle: 'italic' },

  // sort toggle
  sortToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sortOpt: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate, textTransform: 'uppercase', letterSpacing: 1.0 },
  sortOptActive: { color: colors.bone },
  sortSep: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate },

  // weekly orders
  ordersLead: { fontFamily: fonts.body, fontSize: fontSize.md, color: colors.slate2, marginBottom: spacing.md },
  orderCard: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  orderCardSelected: { borderColor: colors.claim, borderLeftWidth: 2, borderLeftColor: colors.claim },
  orderBody: { flex: 1 },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderName: { fontFamily: fonts.bodyMedium, fontSize: fontSize.base, color: colors.bone },
  orderSelectedTag: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.xs,
    color: colors.claim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chosenTagBox: { paddingHorizontal: spacing.sm },
  chooseBtn: {
    backgroundColor: colors.claim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.xs,
    color: colors.bone,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  orderMeta: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate2, marginTop: 6, letterSpacing: 0.4 },
  orderReward: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    color: colors.slate,
    marginTop: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  marchValue: { fontFamily: fonts.monoMedium, fontSize: fontSize.md, color: colors.slate2 },
  marchValueEarned: { fontFamily: fonts.monoMedium, fontSize: fontSize.md, color: colors.alliance },

  // week in review card
  card: { backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.hairlineStrong, padding: spacing.lg },
  cardKicker: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate2, textTransform: 'uppercase', letterSpacing: 1.4 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.bone, textTransform: 'uppercase', marginTop: 4, marginBottom: spacing.lg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', paddingVertical: spacing.md },
  statValue: { fontFamily: fonts.displayMedium, fontSize: fontSize.xl2, color: colors.bone },
  statLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.slate2, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2 },
  shareBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.claim,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  shareBtnText: { fontFamily: fonts.monoMedium, fontSize: fontSize.lg, color: colors.bone, letterSpacing: 1.2, textTransform: 'uppercase' },
});
