import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE_2 = '#8B8F98';
const CLAIM = '#D64525';
const ALLIANCE = '#3F8F4E';
const ALLIANCE_RULE = 'rgba(63,143,78,0.4)';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

const BENEFITS = [
  { title: 'Collective defence', sub: 'Alliance members can defend your territories.' },
  { title: 'Shared War Chest', sub: 'Pool resources to fund alliance abilities.' },
  { title: 'Alliance colour', sub: 'Alliance-held territories now display in Alliance green.' },
  { title: 'Alliance missions', sub: 'Weekly shared goals. Complete together for resources.' },
  { title: 'Recruit up to 19 Commanders', sub: "Invite by username. Bring in players who haven't joined yet." },
];

export default function AllianceJoinedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { allianceName, shortName, city, memberCount } = route.params ?? {};

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.accent} />

      <View style={styles.body}>

        {/* Kicker */}
        <View style={styles.kickerRow}>
          <Text style={styles.kickerText}>Alliance founded</Text>
          <View style={styles.kickerRule} />
        </View>

        {/* Hero alliance name */}
        <Text style={styles.allianceName}>{allianceName ?? 'Your Alliance'}</Text>
        <Text style={styles.tag}>[{shortName ?? 'XXX'}]</Text>

        {/* Milestone subtitle */}
        <Text style={styles.subtitle}>Ready for war.</Text>

        {/* Meta grid: city + commanders */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>City</Text>
            <Text style={styles.metaValue}>{city ?? '—'}</Text>
          </View>
          <View style={[styles.metaCell, styles.metaCellLast]}>
            <Text style={styles.metaLabel}>Commanders</Text>
            <Text style={styles.metaValue}>{memberCount ?? 1} / 20</Text>
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>What you've unlocked</Text>
          <View style={styles.sectionRule} />
        </View>

        {/* Benefit rows */}
        <View style={styles.bList}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={[styles.bRow, i === 0 && styles.bRowFirst]}>
              <Text style={styles.bNum}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.bText}>
                <Text style={styles.bTitle}>{b.title}</Text>
                <Text style={styles.bSub}>{b.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MainTabs', { screen: 'Alliance' })}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaStep}>Take command</Text>
          <Text style={styles.ctaAction}>Enter alliance →</Text>
        </Pressable>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  content: {
    flexGrow: 1,
    backgroundColor: INK,
  },
  accent: {
    height: 4,
    backgroundColor: ALLIANCE,
    width: '100%',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },

  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  kickerText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.8,
    color: ALLIANCE,
    textTransform: 'uppercase',
  },
  kickerRule: {
    flex: 1,
    height: 1,
    backgroundColor: ALLIANCE_RULE,
  },

  allianceName: {
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 8,
  },
  tag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 3,
    color: ALLIANCE,
    textTransform: 'uppercase',
    marginBottom: 28,
  },

  subtitle: {
    fontFamily: 'Archivo_700Bold_Italic',
    fontSize: 16,
    fontStyle: 'italic',
    color: BONE,
    lineHeight: 21,
    marginBottom: 28,
  },

  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    marginBottom: 32,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
  },
  metaCellLast: {
    borderRightWidth: 0,
    paddingLeft: 16,
  },
  metaLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: SLATE_2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metaValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    color: BONE,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: SLATE_2,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },

  bList: {
    marginBottom: 32,
  },
  bRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    gap: 12,
  },
  bRowFirst: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  bNum: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
    width: 24,
    paddingTop: 2,
  },
  bText: {
    flex: 1,
  },
  bTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: BONE,
    lineHeight: 18,
    marginBottom: 4,
  },
  bSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: SLATE_2,
    lineHeight: 18,
  },

  cta: {
    backgroundColor: CLAIM,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  ctaStep: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    opacity: 0.75,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ctaAction: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
});
