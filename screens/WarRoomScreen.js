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
import { spendAllianceMorale } from '../lib/allianceApi';
import { calcDailyInfluence } from '../lib/formulas';

const normaliseTier = t =>
  t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Small';

// Display copy (name/cost/duration/effect) lives in locales under
// warRoom.abilities.<id>; only the id and numeric morale cost live here.
const ABILITIES = [
  { id: 'warSurge', morale: 80 },
  { id: 'ironBulwark', morale: 80 },
  { id: 'rallyCry', morale: 60 },
  { id: 'steadfast', morale: 60 },
  { id: 'supplyLine', morale: 40 },
  { id: 'unifiedFront', morale: 100 },
];

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
    currentPlayerId = null,
  } = route?.params ?? {};

  const [loading, setLoading] = useState(true);
  const [warChestMorale, setWarChestMorale] = useState(0);
  const [allianceInfluence, setAllianceInfluence] = useState(0);
  const [isFounder, setIsFounder] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWarRoom() {
      if (!allianceId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [allianceResult, territoriesResult, founderResult] = await Promise.all([
        supabase
          .from('alliances')
          .select('morale')
          .eq('id', allianceId)
          .maybeSingle(),
        supabase
          .from('territories')
          .select('tier, development_level, legacy_rank, upkeep_overdue')
          .eq('alliance_id', allianceId),
        supabase
          .from('alliances')
          .select('founder_id')
          .eq('id', allianceId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (allianceResult.error) {
        setError(allianceResult.error.message ?? t('warRoom.errFallback'));
        setLoading(false);
        return;
      }

      setWarChestMorale(allianceResult.data?.morale ?? 0);
      setIsFounder(founderResult.data?.founder_id === currentPlayerId);

      const territories = territoriesResult.data ?? [];
      const totalInfluence = territories.reduce((sum, t) => {
        try {
          return sum + calcDailyInfluence({
            tier: normaliseTier(t.tier),
            developmentLevel: t.development_level ?? 0,
            legacyRank: t.legacy_rank ?? 1,
            upkeepOverdue: t.upkeep_overdue ?? false,
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

  async function confirmActivate(ability, costAmount) {
    if (warChestMorale < costAmount) return;

    Alert.alert(
      t('warRoom.alertActivateTitle', { ability }),
      t('warRoom.alertActivateBody', { cost: costAmount }),
      [
        { text: t('warRoom.alertCancel'), style: 'cancel' },
        {
          text: t('warRoom.alertActivateConfirm'),
          style: 'destructive',
          onPress: async () => {
            const res = await spendAllianceMorale({ clerkGetToken: getToken, allianceId, amount: costAmount });
            if (!res.ok) {
              Alert.alert(t('warRoom.alertFailedTitle'), t('warRoom.alertFailedBody'));
            } else {
              setWarChestMorale(res.data.alliance_morale);
            }
          },
        },
      ]
    );
  }

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
          <SectionLabel left={t('warRoom.nextAttackDay')} />
          <View style={styles.countdownCard}>
            <Text style={styles.countdownValue}>2D 14H</Text>
            <Text style={styles.countdownDay}>SATURDAY · 05:00 – 23:00</Text>
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
            return (
            <React.Fragment key={a.id}>
              <View style={styles.abilityRow}>
                <View style={styles.abilityLeft}>
                  <Text style={styles.abilityName}>{name}</Text>
                  <Text style={styles.abilityCost}>{t(`warRoom.abilities.${a.id}.cost`)} · {t(`warRoom.abilities.${a.id}.duration`)}</Text>
                  <Text style={styles.abilityEffect}>{t(`warRoom.abilities.${a.id}.effect`)}</Text>
                </View>
                {(() => {
                  const costAmount = a.morale;
                  const canAfford = warChestMorale >= costAmount;
                  const active = isFounder && canAfford;
                  return (
                    <Pressable
                      style={[styles.activateBtn, !active && styles.activateBtnDisabled]}
                      onPress={active ? () => confirmActivate(name, costAmount) : undefined}
                      disabled={!active}
                    >
                      <Text style={[styles.activateBtnText, active && styles.activateBtnTextActive]}>
                        {t('warRoom.activate')}
                      </Text>
                    </Pressable>
                  );
                })()}
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
  countdownValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 40,
    color: colors.bone,
    letterSpacing: -0.02,
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
