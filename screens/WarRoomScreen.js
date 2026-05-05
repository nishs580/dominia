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
import { MoraleGlyph, InfluenceGlyph } from '../components/ResourceGlyphs';
import { colors, fonts, fontSize, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { calcDailyInfluence } from '../lib/formulas';

const normaliseTier = t =>
  t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Small';

const ABILITIES = [
  {
    name: 'WAR SURGE',
    cost: '80 MORALE',
    duration: '6 HOURS',
    effect: 'Attacker Iron costs −40% for all contests opened during window.',
  },
  {
    name: 'IRON BULWARK',
    cost: '80 MORALE',
    duration: '6 HOURS',
    effect: 'Contesting any alliance territory costs 40% more Iron.',
  },
  {
    name: 'RALLY CRY',
    cost: '60 MORALE',
    duration: '12 HOURS',
    effect: 'Attackers walk 80% of the normal contest distance.',
  },
  {
    name: 'STEADFAST',
    cost: '60 MORALE',
    duration: '12 HOURS',
    effect: 'Defenders only need to walk 80% of attacker distance.',
  },
  {
    name: 'SUPPLY LINE',
    cost: '40 MORALE',
    duration: '24 HOURS',
    effect: 'All resource earn events give +20% for all members.',
  },
  {
    name: 'UNIFIED FRONT',
    cost: '100 MORALE',
    duration: '48 HOURS',
    effect: 'No member can have their streak broken during this window.',
  },
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

function parseMoraleCost(costStr) {
  const match = costStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function WarRoomScreen({ route }) {
  const navigation = useNavigation();
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
        setError(allianceResult.error.message ?? 'Could not load war room');
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
      `Activate ${ability}?`,
      `Costs ${costAmount} Morale from the war chest.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('deduct_alliance_morale', {
              alliance_id: allianceId,
              amount: costAmount,
            });
            if (error) {
              Alert.alert('Failed', 'Could not activate ability. Try again.');
            } else {
              setWarChestMorale(prev => prev - costAmount);
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
          <Text style={styles.backBtnText}>← ALLIANCE</Text>
        </Pressable>
        <Text style={styles.headerTitle}>WAR ROOM</Text>
        <Text style={styles.headerSub}>[{shortName}] · {allianceName.toUpperCase()}</Text>
        <View style={styles.headerDivider} />
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.slate2} />
          <Text style={styles.loadingText}>Loading war room…</Text>
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
              <Text style={styles.influenceLabel}>INFLUENCE</Text>
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
                <Text style={styles.influenceSublabel}>ALLIANCE INFLUENCE / DAY</Text>
                <Text style={styles.influenceContext}>
                  Earned daily from alliance-held territories
                </Text>
              </View>
            </View>
          </View>

          {/* ATTACK DAY COUNTDOWN */}
          <SectionLabel left="NEXT ATTACK DAY" />
          <View style={styles.countdownCard}>
            <Text style={styles.countdownValue}>2D 14H</Text>
            <Text style={styles.countdownDay}>SATURDAY · 05:00 – 23:00</Text>
          </View>

          {/* WAR CHEST — MORALE ONLY */}
          <SectionLabel left="WAR CHEST" accent="ALLIANCE MORALE" />
          <View style={styles.warChestMoraleCell}>
            <View style={styles.warChestMoraleLeft}>
              <Text style={styles.warChestMoraleValue}>
                {warChestMorale.toLocaleString()}
              </Text>
              <Text style={styles.warChestLabel}>MORALE</Text>
              <Text style={styles.warChestSub}>
                Pooled from member donations · powers all abilities
              </Text>
            </View>
            <MoraleGlyph size={32} color={colors.alliance} />
          </View>

          {/* MORALE ABILITIES */}
          <SectionLabel left="MORALE ABILITIES" accent="FOUNDER · MARSHAL ONLY" />
          {ABILITIES.map((a, i) => (
            <React.Fragment key={a.name}>
              <View style={styles.abilityRow}>
                <View style={styles.abilityLeft}>
                  <Text style={styles.abilityName}>{a.name}</Text>
                  <Text style={styles.abilityCost}>{a.cost} · {a.duration}</Text>
                  <Text style={styles.abilityEffect}>{a.effect}</Text>
                </View>
                {(() => {
                  const costAmount = parseMoraleCost(a.cost);
                  const canAfford = warChestMorale >= costAmount;
                  const active = isFounder && canAfford;
                  return (
                    <Pressable
                      style={[styles.activateBtn, !active && styles.activateBtnDisabled]}
                      onPress={active ? () => confirmActivate(a.name, costAmount) : undefined}
                      disabled={!active}
                    >
                      <Text style={[styles.activateBtnText, active && styles.activateBtnTextActive]}>
                        ACTIVATE
                      </Text>
                    </Pressable>
                  );
                })()}
              </View>
              {i < ABILITIES.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
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
