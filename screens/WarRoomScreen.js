import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { MoraleGlyph, InfluenceGlyph } from '../components/ResourceGlyphs';
import { colors, fonts, fontSize, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { getAllianceAbilities, activateAllianceAbility } from '../lib/allianceApi';
import { calcDailyInfluence } from '../lib/formulas';

const normaliseTier = t =>
  t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Small';

// Display copy (name/cost/duration/effect) lives in locales under
// warRoom.abilities.<id>. Costs, durations, windows, cooldowns and buff
// state are server-authoritative (GET /alliances/:id/abilities); `ability`
// is the backend id.
const ABILITIES = [
  { id: 'warSurge', ability: 'war_surge' },
  { id: 'ironBulwark', ability: 'iron_bulwark' },
  { id: 'rallyCry', ability: 'rally_cry' },
  { id: 'steadfast', ability: 'steadfast' },
  { id: 'supplyLine', ability: 'supply_line' },
];

// "7H 59M" / "42M" — countdown for cooldown + active-buff labels.
// Unit letters come from locales (warRoom.unitH etc.) so ru renders Ч/М.
function formatCountdown(msRemaining, u) {
  const totalMin = Math.max(1, Math.ceil(msRemaining / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}${u.h} ${m}${u.m}` : `${m}${u.m}`;
}

// "2D 14H" / "14H 32M" / "45M" — long-range countdown for the Attack Day card.
function formatDayCountdown(msRemaining, u) {
  const totalMin = Math.max(1, Math.ceil(msRemaining / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}${u.d} ${h}${u.h}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  return `${m}${u.m}`;
}

// Attack Days are Sat/Sun; contests run 05:00–23:00 device-local (mirrors the
// backend gate, which uses the player's home timezone — same thing unless the
// player is travelling). Returns the live window or the next opening.
function nextAttackWindow(now) {
  const atHour = (base, h) => {
    const x = new Date(base);
    x.setHours(h, 0, 0, 0);
    return x;
  };
  const day = now.getDay(); // Sun=0 … Sat=6
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    const opensAt = atHour(now, 5);
    const closesAt = atHour(now, 23);
    if (now >= opensAt && now < closesAt) {
      return { live: true, closesAt };
    }
    if (now < opensAt) {
      return { live: false, opensAt, dayKey: 'today' };
    }
    if (day === 6) {
      // Saturday after close → Sunday 05:00.
      const sunday = new Date(now);
      sunday.setDate(now.getDate() + 1);
      return { live: false, opensAt: atHour(sunday, 5), dayKey: 'sunday' };
    }
  }

  // Weekday, or Sunday after close → next Saturday 05:00.
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + (day === 0 ? 6 : 6 - day));
  return { live: false, opensAt: atHour(saturday, 5), dayKey: 'saturday' };
}

function SectionLabel({ left, accent }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{left}</Text>
      {accent ? <Text style={styles.sectionLabelAccent}> · {accent}</Text> : null}
      <View style={styles.sectionHairline} />
    </View>
  );
}

export default function WarRoomScreen({ route }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const {
    allianceId = null,
    allianceName = 'Alliance',
    shortName = '—',
  } = route?.params ?? {};

  const [loading, setLoading] = useState(true);
  const [warChestMorale, setWarChestMorale] = useState(0);
  const [allianceInfluence, setAllianceInfluence] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [abilityStates, setAbilityStates] = useState({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [error, setError] = useState(null);

  // Drives the cooldown / active-buff countdowns.
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);

  function applyAbilityPayload(payload) {
    const byAbility = {};
    for (const st of payload?.abilities ?? []) byAbility[st.id] = st;
    setAbilityStates(byAbility);
    setCanManage(payload?.can_manage === true);
    if (typeof payload?.alliance_morale === 'number') {
      setWarChestMorale(payload.alliance_morale);
    }
    setNowMs(Date.now());
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWarRoom() {
      if (!allianceId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [allianceResult, territoriesResult, abilitiesResult] = await Promise.all([
        supabase
          .from('alliances')
          .select('morale')
          .eq('id', allianceId)
          .maybeSingle(),
        supabase
          .from('territories')
          .select('tier, development_level, legacy_rank')
          .eq('alliance_id', allianceId),
        getAllianceAbilities({ clerkGetToken: getToken, allianceId }),
      ]);

      if (cancelled) return;

      if (allianceResult.error) {
        setError(allianceResult.error.message ?? t('warRoom.errFallback'));
        setLoading(false);
        return;
      }

      setWarChestMorale(allianceResult.data?.morale ?? 0);
      if (abilitiesResult.ok) {
        applyAbilityPayload(abilitiesResult.data);
      }

      const territories = territoriesResult.data ?? [];
      const totalInfluence = territories.reduce((sum, t) => {
        try {
          return sum + calcDailyInfluence({
            tier: normaliseTier(t.tier),
            developmentLevel: t.development_level ?? 0,
            legacyRank: t.legacy_rank ?? 1,
          });
        } catch {
          return sum;
        }
      }, 0);

      setAllianceInfluence(totalInfluence);
      setLoading(false);
    }

    loadWarRoom();
    return () => { cancelled = true; };
  }, [allianceId]);

  function activationErrorMessage(code, windowType) {
    switch (code) {
      case 'insufficient_morale':
        return t('warRoom.errMorale');
      case 'cooldown_active':
        return t('warRoom.errCooldown');
      case 'ability_used_this_week':
        return t('warRoom.errUsedWeek');
      case 'outside_window':
        return windowType === 'weekday'
          ? t('warRoom.errWindowWeekday')
          : t('warRoom.errWindowWeekend');
      default:
        return t('warRoom.alertFailedBody');
    }
  }

  function confirmActivate(abilityKey, name, costAmount, windowType) {
    Alert.alert(
      t('warRoom.alertActivateTitle', { ability: name }),
      t('warRoom.alertActivateBody', { cost: costAmount }),
      [
        { text: t('warRoom.alertCancel'), style: 'cancel' },
        {
          text: t('warRoom.alertActivateConfirm'),
          style: 'destructive',
          onPress: async () => {
            const res = await activateAllianceAbility({
              clerkGetToken: getToken,
              allianceId,
              ability: abilityKey,
            });
            if (!res.ok) {
              const code = typeof res.error === 'object' ? res.error?.error : res.error;
              Alert.alert(
                t('warRoom.alertFailedTitle'),
                activationErrorMessage(code, windowType),
              );
            } else {
              applyAbilityPayload(res.data);
            }
          },
        },
      ]
    );
  }

  // Localised time-unit letters for the countdowns (en: D/H/M, ru: Д/Ч/М).
  const timeUnits = {
    d: t('warRoom.unitD'),
    h: t('warRoom.unitH'),
    m: t('warRoom.unitM'),
  };

  // Recomputed every render; nowMs ticks every 10s so the card stays live.
  const attackWindow = nextAttackWindow(new Date(nowMs));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('warRoom.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('warRoom.title')}</Text>
        <Text style={styles.headerSub}>[{shortName}] · {allianceName.toUpperCase()}</Text>
        <View style={styles.headerDivider} />
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.slate2} />
          <Text style={styles.loadingText}>{t('warRoom.loading')}</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ALLIANCE INFLUENCE */}
          <View style={styles.influenceBlock}>
            <View style={styles.influenceHeader}>
              <Text style={styles.influenceLabel}>{t('warRoom.influenceLabel')}</Text>
              <View style={styles.influenceHairline} />
            </View>
            <View style={styles.influenceRow}>
              <InfluenceGlyph size={32} color={colors.bone} />
              <View style={styles.influenceTextStack}>
                <Text style={styles.influenceValue}>
                  {allianceInfluence % 1 === 0
                    ? allianceInfluence.toLocaleString()
                    : allianceInfluence.toFixed(1)}
                </Text>
                <Text style={styles.influenceSublabel}>{t('warRoom.influenceSublabel')}</Text>
                <Text style={styles.influenceContext}>
                  {t('warRoom.influenceContext')}
                </Text>
              </View>
            </View>
          </View>

          {/* ATTACK DAY COUNTDOWN */}
          <SectionLabel
            left={attackWindow.live ? t('warRoom.attackDayLive') : t('warRoom.nextAttackDay')}
          />
          <View
            style={[
              styles.countdownCard,
              attackWindow.live && styles.countdownCardLive,
            ]}
          >
            {attackWindow.live ? (
              <>
                <Text style={[styles.countdownValue, styles.countdownValueLive]}>
                  {formatDayCountdown(attackWindow.closesAt.getTime() - nowMs, timeUnits)}
                </Text>
                <Text style={styles.countdownDay}>
                  {t('warRoom.attackDayCloses')}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.countdownValue}>
                  {formatDayCountdown(attackWindow.opensAt.getTime() - nowMs, timeUnits)}
                </Text>
                <Text style={styles.countdownDay}>
                  {t(`warRoom.attackDayName.${attackWindow.dayKey}`)} · 05:00 – 23:00
                </Text>
              </>
            )}
          </View>

          {/* WAR CHEST — MORALE ONLY */}
          <SectionLabel left={t('warRoom.warChest')} accent={t('warRoom.warChestAccent')} />
          <View style={styles.warChestMoraleCell}>
            <View style={styles.warChestMoraleLeft}>
              <Text style={styles.warChestMoraleValue}>
                {warChestMorale.toLocaleString()}
              </Text>
              <Text style={styles.warChestLabel}>{t('warRoom.moraleLabel')}</Text>
              <Text style={styles.warChestSub}>
                {t('warRoom.warChestSub')}
              </Text>
            </View>
            <MoraleGlyph size={32} color={colors.alliance} />
          </View>

          {/* MORALE ABILITIES */}
          <SectionLabel left={t('warRoom.abilitiesLabel')} accent={t('warRoom.abilitiesAccent')} />
          {ABILITIES.map((a, i) => {
            const name = t(`warRoom.abilities.${a.id}.name`);
            const st = abilityStates[a.ability] ?? null;
            const windowType = st?.window ?? (a.ability === 'supply_line' ? 'weekday' : 'weekend');
            const costAmount = st?.morale_cost ?? 0;

            const cooldownMs = st?.cooldown_until
              ? new Date(st.cooldown_until).getTime() - nowMs
              : 0;
            const activeMs = st?.active_until
              ? new Date(st.active_until).getTime() - nowMs
              : 0;
            const onCooldown = cooldownMs > 0;
            const usedThisWeek = st?.used_this_week === true;
            const windowClosed = st?.reason === 'outside_window';
            const canAfford = st !== null && warChestMorale >= costAmount;

            const enabled =
              canManage && st !== null && !onCooldown && !usedThisWeek &&
              !windowClosed && canAfford;

            let btnLabel = t('warRoom.activate');
            if (onCooldown) btnLabel = formatCountdown(cooldownMs, timeUnits);
            else if (usedThisWeek) btnLabel = t('warRoom.usedBtn');

            return (
            <React.Fragment key={a.id}>
              <View style={styles.abilityRow}>
                <View style={styles.abilityLeft}>
                  <Text style={styles.abilityName}>{name}</Text>
                  <Text style={styles.abilityCost}>
                    {t(`warRoom.abilities.${a.id}.cost`)} · {t(`warRoom.abilities.${a.id}.duration`)} · {windowType === 'weekday' ? t('warRoom.windowWeekday') : t('warRoom.windowWeekend')}
                  </Text>
                  <Text style={styles.abilityEffect}>{t(`warRoom.abilities.${a.id}.effect`)}</Text>
                  {activeMs > 0 ? (
                    <Text style={styles.abilityActive}>
                      {t('warRoom.activeLabel')} · {formatCountdown(activeMs, timeUnits)}
                    </Text>
                  ) : null}
                  {usedThisWeek && !onCooldown && activeMs <= 0 ? (
                    <Text style={styles.abilityUsed}>{t('warRoom.resetsMonday')}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.activateBtn, !enabled && styles.activateBtnDisabled]}
                  onPress={enabled ? () => confirmActivate(a.ability, name, costAmount, windowType) : undefined}
                  disabled={!enabled}
                >
                  <Text style={[styles.activateBtnText, enabled && styles.activateBtnTextActive]}>
                    {btnLabel}
                  </Text>
                </Pressable>
              </View>
              {i < ABILITIES.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    paddingTop: (StatusBar.currentHeight ?? 0) + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
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
  headerDivider: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
    marginTop: 14,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.md,
    color: colors.slate2,
  },
  errorBanner: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.slate2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  influenceBlock: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  influenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  influenceLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.md,
    letterSpacing: fontSize.md * 0.16,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  influenceHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
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
    letterSpacing: 10 * 0.16,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  influenceContext: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.slate2,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionLabelText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.sm,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionHairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineStrong,
    marginLeft: spacing.sm,
  },
  countdownCard: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    borderLeftWidth: 2,
    borderLeftColor: colors.claim,
    padding: spacing.lg,
  },
  countdownCardLive: {
    borderLeftColor: colors.claim,
    backgroundColor: colors.claimSoft,
  },
  countdownValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 40,
    color: colors.bone,
    letterSpacing: -0.02,
  },
  countdownValueLive: {
    color: colors.claim,
  },
  countdownDay: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    letterSpacing: 1.4,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  warChestMoraleCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  warChestMoraleLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs,
  },
  warChestMoraleValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 40,
    color: colors.alliance,
    letterSpacing: -0.02,
  },
  warChestLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  warChestSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.slate2,
    marginTop: 4,
  },
  abilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: spacing.md,
  },
  abilityLeft: {
    flex: 1,
  },
  abilityName: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    color: colors.bone,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  abilityCost: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.2,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  abilityEffect: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.slate2,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  abilityActive: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.sm,
    color: colors.alliance,
    letterSpacing: 1.2,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  abilityUsed: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.2,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  activateBtn: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBtnDisabled: {
    borderColor: colors.hairline,
    opacity: 0.4,
  },
  activateBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  activateBtnTextActive: {
    color: colors.bone,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
});
