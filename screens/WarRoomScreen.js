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

const CLAIM = '#D64525';
const INK = '#0E1014';
const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const ALLIANCE_GREEN = '#3F8F4E';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

const WAR_CHEST = [
  { label: 'MORALE', value: '340', color: '#3F8F4E', Glyph: MoraleGlyph },
  { label: 'GOLD', value: '120', color: '#F2EEE6', Glyph: GoldGlyph },
  { label: 'IRON', value: '85', color: '#F2EEE6', Glyph: IronGlyph },
  { label: 'SHIELD', value: '210', color: '#F2EEE6', Glyph: ShieldGlyph },
  { label: 'STONE', value: '160', color: '#F2EEE6', Glyph: StoneGlyph },
  { label: 'INFLUENCE', value: '94', color: '#F2EEE6', Glyph: InfluenceGlyph },
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
        {/* ATTACK DAY COUNTDOWN */}
        <SectionLabel left="NEXT ATTACK DAY" />
        <View style={styles.countdownCard}>
          <Text style={styles.countdownValue}>2D 14H</Text>
          <Text style={styles.countdownDay}>SATURDAY · 05:00 – 23:00</Text>
        </View>

        {/* WAR CHEST */}
        <SectionLabel left="WAR CHEST" accent="ALLIANCE RESERVES" />
        <View style={styles.warChestGrid}>
          {WAR_CHEST.map((r) => (
            <View key={r.label} style={styles.warChestCell}>
              <View style={styles.warChestCellLeft}>
                <Text style={styles.warChestLabel}>{r.label}</Text>
                <Text style={[styles.warChestValue, { color: r.color }]}>{r.value}</Text>
              </View>
              <r.Glyph size={28} color={r.color} />
            </View>
          ))}
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
    backgroundColor: INK,
  },
  header: {
    paddingTop: StatusBar.currentHeight + 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: CLAIM,
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 40,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    lineHeight: 44,
  },
  headerSub: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
    letterSpacing: 1.4,
    marginTop: 6,
  },
  headerDivider: {
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginTop: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionLabelText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: BONE,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionHairline: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginLeft: 8,
  },
  sectionLabelRight: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    marginLeft: 8,
  },

  // COUNTDOWN
  countdownCard: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    borderLeftWidth: 2,
    borderLeftColor: CLAIM,
    padding: 16,
  },
  countdownValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 40,
    color: BONE,
    letterSpacing: -0.02,
  },
  countdownDay: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
    letterSpacing: 1.4,
    marginTop: 6,
    textTransform: 'uppercase',
  },

  // WAR CHEST
  warChestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  warChestCell: {
    width: '48.5%',
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warChestCellLeft: {
    flex: 1,
  },
  warChestLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  warChestValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 20,
    letterSpacing: -0.02,
    marginTop: 4,
  },

  // ABILITIES
  abilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  abilityLeft: {
    flex: 1,
  },
  abilityName: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  abilityCost: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.2,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  abilityEffect: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: SLATE2,
    marginTop: 4,
    lineHeight: 18,
  },
  activateBtn: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  rowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
});
