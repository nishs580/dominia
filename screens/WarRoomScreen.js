import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StoneGlyph, IronGlyph, GoldGlyph, ShieldGlyph, MoraleGlyph, InfluenceGlyph } from '../components/ResourceGlyphs';
import { colors, fonts, fontSize, spacing } from '../lib/theme';

const WAR_CHEST = [
  { label: 'MORALE', value: '340', color: colors.alliance, Glyph: MoraleGlyph },
  { label: 'IRON', value: '85', color: colors.bone, Glyph: IronGlyph },
  { label: 'GOLD', value: '120', color: colors.bone, Glyph: GoldGlyph },
  { label: 'STONE', value: '160', color: colors.bone, Glyph: StoneGlyph },
  { label: 'SHIELD', value: '210', color: colors.bone, Glyph: ShieldGlyph },
];

const ABILITIES = [
  {
    name: 'WAR SURGE',
    cost: '100 MORALE',
    duration: '6 HOURS',
    effect: 'Attacker Iron costs −50% for all contests opened during window.',
  },
  {
    name: 'RALLY CRY',
    cost: '60 MORALE',
    duration: '12 HOURS',
    effect: 'Attackers at 1.25:1 advantage for all contests opened during window.',
  },
  {
    name: 'IRON BULWARK',
    cost: '100 MORALE',
    duration: '6 HOURS',
    effect: 'Contesting any alliance territory costs 50% more Iron.',
  },
  {
    name: 'STEADFAST',
    cost: '60 MORALE',
    duration: '12 HOURS',
    effect: 'Defenders only need to log 80% of attacker distance.',
  },
];

function SectionLabel({ left, accent, right }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{left}</Text>
      {accent ? <Text style={styles.sectionLabelAccent}> · {accent}</Text> : null}
      <View style={styles.sectionHairline} />
      {right ? <Text style={styles.sectionLabelRight}>{right}</Text> : null}
    </View>
  );
}

export default function WarRoomScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← ALLIANCE</Text>
        </Pressable>
        <Text style={styles.headerTitle}>WAR ROOM</Text>
        <Text style={styles.headerSub}>[KAI] · KAINETIC ALLIED</Text>
        <View style={styles.headerDivider} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.influenceBlock}>
          <View style={styles.influenceHeader}>
            <Text style={styles.influenceLabel}>INFLUENCE</Text>
            <View style={styles.influenceHairline} />
          </View>
          <View style={styles.influenceRow}>
            <InfluenceGlyph size={32} color={colors.bone} />
            <View style={styles.influenceTextStack}>
              <Text style={styles.influenceValue}>127,683</Text>
              <Text style={styles.influenceSublabel}>ALLIANCE INFLUENCE</Text>
              <Text style={styles.influenceContext}>Earned daily from alliance-held territories</Text>
            </View>
          </View>
        </View>

        {/* ATTACK DAY COUNTDOWN */}
        <SectionLabel left="NEXT ATTACK DAY" />
        <View style={styles.countdownCard}>
          <Text style={styles.countdownValue}>2D 14H</Text>
          <Text style={styles.countdownDay}>SATURDAY · 05:00 – 23:00</Text>
        </View>

        {/* WAR CHEST */}
        <SectionLabel left="WAR CHEST" accent="ALLIANCE RESERVES" />
        <View style={styles.warChestContainer}>
          {/* MORALE — full width */}
          <View style={styles.warChestMoraleCell}>
            <View style={styles.warChestMoraleLeft}>
              <Text style={[styles.warChestValue, { color: colors.alliance, fontSize: 32 }]}>
                340
              </Text>
              <Text style={styles.warChestLabel}>MORALE</Text>
            </View>
            <MoraleGlyph size={28} color={colors.alliance} />
          </View>

          {/* 2x2 GRID — Iron, Gold, Stone, Shield */}
          <View style={styles.warChestGrid}>
            {[
              { label: 'IRON', value: '85', color: colors.bone, Glyph: IronGlyph },
              { label: 'GOLD', value: '120', color: colors.bone, Glyph: GoldGlyph },
              { label: 'STONE', value: '160', color: colors.bone, Glyph: StoneGlyph },
              { label: 'SHIELD', value: '210', color: colors.bone, Glyph: ShieldGlyph },
            ].map((r) => (
              <View key={r.label} style={styles.warChestCell}>
                <View style={styles.warChestCellInner}>
                  <View style={styles.warChestCellLeft}>
                    <Text style={[styles.warChestValue, { color: r.color, fontSize: 24 }]}>
                      {r.value}
                    </Text>
                    <Text style={styles.warChestLabel}>{r.label}</Text>
                  </View>
                  <r.Glyph size={28} color={r.color} />
                </View>
              </View>
            ))}
          </View>
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
              <Pressable style={styles.activateBtn}>
                <Text style={styles.activateBtnText}>ACTIVATE</Text>
              </Pressable>
            </View>
            {i < ABILITIES.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    paddingTop: StatusBar.currentHeight + spacing.md,
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
  sectionLabelRight: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.4,
    marginLeft: spacing.sm,
  },

  // COUNTDOWN
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

  // WAR CHEST
  warChestContainer: {
    gap: spacing.sm,
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
  warChestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  warChestCell: {
    width: '48.5%',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    padding: spacing.md,
  },
  warChestCellInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warChestCellLeft: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  warChestValue: {
    fontFamily: fonts.displayMedium,
    letterSpacing: -0.02,
  },
  warChestLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },

  // ABILITIES
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
  activateBtnText: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.sm,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
});
