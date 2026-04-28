import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing } from '../lib/theme';
import {
  IronGlyph,
  StoneGlyph,
  GoldGlyph,
  MoraleGlyph,
} from '../components/ResourceGlyphs';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

const RESOURCES = [
  {
    key: 'iron',
    label: 'IRON',
    Glyph: IronGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Spend to contest territories',
    earn: 'Earn from calorie challenges & contest wins',
  },
  {
    key: 'stone',
    label: 'STONE',
    Glyph: StoneGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Spend to defend & develop territories',
    earn: 'Earn from step challenges & defence wins',
  },
  {
    key: 'gold',
    label: 'GOLD',
    Glyph: GoldGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Spend to claim territories',
    earn: 'Earn from all challenges & claims',
  },
  {
    key: 'morale',
    label: 'MORALE',
    Glyph: MoraleGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Donate to alliance war chest',
    earn: 'Earn from challenges & alliance missions',
  },
];

function SectionDivider({ label }) {
  return (
    <View style={styles.sectionDivider}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function WalletScreen({ route }) {
  const {
    username = '',
    iron = 0,
    stone = 0,
    gold = 0,
    morale = 0,
  } = route?.params ?? {};

  const wallet = { iron, stone, gold, morale };

  return (
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Text style={styles.headerLabel}>{username}</Text>
        <Text style={styles.headerTitle}>MY RESOURCES</Text>
        <View style={styles.hairlineStrong} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.walletBlock}>
          <SectionDivider label="WALLET" />
          {RESOURCES.map((r, index) => (
            <View key={r.key}>
              <View style={styles.resourceRow}>
                <View style={styles.glyphWrap}>
                  <r.Glyph size={28} color={r.glyphColor} />
                </View>
                <View style={styles.resourceInfo}>
                  <Text style={styles.resourceLabel}>{r.label}</Text>
                  <Text style={styles.resourceSpend}>{r.spend}</Text>
                  <Text style={styles.resourceEarn}>{r.earn}</Text>
                </View>
                <Text style={styles.resourceBalance}>
                  {wallet[r.key].toLocaleString()}
                </Text>
              </View>
              {index < RESOURCES.length - 1 ? (
                <View style={styles.rowDivider} />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  headerBlock: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    marginTop: 2,
  },
  hairlineStrong: {
    marginTop: 14,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  walletBlock: {
    paddingTop: spacing.xl,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE,
  },
  sectionLabel: {
    paddingHorizontal: 8,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.16,
    color: SLATE2,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  glyphWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceInfo: {
    flex: 1,
    gap: 2,
  },
  resourceLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  resourceSpend: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: BONE,
    opacity: 0.7,
  },
  resourceEarn: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  resourceBalance: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 28,
    color: BONE,
    letterSpacing: -0.02,
  },
  rowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
});

