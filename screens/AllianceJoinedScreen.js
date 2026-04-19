import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const BENEFITS = [
  { icon: '🛡️', title: 'Collective defence', sub: 'Alliance members defend your territories together' },
  { icon: '⚔️', title: 'Shared war chest', sub: 'Pool resources for powerful alliance abilities' },
  { icon: '🗺️', title: 'Alliance colours', sub: 'Your territories show in alliance colour on the map' },
  { icon: '🎯', title: 'Alliance missions', sub: 'Weekly shared goals for bonus rewards' },
];

export default function AllianceJoinedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { allianceName, shortName, city, memberCount } = route.params ?? {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.accentBar} />

      <View style={styles.body}>
        <Text style={styles.youreIn}>YOU'RE IN</Text>
        <Text style={styles.headline}>
          Welcome to {allianceName ?? 'Your Alliance'} [{shortName ?? '???'}]
        </Text>
        <Text style={styles.subtitle}>{allianceName ?? 'Your Alliance'} is ready for war.</Text>
        <Text style={styles.meta}>
          {city ?? '—'} · {memberCount ?? 1} member{(memberCount ?? 1) === 1 ? '' : 's'}
        </Text>

        <Text style={styles.sectionLabel}>WHAT THIS MEANS</Text>
        {BENEFITS.map((b, i) => (
          <View key={i} style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>{b.icon}</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitSub}>{b.sub}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('MainTabs', { screen: 'Alliance' })}>
          <Text style={styles.btnText}>Go to Alliance</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  content: { backgroundColor: '#0f0f14', flexGrow: 1},
  accentBar: { height: 5, backgroundColor: '#ED9332', width: '100%' },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  youreIn: { fontSize: 10, color: '#ED9332', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  headline: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 8 },
  meta: { fontSize: 11, color: '#555', marginBottom: 18 },
  sectionLabel: { fontSize: 10, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  benefitCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  benefitIcon: { fontSize: 16, marginTop: 1 },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 12, color: '#ccc', fontWeight: '500' },
  benefitSub: { fontSize: 10, color: '#555', lineHeight: 14, marginTop: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(237,147,50,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, color: '#ED9332', fontWeight: '600' },
  memberName: { fontSize: 12, color: '#ccc' },
  memberRole: { fontSize: 9, color: '#555' },
  btn: { backgroundColor: '#ED9332', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 18 },
  btnText: { fontSize: 13, fontWeight: '500', color: '#fff' },
});